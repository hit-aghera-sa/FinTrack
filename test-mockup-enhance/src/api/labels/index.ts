/** Public surface of the label HTTP API lane. */
export {
  createLabelRouter,
  LABELS_ROUTE_PATH,
  TASK_LABELS_ROUTE_PATH,
  MAX_LABEL_NAME_LENGTH,
} from "./router.js";
export type { LabelRouterDeps } from "./router.js";
export {
  createMemoryLabelRepository,
  DuplicateLabelNameError,
  UnknownLabelError,
  SEED_LABELS,
} from "./repository.js";
export type { LabelRepository } from "./repository.js";
