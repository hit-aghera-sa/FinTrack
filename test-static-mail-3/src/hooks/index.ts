/**
 * Public surface of the state/HTTP hook lane. Screens import from this barrel:
 *
 *   import { useTasks } from './hooks/index.js';
 *
 * Importing this module has NO side effects: no request is issued and no state is
 * created until the hook is called from a component.
 */
export { httpTaskClient, useTasks } from './useTasks.js';
export type { TaskClient, UseTasksOptions, UseTasksResult } from './useTasks.js';
export {
  LOAD_ERROR,
  SAVE_ERROR,
  UUID_PATTERN,
  addTaskToList,
  countTasks,
  createTaskId,
  errorMessageFrom,
  isUuid,
  isoNow,
  removeTaskById,
  selectVisibleTasks,
  setTaskCompleted,
} from './taskState.js';
export type { AddTaskResult, NewTaskFields, TaskCounts } from './taskState.js';
