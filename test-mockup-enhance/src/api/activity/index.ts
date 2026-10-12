/** Public surface of the task activity lane. */
export { createActivityRouter, TASK_ACTIVITY_ROUTE_PATH } from "./router.js";
export type { ActivityRouterDeps } from "./router.js";
export {
  TaskActivityService,
  BOARD_ACTOR,
  commentExtract,
  describeAssigneeId,
  diffTaskFields,
  MAX_COMMENT_EXTRACT,
} from "./service.js";
export type {
  AssigneeNamer,
  TaskActivityReader,
  TaskActivityServiceDeps,
  TaskFieldChange,
} from "./service.js";
export {
  clampActivityLimit,
  createMemoryActivityRepository,
} from "./repository.js";
export type {
  ActivityRepository,
  MemoryActivityRepositoryOptions,
} from "./repository.js";
export {
  MAX_ACTIVITY_LIMIT,
  TASK_ACTIVITY_KINDS,
  isTaskActivityKind,
} from "./types.js";
export type { NewTaskActivity, TaskActivity, TaskActivityKind } from "./types.js";
