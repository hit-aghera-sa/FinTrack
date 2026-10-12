/**
 * Shared task-activity domain types. Declared exactly once for the whole
 * project — every other lane imports these rather than re-declaring them.
 *
 * An activity row records ONE thing that happened to a task. A change records
 * which `field` moved and its `fromValue` / `toValue`; a note (a comment, a
 * creation) simply carries a `message`. `actor` is the person's name as typed,
 * or null — this product has no accounts, so it is never an account id.
 */
/** Every kind, in the order a filter should offer them. */
export const TASK_ACTIVITY_KINDS = [
    "created",
    "updated",
    "status_changed",
    "priority_changed",
    "assignee_changed",
    "due_date_changed",
    "labels_changed",
    "commented",
];
/** Human-readable label for each kind. */
export const TASK_ACTIVITY_KIND_LABELS = {
    created: "Created",
    updated: "Updated",
    status_changed: "Status changed",
    priority_changed: "Priority changed",
    assignee_changed: "Assignee changed",
    due_date_changed: "Due date changed",
    labels_changed: "Labels changed",
    commented: "Commented",
};
/** The kind a row gets when the stored value is not one of the known kinds. */
export const DEFAULT_TASK_ACTIVITY_KIND = "updated";
/** Narrowing guard for untrusted input (request bodies, stored strings). */
export function isTaskActivityKind(value) {
    return (typeof value === "string" &&
        TASK_ACTIVITY_KINDS.some((kind) => kind === value));
}
/** Label lookup that is safe to call with an unvalidated value. */
export function taskActivityKindLabel(value) {
    return isTaskActivityKind(value) ? TASK_ACTIVITY_KIND_LABELS[value] : "";
}
