/**
 * THE WEB API CLIENT — the single import path every screen uses to reach this app's `/api` surface.
 *
 * Importing this module is side-effect free: it holds no state, opens no connection and reads no
 * storage. The session credential is the server's http-only cookie, which the browser attaches
 * itself, so the same account follows a traveller from a phone browser to a desktop browser.
 */
export { ApiError, isApiError, isOfflineError, isAbortError, offlineError } from './errors.js';
export {
  OFFLINE_CODE,
  OFFLINE_STATUS,
  UNEXPECTED_CODE,
  UNEXPECTED_MESSAGE,
  errorFromBody,
  parseJsonOrNull,
  readErrorBody,
} from './errors.js';
export { API_BASE_PATH, apiFetch, apiPath } from './client.js';
export type { ApiMethod, ApiRequestInit } from './client.js';
