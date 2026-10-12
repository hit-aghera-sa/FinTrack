/**
 * The activity payloads of a task's feed, declared exactly once for the whole
 * project.
 *
 * The HTTP router serialises these and the task screen reads them, so the field
 * names below are the wire contract of `GET /api/tasks/:taskId/activity`.
 */
/** Every kind of entry the feed can hold. */
export const TASK_ACTIVITY_KINDS = [
    "task_created",
    "status_changed",
    "priority_changed",
    "assignee_changed",
    "labels_changed",
    "field_changed",
    "comment_added",
    "task_deleted",
];
/** Narrowing guard for untrusted input (query strings, request bodies). */
export function isTaskActivityKind(value) {
    return (typeof value === "string" &&
        TASK_ACTIVITY_KINDS.some((kind) => kind === value));
}
/**
 * The most entries one read may ask for. A larger `?limit` is clamped to this
 * rather than refused, so a feed request can never ask the store for an
 * unbounded page.
 */
export const MAX_ACTIVITY_LIMIT = 200;
