/**
 * Input shape guarding for the in-memory task store.
 *
 * The store is fed by a full-list `PUT` whose body is entirely untrusted, so every
 * entry is parsed and normalised here BEFORE it is allowed near the backing array.
 * A malformed body is rejected wholesale; a partially-applied list is never possible.
 *
 * Credential-shaped values are rejected too: whatever the store keeps is rendered
 * verbatim by the client, so a secret that reaches the list becomes a secret on
 * screen. See `./secretGuard.ts`.
 *
 * Pure module: importing it opens no connections and performs no I/O.
 */
import { randomUUID } from 'node:crypto';
import { COPY, validateTitle } from '../../models/index.js';
import { looksLikeSecret } from './secretGuard.js';
/** Upper bound on the number of tasks a single replaceAll may install. */
export const MAX_TASKS = 500;
/** Thrown by store methods that cannot return a result object (e.g. `replaceAll`). */
export class TaskStoreValidationError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'TaskStoreValidationError';
        this.code = code;
    }
}
function fail(code, message) {
    return { ok: false, code, message };
}
/** Default id generator. Ids are opaque and never rendered as user-facing copy. */
export function defaultTaskId() {
    return `t-${randomUUID()}`;
}
function defaultNow() {
    return new Date().toISOString();
}
/** True when `value` is a string parseable as a date. */
export function isIsoTimestamp(value) {
    if (typeof value !== 'string' || value.trim().length === 0)
        return false;
    return Number.isFinite(Date.parse(value));
}
/**
 * Parse one untrusted entry into a {@link Task}.
 *
 * - `title` is required and validated by the shared model (trimmed, 1-100 chars).
 * - `id` may be omitted (one is generated) but must be a non-empty string when present.
 * - `completed` may be omitted (defaults to `false`) but must be a boolean when present.
 * - `createdAt` may be omitted (defaults to now) but must be a valid timestamp when present.
 * - Unknown properties are dropped, so a payload cannot smuggle extra state in.
 * - Credential-shaped titles and ids are rejected, so nothing the store renders can
 *   ever be secret material.
 */
export function parseTask(value, options = {}) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return fail('bad_request', COPY.errors.unexpected);
    }
    const record = value;
    const title = validateTitle(record.title);
    if (!title.ok) {
        return fail(title.code, title.message);
    }
    if (looksLikeSecret(title.value)) {
        return fail('bad_request', COPY.errors.unexpected);
    }
    let id;
    if (record.id === undefined || record.id === null) {
        id = (options.idFactory ?? defaultTaskId)();
    }
    else if (typeof record.id === 'string' && record.id.trim().length > 0) {
        id = record.id.trim();
    }
    else {
        return fail('bad_request', COPY.errors.unexpected);
    }
    if (looksLikeSecret(id)) {
        return fail('bad_request', COPY.errors.unexpected);
    }
    let completed = false;
    if (record.completed !== undefined && record.completed !== null) {
        if (typeof record.completed !== 'boolean') {
            return fail('bad_request', COPY.errors.unexpected);
        }
        completed = record.completed;
    }
    let createdAt;
    if (record.createdAt === undefined || record.createdAt === null) {
        createdAt = (options.now ?? defaultNow)();
    }
    else if (isIsoTimestamp(record.createdAt)) {
        createdAt = new Date(record.createdAt).toISOString();
    }
    else {
        return fail('bad_request', COPY.errors.unexpected);
    }
    return { ok: true, value: { id, title: title.value, completed, createdAt } };
}
function toEntryArray(input) {
    if (Array.isArray(input))
        return input;
    if (typeof input === 'object' && input !== null) {
        const tasks = input.tasks;
        if (Array.isArray(tasks))
            return tasks;
    }
    return null;
}
/**
 * Parse a whole full-list PUT body. Accepts either a bare array or `{ tasks: [...] }`.
 * Rejects non-arrays, oversized lists, duplicate ids and any malformed entry.
 */
export function parseTaskList(input, options = {}) {
    const entries = toEntryArray(input);
    if (entries === null) {
        return fail('bad_request', COPY.errors.unexpected);
    }
    if (entries.length > MAX_TASKS) {
        return fail('bad_request', COPY.errors.unexpected);
    }
    const seen = new Set();
    const tasks = [];
    for (const entry of entries) {
        const parsed = parseTask(entry, options);
        if (!parsed.ok)
            return parsed;
        if (seen.has(parsed.value.id)) {
            return fail('bad_request', COPY.errors.unexpected);
        }
        seen.add(parsed.value.id);
        tasks.push(parsed.value);
    }
    return { ok: true, value: tasks };
}
