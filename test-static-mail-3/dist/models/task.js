/**
 * Task domain model — the SINGLE definition of the task entity, the filter union
 * and title validation for the whole project. Every other lane (server store, API
 * route, API client, hook, components, composition root, tests) imports from here
 * and MUST NOT re-declare these shapes.
 *
 * Pure TypeScript: no framework imports, no side effects at import time, safe for
 * both the browser bundle and the Node server.
 */
import { COPY } from './copy.js';
/** Every filter, in display order. */
export const FILTERS = ['all', 'active', 'completed'];
/** The filter used when none is supplied. */
export const DEFAULT_FILTER = 'all';
/** Inclusive title length bounds (applied AFTER trimming). */
export const TITLE_MIN_LENGTH = 1;
export const TITLE_MAX_LENGTH = 100;
/** Thrown by the factory helpers when a title is rejected. */
export class TaskValidationError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'TaskValidationError';
        this.code = code;
    }
}
/** Trim surrounding whitespace. The only normalisation applied to a title. */
export function normalizeTitle(raw) {
    return raw.trim();
}
/** Validate a (possibly untrusted) title value: trim, then enforce 1-100 characters. */
export function validateTitle(raw) {
    if (typeof raw !== 'string') {
        return { ok: false, code: 'title_required', message: COPY.errors.titleRequired };
    }
    const value = normalizeTitle(raw);
    if (value.length < TITLE_MIN_LENGTH) {
        return { ok: false, code: 'title_required', message: COPY.errors.titleRequired };
    }
    if (value.length > TITLE_MAX_LENGTH) {
        return { ok: false, code: 'title_too_long', message: COPY.errors.titleTooLong };
    }
    return { ok: true, value };
}
/** Convenience predicate over {@link validateTitle}. */
export function isValidTitle(raw) {
    return validateTitle(raw).ok;
}
/** Runtime guard for the {@link Filter} union (query strings, persisted prefs, …). */
export function isFilter(value) {
    return typeof value === 'string' && FILTERS.includes(value);
}
/** Coerce an unknown value to a {@link Filter}, falling back to {@link DEFAULT_FILTER}. */
export function parseFilter(value) {
    return isFilter(value) ? value : DEFAULT_FILTER;
}
/** Runtime guard for a decoded {@link Task} (API responses, database rows). */
export function isTask(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return (typeof candidate.id === 'string' &&
        candidate.id.length > 0 &&
        typeof candidate.title === 'string' &&
        typeof candidate.completed === 'boolean' &&
        typeof candidate.createdAt === 'string');
}
/**
 * Build a validated {@link Task}. Pure apart from the default timestamp, which the
 * caller can pin for deterministic tests.
 *
 * @throws {TaskValidationError} when the title fails {@link validateTitle}.
 */
export function createTask(options) {
    const result = validateTitle(options.title);
    if (!result.ok) {
        throw new TaskValidationError(result.code, result.message);
    }
    return {
        id: options.id,
        title: result.value,
        completed: options.completed ?? false,
        createdAt: options.createdAt ?? new Date().toISOString(),
    };
}
/**
 * Apply a patch to a task, returning a NEW task. Validates the title when present.
 *
 * @throws {TaskValidationError} when a supplied title fails {@link validateTitle}.
 */
export function applyTaskPatch(task, patch) {
    let title = task.title;
    if (patch.title !== undefined) {
        const result = validateTitle(patch.title);
        if (!result.ok) {
            throw new TaskValidationError(result.code, result.message);
        }
        title = result.value;
    }
    return {
        id: task.id,
        title,
        completed: patch.completed ?? task.completed,
        createdAt: task.createdAt,
    };
}
/** Toggle a task's completion state, returning a NEW task. */
export function toggleTask(task) {
    return { ...task, completed: !task.completed };
}
/** Select the tasks visible under a filter. Never mutates the input. */
export function filterTasks(tasks, filter) {
    switch (filter) {
        case 'active':
            return tasks.filter((task) => !task.completed);
        case 'completed':
            return tasks.filter((task) => task.completed);
        case 'all':
        default:
            return [...tasks];
    }
}
/** Number of tasks still to do. */
export function countActive(tasks) {
    return tasks.reduce((total, task) => (task.completed ? total : total + 1), 0);
}
/** Number of completed tasks. */
export function countCompleted(tasks) {
    return tasks.length - countActive(tasks);
}
/** Stable display order: newest first, ties broken by id so the order is deterministic. */
export function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
        if (a.createdAt === b.createdAt)
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        return a.createdAt < b.createdAt ? 1 : -1;
    });
}
