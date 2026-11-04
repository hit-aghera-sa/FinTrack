/**
 * `useTasks` — the SINGLE owner of application state and of every HTTP call.
 *
 * Components are presentational: they receive values and callbacks from this hook
 * and never call `fetch` themselves.
 *
 * Behaviour:
 *  - loads the list once on mount (`GET /api/tasks`);
 *  - validates and PREPENDS a new task (client-generated uuid + ISO `createdAt`);
 *  - toggles `completed` and removes by id;
 *  - owns the filter, the draft title and ONE error string;
 *  - derives `visibleTasks` plus `doneCount` / `totalCount` over ALL tasks;
 *  - updates the UI OPTIMISTICALLY and fires the PUT WITHOUT awaiting it;
 *  - clears the error on the next successful call and NEVER rolls the on-screen
 *    list back on failure;
 *  - owns the composer input ref so it can be cleared and refocused after an add.
 *
 * The un-awaited PUTs go through a SERIAL queue (`./taskQueue.js`): the caller still
 * never waits, but at most one write is in flight and writes reach the last-write-wins
 * endpoint in the order the user made them, so the stored list always ends up equal to
 * the rendered list.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { getTasks, saveTasks } from '../api/index.js';
import { DEFAULT_FILTER } from '../models/index.js';
import type { Filter, Task } from '../models/index.js';
import { createSaveQueue } from './taskQueue.js';
import type { SaveQueue } from './taskQueue.js';
import {
  LOAD_ERROR,
  SAVE_ERROR,
  addTaskToList,
  countTasks,
  errorMessageFrom,
  removeTaskById,
  selectVisibleTasks,
  setTaskCompleted,
} from './taskState.js';
import type { NewTaskFields, TaskCounts } from './taskState.js';

/**
 * The two calls this hook makes. Injectable so the hook can be exercised without a
 * network; the default implementation is the real `src/api` HTTP client.
 */
export interface TaskClient {
  /** `GET /api/tasks` — the stored list. */
  load(): Promise<Task[]>;
  /** `PUT /api/tasks` — the COMPLETE list. The hook never awaits the result. */
  save(tasks: Task[]): Promise<unknown>;
}

/** The production client: the real same-origin `/api/tasks` endpoints. */
export const httpTaskClient: TaskClient = {
  load(): Promise<Task[]> {
    return getTasks();
  },
  save(tasks: Task[]): Promise<unknown> {
    return saveTasks(tasks);
  },
};

/** Options accepted by {@link useTasks}. Every one of them has a production default. */
export interface UseTasksOptions {
  /** HTTP client override (tests). Defaults to {@link httpTaskClient}. */
  readonly client?: TaskClient;
  /** Seed list, used before the first load resolves. */
  readonly initialTasks?: readonly Task[];
  /** Filter selected on first render. Defaults to the shared default (`all`). */
  readonly initialFilter?: Filter;
  /** Id generator override (tests). Defaults to a client-generated uuid. */
  readonly idFactory?: () => string;
  /** Clock override (tests). Must return an ISO-8601 timestamp. */
  readonly now?: () => string;
  /** Set `false` to skip the load-on-mount (tests / SSR). Defaults to `true`. */
  readonly autoLoad?: boolean;
}

/** Everything the screen needs. Nothing else in the UI holds task state. */
export interface UseTasksResult {
  /** ALL tasks, newest first. */
  readonly tasks: readonly Task[];
  /** The tasks the list renders for the active filter. */
  readonly visibleTasks: readonly Task[];
  /** The active filter. */
  readonly filter: Filter;
  /** The composer's current value. */
  readonly draftTitle: string;
  /** The single error line, or `null` when there is nothing to report. */
  readonly error: string | null;
  /** True while the initial load is in flight. */
  readonly loading: boolean;
  /** Completed tasks across the WHOLE list. */
  readonly doneCount: number;
  /** Total tasks across the WHOLE list. */
  readonly totalCount: number;
  /** Ref for the composer input: cleared and refocused after a successful add. */
  readonly inputRef: RefObject<HTMLInputElement>;
  /** Select a filter. */
  setFilter(filter: Filter): void;
  /** Update the composer value. */
  setDraftTitle(value: string): void;
  /** Validate and prepend a task (defaults to the current draft title). */
  addTask(title?: string): void;
  /** Set (or flip, when `completed` is omitted) a task's completed flag. */
  toggleTask(id: string, completed?: boolean): void;
  /** Remove a task by id. No confirmation step. */
  removeTask(id: string): void;
  /** Alias of {@link UseTasksResult.removeTask}, for callers that name it `deleteTask`. */
  deleteTask(id: string): void;
  /** Remove every completed task in one optimistic update + one PUT. */
  clearCompleted(): void;
  /** Re-run the list load. */
  reload(): void;
}

/** The one stateful hook of the application. */
export function useTasks(options: UseTasksOptions = {}): UseTasksResult {
  const client = options.client ?? httpTaskClient;
  const autoLoad = options.autoLoad ?? true;
  const idFactory = options.idFactory;
  const nowFactory = options.now;

  const [tasks, setTasksState] = useState<Task[]>(() => [...(options.initialTasks ?? [])]);
  const [filter, setFilterState] = useState<Filter>(options.initialFilter ?? DEFAULT_FILTER);
  const [draftTitle, setDraftTitleState] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(autoLoad);

  /** The composer input, owned here so an add can clear and refocus it. */
  const inputRef = useRef<HTMLInputElement>(null);
  const tasksRef = useRef<readonly Task[]>(tasks);
  const draftRef = useRef<string>(draftTitle);
  const mountedRef = useRef<boolean>(true);
  /** Identifies the newest in-flight load, so a stale response is discarded. */
  const loadTokenRef = useRef<number>(0);
  /** Bumped by every local mutation, so a load cannot clobber a fresh edit. */
  const editCountRef = useRef<number>(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * The serial PUT queue. One per client instance: writes are applied in the order
   * the user made them, and the caller never awaits them.
   */
  const queue: SaveQueue = useMemo(
    () =>
      createSaveQueue(
        (list: readonly Task[]): Promise<unknown> => client.save([...list]),
        {
          onSuccess: (): void => {
            if (mountedRef.current) setError(null);
          },
          onError: (cause: unknown): void => {
            if (mountedRef.current) setError(errorMessageFrom(cause, SAVE_ERROR));
          },
        },
      ),
    [client],
  );

  /** Set both the rendered list and the ref the callbacks read from. */
  const commit = useCallback((next: readonly Task[]): void => {
    tasksRef.current = next;
    setTasksState([...next]);
  }, []);

  /**
   * Schedule the PUT with the COMPLETE list and DO NOT await it: the UI has already
   * moved on. A success clears the error line; a failure shows one message and the
   * on-screen list is deliberately left exactly as the user left it.
   */
  const persist = useCallback(
    (next: readonly Task[]): void => {
      editCountRef.current += 1;
      queue.enqueue(next);
    },
    [queue],
  );

  const reload = useCallback((): void => {
    loadTokenRef.current += 1;
    const token = loadTokenRef.current;
    const editsAtStart = editCountRef.current;
    setLoading(true);

    void client.load().then(
      (loaded: Task[]): void => {
        if (!mountedRef.current) return;
        // A newer load has been started: this response is stale, ignore it entirely.
        if (token !== loadTokenRef.current) return;
        // The user changed the list while the load was in flight (StrictMode double
        // mount, or a quick first add): keep what is on screen, it is newer.
        if (editsAtStart === editCountRef.current) {
          commit([...loaded]);
        }
        setError(null);
        setLoading(false);
      },
      (cause: unknown): void => {
        if (!mountedRef.current) return;
        if (token !== loadTokenRef.current) return;
        setError(errorMessageFrom(cause, LOAD_ERROR));
        setLoading(false);
      },
    );
  }, [client, commit]);

  useEffect(() => {
    if (!autoLoad) {
      setLoading(false);
      return;
    }
    reload();
  }, [autoLoad, reload]);

  const setFilter = useCallback((next: Filter): void => {
    setFilterState(next);
  }, []);

  const setDraftTitle = useCallback((value: string): void => {
    draftRef.current = value;
    setDraftTitleState(value);
  }, []);

  /**
   * Validate the title and PREPEND the task optimistically. A rejected title only
   * sets the single error line: nothing is sent and the draft is left untouched so
   * the user can fix it.
   */
  const addTask = useCallback(
    (title?: string): void => {
      const raw = title ?? draftRef.current;
      const fields: NewTaskFields = {
        id: idFactory !== undefined ? idFactory() : undefined,
        createdAt: nowFactory !== undefined ? nowFactory() : undefined,
      };
      const result = addTaskToList(tasksRef.current, raw, fields);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      commit(result.tasks);
      draftRef.current = '';
      setDraftTitleState('');
      const input = inputRef.current;
      if (input !== null) {
        input.value = '';
        input.focus();
      }
      persist(result.tasks);
    },
    [commit, idFactory, nowFactory, persist],
  );

  const toggleTask = useCallback(
    (id: string, completed?: boolean): void => {
      const current = tasksRef.current;
      const next = setTaskCompleted(current, id, completed);
      if (next === current) return;
      commit(next);
      persist(next);
    },
    [commit, persist],
  );

  const removeTask = useCallback(
    (id: string): void => {
      const current = tasksRef.current;
      const next = removeTaskById(current, id);
      if (next === current) return;
      commit(next);
      persist(next);
    },
    [commit, persist],
  );

  const clearCompleted = useCallback((): void => {
    const current = tasksRef.current;
    const next = current.filter((task: Task) => !task.completed);
    if (next.length === current.length) return;
    commit(next);
    persist(next);
  }, [commit, persist]);

  const visibleTasks = useMemo<Task[]>(() => selectVisibleTasks(tasks, filter), [tasks, filter]);
  const counts = useMemo<TaskCounts>(() => countTasks(tasks), [tasks]);

  return {
    tasks,
    visibleTasks,
    filter,
    draftTitle,
    error,
    loading,
    doneCount: counts.doneCount,
    totalCount: counts.totalCount,
    inputRef,
    setFilter,
    setDraftTitle,
    addTask,
    toggleTask,
    removeTask,
    deleteTask: removeTask,
    clearCompleted,
    reload,
  };
}
