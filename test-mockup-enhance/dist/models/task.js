/**
 * Shared task domain types. Defined once for the whole project — every other
 * lane imports these rather than re-declaring them.
 */
/** Board order: left to right. */
export const TASK_STATUSES = ["todo", "doing", "done"];
/** Human-readable column / badge labels for each status. */
export const TASK_STATUS_LABELS = {
    todo: "To do",
    doing: "Doing",
    done: "Done",
};
/** The status a newly created task gets when none is supplied. */
export const DEFAULT_TASK_STATUS = "todo";
/** Ordered from least to most urgent. */
export const TASK_PRIORITIES = ["Low", "Medium", "High"];
/** Display labels for each priority. */
export const TASK_PRIORITY_LABELS = {
    Low: "Low",
    Medium: "Medium",
    High: "High",
};
/** The priority a newly created task gets when none is supplied. */
export const DEFAULT_TASK_PRIORITY = "Medium";
/** Narrowing guard for untrusted input (query strings, request bodies). */
export function isTaskStatus(value) {
    return (typeof value === "string" &&
        TASK_STATUSES.some((status) => status === value));
}
/** Label lookup that is safe to call with an unvalidated value. */
export function taskStatusLabel(value) {
    return isTaskStatus(value) ? TASK_STATUS_LABELS[value] : "";
}
/** Narrowing guard for untrusted input (query strings, request bodies). */
export function isTaskPriority(value) {
    return (typeof value === "string" &&
        TASK_PRIORITIES.some((priority) => priority === value));
}
/** Label lookup that is safe to call with an unvalidated value. */
export function taskPriorityLabel(value) {
    return isTaskPriority(value) ? TASK_PRIORITY_LABELS[value] : "";
}
