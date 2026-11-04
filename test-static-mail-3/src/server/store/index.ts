/**
 * Public surface of the in-memory task store lane.
 *
 * There is exactly ONE store implementation: the module-level in-memory array in
 * `memoryTaskStore.ts`, built on the canonical `Task` / `TaskStore` types owned by
 * `src/models`. The composition root mounts it with:
 *
 *   import { createTasksRouter } from './api/index.js';
 *   import { getTaskStore } from './store/index.js';
 *   app.use('/api', createTasksRouter(getTaskStore()));
 *
 * `createTaskStore` is kept as an alias of `createMemoryTaskStore` for callers that
 * want an isolated (non-shared) list.
 *
 * Importing this module has NO side effects: no array is allocated, no connection is
 * opened and nothing is read from disk until a store is explicitly created.
 */

/** Canonical domain types — re-exported from the shared model, never re-declared. */
export type { Task, TaskStore } from '../../models/index.js';

export {
  createMemoryTaskStore,
  // Alias kept so existing consumers of `createTaskStore` get the canonical store.
  createMemoryTaskStore as createTaskStore,
} from './memoryTaskStore.js';
export type { MemoryTaskStore, MemoryTaskStoreOptions } from './memoryTaskStore.js';

export { getTaskStore, resetTaskStore, taskStoreFactory } from './sharedTaskStore.js';

export { SECRET_PATTERNS, looksLikeSecret } from './secretGuard.js';

export {
  MAX_TASKS,
  TaskStoreValidationError,
  defaultTaskId,
  isIsoTimestamp,
  parseTask,
  parseTaskList,
} from './taskShape.js';
export type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParseTaskOptions,
  TaskShapeErrorCode,
} from './taskShape.js';
