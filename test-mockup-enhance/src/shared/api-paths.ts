/**
 * HTTP addresses of the board backend, declared exactly once.
 *
 * The server composition root mounts the feature routers from these values, so
 * the address a router answers on is never written down in two places.
 */

export const API_PREFIX = "/api";

export const TASKS_ENDPOINT = `${API_PREFIX}/tasks`;

export const MEMBERS_ENDPOINT = `${API_PREFIX}/members`;

export const HEALTH_ENDPOINT = `${API_PREFIX}/health`;

/**
 * The reporting path as the report router declares it, relative to the `/api`
 * mount. The router and the full endpoint below are the only two readers.
 */
export const REPORTS_SUBPATH = "/reports";

/** The member-workload report: `GET`. */
export const REPORTS_ENDPOINT = `${API_PREFIX}${REPORTS_SUBPATH}`;

/**
 * The label paths as the label router declares them, relative to the `/api`
 * mount: the label collection, and one task's label set.
 */
export const LABELS_SUBPATH = "/labels";

export const TASK_LABELS_SUBPATH = "/tasks/:taskId/labels";

/** The label collection: `GET`/`POST`. */
export const LABELS_ENDPOINT = `${API_PREFIX}${LABELS_SUBPATH}`;

/**
 * One task's activity feed as the activity router declares it, relative to the
 * `/api` mount. This is the ONE spelling of that path: the router mounts it and
 * {@link taskActivityEndpoint} below builds the address a client calls.
 */
export const TASK_ACTIVITY_SUBPATH = "/tasks/:taskId/activity";

/** Address of a single task. */
export function taskEndpoint(taskId: string): string {
  return `${TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`;
}

/** Address of the comment thread of a single task. */
export function taskCommentsEndpoint(taskId: string): string {
  return `${taskEndpoint(taskId)}/comments`;
}

/** Address of one task's label set: `PUT`. */
export function taskLabelsEndpoint(taskId: string): string {
  return `${taskEndpoint(taskId)}/labels`;
}

/** Address of one task's activity feed: `GET`, newest first, optional `?limit`. */
export function taskActivityEndpoint(taskId: string): string {
  return `${taskEndpoint(taskId)}/activity`;
}

/** Address of a single team member. */
export function memberEndpoint(memberId: string): string {
  return `${MEMBERS_ENDPOINT}/${encodeURIComponent(memberId)}`;
}
