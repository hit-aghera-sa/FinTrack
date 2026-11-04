/**
 * The data-access contract implemented by the server store lane and consumed by the
 * API route lane. Declared here so both sides depend on one interface.
 *
 * TWO PORTS, ONE SOURCE
 * ---------------------
 * - {@link TaskStore} below is the per-resource port (list / get / create / update /
 *   remove) used when the API exposes individual task routes.
 * - `TaskListStore` in `./wire.js` is the FULL-LIST port (`list` + `replaceAll`) used
 *   by the `GET/PUT /api/tasks` flow this app actually ships.
 *
 * Both declare `list(options?: ListTasksOptions): Promise<Task[]>`. A server store
 * MUST implement one of these interfaces verbatim — including `list` — rather than
 * declaring its own `Task` shape or a differently named accessor, otherwise the
 * router's store parameter and the store implementation drift apart and the server
 * compilation fails.
 *
 * Importing this module opens NO connections and performs no I/O.
 */
import type { Filter, Task, TaskPatch } from './task.js';

/** Input accepted when creating a task. */
export interface CreateTaskInput {
  readonly title: string;
}

/** Input accepted when updating a task. */
export type UpdateTaskInput = TaskPatch;

/** Query options for {@link TaskStore.list}. */
export interface ListTasksOptions {
  readonly filter?: Filter;
}

/**
 * Persistence port for tasks. Implementations may be in-memory or database backed;
 * every method resolves with plain {@link Task} values.
 */
export interface TaskStore {
  /** All tasks, newest first, optionally narrowed by filter. */
  list(options?: ListTasksOptions): Promise<Task[]>;
  /** Fetch a single task, or `null` when it does not exist. */
  get(id: string): Promise<Task | null>;
  /** Create and persist a validated task. */
  create(input: CreateTaskInput): Promise<Task>;
  /** Patch a task, or resolve `null` when it does not exist. */
  update(id: string, patch: UpdateTaskInput): Promise<Task | null>;
  /** Delete a task; resolves `true` when a row was removed. */
  remove(id: string): Promise<boolean>;
}

/** Factory signature used by the composition root to build a store. */
export type TaskStoreFactory = () => TaskStore;
