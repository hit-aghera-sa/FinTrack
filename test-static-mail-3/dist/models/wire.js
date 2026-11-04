/**
 * The FULL-LIST wire contract shared by the server store lane, the API route lane
 * and the browser API client.
 *
 * The app replaces the whole task list in one call (`PUT /api/tasks` with the
 * COMPLETE `Task[]`), so both sides need the same answer to one question: given an
 * untrusted JSON body, what is the validated list of tasks? That answer is declared
 * ONCE here and must not be re-invented in `src/server/**` or `src/api/**`.
 *
 * Pure TypeScript: no framework imports, no environment access, no I/O and no side
 * effects at import time. Safe for both the browser bundle and the Node server.
 */
import { validateTitle } from './task.js';
/**
 * Coerce ONE untrusted record into a validated {@link Task}, or `null` when it can
 * never be a task.
 *
 * Applies exactly the shared rules: a non-empty string id, a title that passes
 * {@link validateTitle} (trimmed, 1-100 characters), a strict boolean `completed`
 * (anything not `true` is treated as not completed) and a string `createdAt`
 * (falling back to `options.fallbackCreatedAt` when the caller supplies one).
 */
export function normalizeTask(value, options = {}) {
    if (typeof value !== 'object' || value === null)
        return null;
    const candidate = value;
    const id = candidate.id;
    if (typeof id !== 'string' || id.length === 0)
        return null;
    const title = validateTitle(candidate.title);
    if (!title.ok)
        return null;
    const rawCreatedAt = candidate.createdAt;
    const createdAt = typeof rawCreatedAt === 'string' && rawCreatedAt.length > 0
        ? rawCreatedAt
        : options.fallbackCreatedAt;
    if (typeof createdAt !== 'string' || createdAt.length === 0)
        return null;
    return {
        id,
        title: title.value,
        completed: candidate.completed === true,
        createdAt,
    };
}
/**
 * Unwrap a `PUT /api/tasks` body down to the raw array it carries.
 *
 * Returns `null` when the body is neither an array nor an object wrapping one under
 * `tasks`. An EMPTY array is a valid list, never an error.
 */
export function unwrapTaskList(body) {
    if (Array.isArray(body))
        return [...body];
    if (typeof body === 'object' && body !== null) {
        const wrapped = body.tasks;
        if (Array.isArray(wrapped))
            return [...wrapped];
    }
    return null;
}
/**
 * Coerce an untrusted body into the validated task list to persist.
 *
 * Unusable records are DROPPED (never thrown for), duplicate ids keep the FIRST
 * occurrence and the incoming order is preserved — the client already sends the list
 * newest first, so the stored order is exactly what the user sees.
 *
 * Returns `null` only when the body is not a list at all, so the caller can answer
 * `400 bad_request` for a malformed payload while still accepting `[]`.
 */
export function sanitizeTaskList(body, options = {}) {
    const raw = unwrapTaskList(body);
    if (raw === null)
        return null;
    const seen = new Set();
    const tasks = [];
    for (const entry of raw) {
        const task = normalizeTask(entry, options);
        if (task === null)
            continue;
        if (seen.has(task.id))
            continue;
        seen.add(task.id);
        tasks.push(task);
    }
    return tasks;
}
/** Runtime guard for an already-decoded list of tasks. */
export function isTaskList(value) {
    return Array.isArray(value) && value.every((entry) => normalizeTask(entry) !== null);
}
/** Wrap a list in the `{ tasks }` envelope (the bare array is the canonical body). */
export function toTaskListEnvelope(tasks) {
    return { tasks: tasks.map((task) => ({ ...task })) };
}
/** Filter applied to a list, expressed over the shared {@link Filter} union. */
export function selectByFilter(tasks, filter) {
    if (filter === 'active')
        return tasks.filter((task) => !task.completed);
    if (filter === 'completed')
        return tasks.filter((task) => task.completed);
    return [...tasks];
}
