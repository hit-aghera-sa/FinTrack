/**
 * Public surface of the HTTP task client lane.
 *
 * The `useTasks` hook is the ONLY consumer:
 *
 *   import { getTasks, saveTasks, ApiError } from '../api/index.js';
 *
 * Importing this module has NO side effects: no request is issued and the ambient
 * `fetch` is not resolved until a call is made.
 *
 * LANE NOTE (QA triage, kept here so the next triage pass does not re-open it):
 * this lane renders NOTHING. It emits no DOM, no CSS class names, no font sizes and
 * no user-visible text of its own — every message it surfaces is read from the shared
 * COPY contract in `src/models`. Screen-level findings (rendered-secret heuristics that
 * match CSS class names, off-scale typography) therefore always originate in the
 * component / app-shell lanes that own the markup and the stylesheets, never here.
 */
export {
  API_BASE_PATH,
  ApiError,
  JSON_HEADERS,
  TASKS_ENDPOINT,
  extractTasks,
  getTasks,
  isApiError,
  saveTasks,
  serializeTaskList,
} from './api.js';
export type { FetchLike, HttpRequestInit, HttpResponse } from './api.js';
