/**
 * In-memory implementation of the shared {@link TaskStore} port.
 *
 * The list lives in a plain array owned by the closure below: no file, no database,
 * no persistence. Importing this module performs no I/O and creates no store —
 * callers build one explicitly (or take the shared singleton).
 */
import { DEFAULT_FILTER, filterTasks, validateTitle } from '../../models/index.js';
import type { CreateTaskInput, ListTasksOptions, Task, TaskStore, UpdateTaskInput } from '../../models/index.js';
import { TaskStoreValidationError, defaultTaskId, parseTaskList } from './taskShape.js';
import type { ParseTaskOptions } from './taskShape.js';

export interface MemoryTaskStoreOptions {
  /** Seed entries. Parsed through the same guard as a PUT body. */
  readonly initial?: readonly unknown[];
  /** Id generator, overridable for deterministic tests. */
  readonly idFactory?: () => string;
  /** Clock, overridable for deterministic tests. */
  readonly now?: () => Date;
}

/**
 * The in-memory store. Extends the shared persistence port with the full-list PUT
 * semantics (`replaceAll`) and a few synchronous affordances for tests.
 */
export interface MemoryTaskStore extends TaskStore {
  /** Swap the ENTIRE list for a validated copy of `input`. Throws on a malformed body. */
  replaceAll(input: unknown): Promise<Task[]>;
  /** Synchronous copy of the current list, newest first. */
  snapshot(): Task[];
  /** Empty the list. */
  clear(): void;
  /** Number of stored tasks. */
  size(): number;
}

function sortNewestFirst(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((left: Task, right: Task) => {
    const delta = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (delta !== 0) return delta;
    if (left.id < right.id) return -1;
    if (left.id > right.id) return 1;
    return 0;
  });
}

/** Build an isolated in-memory store. */
export function createMemoryTaskStore(options: MemoryTaskStoreOptions = {}): MemoryTaskStore {
  const idFactory = options.idFactory ?? defaultTaskId;
  const clock = options.now ?? ((): Date => new Date());
  const parseOptions: ParseTaskOptions = {
    idFactory,
    now: (): string => clock().toISOString(),
  };

  /** The one and only backing array. Never handed out by reference. */
  let tasks: Task[] = [];

  if (options.initial !== undefined) {
    const seeded = parseTaskList([...options.initial], parseOptions);
    if (!seeded.ok) {
      throw new TaskStoreValidationError(seeded.code, seeded.message);
    }
    tasks = seeded.value;
  }

  function snapshot(): Task[] {
    return sortNewestFirst(tasks);
  }

  const store: MemoryTaskStore = {
    async list(listOptions?: ListTasksOptions): Promise<Task[]> {
      const filter = listOptions?.filter ?? DEFAULT_FILTER;
      return sortNewestFirst(filterTasks(snapshot(), filter));
    },

    async get(id: string): Promise<Task | null> {
      const found = tasks.find((task: Task) => task.id === id);
      return found ? { ...found } : null;
    },

    async create(input: CreateTaskInput): Promise<Task> {
      const title = validateTitle(input?.title);
      if (!title.ok) {
        throw new TaskStoreValidationError(title.code, title.message);
      }
      const task: Task = {
        id: idFactory(),
        title: title.value,
        completed: false,
        createdAt: clock().toISOString(),
      };
      tasks = [...tasks, task];
      return { ...task };
    },

    async update(id: string, patch: UpdateTaskInput): Promise<Task | null> {
      const index = tasks.findIndex((task: Task) => task.id === id);
      if (index === -1) return null;

      const current = tasks[index] as Task;
      const fields = patch as unknown as { title?: unknown; completed?: unknown };

      let title = current.title;
      if (fields.title !== undefined) {
        const validated = validateTitle(fields.title);
        if (!validated.ok) {
          throw new TaskStoreValidationError(validated.code, validated.message);
        }
        title = validated.value;
      }

      let completed = current.completed;
      if (fields.completed !== undefined) {
        if (typeof fields.completed !== 'boolean') {
          throw new TaskStoreValidationError('bad_request', 'completed must be a boolean.');
        }
        completed = fields.completed;
      }

      const next: Task = { ...current, title, completed };
      const copy = [...tasks];
      copy[index] = next;
      tasks = copy;
      return { ...next };
    },

    async remove(id: string): Promise<boolean> {
      const next = tasks.filter((task: Task) => task.id !== id);
      const removed = next.length !== tasks.length;
      tasks = next;
      return removed;
    },

    async replaceAll(input: unknown): Promise<Task[]> {
      const parsed = parseTaskList(input, parseOptions);
      if (!parsed.ok) {
        // The array is left untouched: a malformed body can never corrupt the list.
        throw new TaskStoreValidationError(parsed.code, parsed.message);
      }
      tasks = parsed.value;
      return snapshot();
    },

    snapshot,

    clear(): void {
      tasks = [];
    },

    size(): number {
      return tasks.length;
    },
  };

  return store;
}
