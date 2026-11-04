import { randomUUID } from "node:crypto";
/** Upper bound on how many tasks a single PUT may submit. */
export const MAX_TASKS = 500;
/** Upper bound on the length of a single task title. */
export const MAX_TITLE_LENGTH = 200;
/** Raised when a PUT body does not match the expected task-list shape. */
export class TaskValidationError extends Error {
    code = "INVALID_TASK_LIST";
    constructor(message) {
        super(message);
        this.name = "TaskValidationError";
    }
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Type guard for a fully formed task object. */
export function isTask(value) {
    if (!isRecord(value)) {
        return false;
    }
    return (typeof value.id === "string" &&
        value.id.trim().length > 0 &&
        typeof value.title === "string" &&
        value.title.trim().length > 0 &&
        value.title.length <= MAX_TITLE_LENGTH &&
        typeof value.done === "boolean");
}
/** Type guard for an array of fully formed task objects. */
export function isTaskList(value) {
    return Array.isArray(value) && value.every((entry) => isTask(entry));
}
function parseTask(value, index) {
    if (!isRecord(value)) {
        throw new TaskValidationError(`Task at index ${index} must be an object`);
    }
    const rawTitle = value.title;
    if (typeof rawTitle !== "string") {
        throw new TaskValidationError(`Task at index ${index} must have a string title`);
    }
    const title = rawTitle.trim();
    if (title.length === 0) {
        throw new TaskValidationError(`Task at index ${index} must have a non-empty title`);
    }
    if (title.length > MAX_TITLE_LENGTH) {
        throw new TaskValidationError(`Task at index ${index} title may be at most ${MAX_TITLE_LENGTH} characters`);
    }
    const rawDone = value.done;
    if (rawDone !== undefined && typeof rawDone !== "boolean") {
        throw new TaskValidationError(`Task at index ${index} must have a boolean done flag`);
    }
    const rawId = value.id;
    if (rawId !== undefined && typeof rawId !== "string") {
        throw new TaskValidationError(`Task at index ${index} must have a string id`);
    }
    const id = typeof rawId === "string" && rawId.trim().length > 0 ? rawId.trim() : randomUUID();
    return { id, title, done: rawDone === true };
}
/**
 * Validates and normalises an untrusted PUT body into a task list.
 * Throws {@link TaskValidationError} instead of returning a partial list, so a
 * malformed body can never be written into the store.
 */
export function parseTaskList(input) {
    if (!Array.isArray(input)) {
        throw new TaskValidationError("Task list must be an array");
    }
    if (input.length > MAX_TASKS) {
        throw new TaskValidationError(`Task list may contain at most ${MAX_TASKS} tasks`);
    }
    const seen = new Set();
    const tasks = [];
    for (let index = 0; index < input.length; index += 1) {
        const task = parseTask(input[index], index);
        if (seen.has(task.id)) {
            throw new TaskValidationError(`Duplicate task id "${task.id}" at index ${index}`);
        }
        seen.add(task.id);
        tasks.push(task);
    }
    return tasks;
}
