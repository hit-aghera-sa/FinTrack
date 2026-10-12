/**
 * THE API ADDRESSES — declared exactly once for the whole app.
 *
 * The server composition root mounts every feature router from these constants,
 * so the address a router answers on is never typed twice. The browser client
 * lane (`src/lib/api/client.ts`) talks to the same `/api` prefix; these values
 * are the authoritative spelling of it.
 *
 * Each feature router declares its own module segment internally
 * (`/tasks`, `/tasks/:taskId/comments`, `/members`), so all three are mounted
 * at {@link API_ROOT} and the full addresses are the ones named below.
 */

/** The prefix every API endpoint lives under. Nothing else may own this scope. */
export const API_ROOT = '/api';

/** Liveness endpoint, useful for a container health check. */
export const HEALTH_PATH = `${API_ROOT}/health`;

/** The task collection: `GET`/`POST`. */
export const TASKS_PATH = `${API_ROOT}/tasks`;

/** The roster collection: `GET`/`POST`. */
export const MEMBERS_PATH = `${API_ROOT}/members`;

/** One task: `GET`/`PATCH`. */
export function taskPath(taskId: string): string {
  return `${TASKS_PATH}/${encodeURIComponent(taskId)}`;
}

/** One task's comment thread: `GET`/`POST`. */
export function taskCommentsPath(taskId: string): string {
  return `${taskPath(taskId)}/comments`;
}

/** One member: `DELETE`. */
export function memberPath(memberId: string): string {
  return `${MEMBERS_PATH}/${encodeURIComponent(memberId)}`;
}
