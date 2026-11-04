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
import type { Filter, Task } from './task.js';
import type { ListTasksOptions } from './store.js';

/** The envelope shape a client may wrap the list in (`{ tasks: [...] }`). */
export interface TaskListEnvelope {
  readonly tasks: readonly unknown[];
}

/**
 * Accepted body of `PUT /api/tasks`: either the bare array (canonical) or the
 * `{ tasks }` envelope. Anything else is rejected by the route lane.
 */
export type ReplaceTaskListRequest = readonly Task[] | { readonly tasks: readonly Task[] };

/** Options accepted by {@link normalizeTask} and {@link sanitizeTaskList}. */
export interface NormalizeTaskOptions {
  /** Timestamp used when an incoming record carries no usable `createdAt`. */
  readonly fallbackCreatedAt?: string;
}

/**
 * Coerce ONE untrusted record into a validated {@link Task}, or `null` when it can
 * never be a task.
 *
 * Applies exactly the shared rules: a non-empty string id, a title that passes
 * {@link validateTitle} (trimmed, 1-100 characters), a strict boolean `completed`
 * (anything not `true` is treated as not completed) and a string `createdAt`
 * (falling back to `options.fallbackCreatedAt` when the caller supplies one).
 */
export function normalizeTask(value: unknown, options: NormalizeTaskOptions = {}): Task | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;

  const id = candidate.id;
  if (typeof id !== 'string' || id.length === 0) return null;

  const title = validateTitle(candidate.title);
  if (!title.ok) return null;

  const rawCreatedAt = candidate.createdAt;
  const createdAt =
    typeof rawCreatedAt === 'string' && rawCreatedAt.length > 0
      ? rawCreatedAt
      : options.fallbackCreatedAt;
  if (typeof createdAt !== 'string' || createdAt.length === 0) return null;

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
export function unwrapTaskList(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return [...body];
  if (typeof body === 'object' && body !== null) {
    const wrapped = (body as { tasks?: unknown }).tasks;
    if (Array.isArray(wrapped)) return [...wrapped];
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
export function sanitizeTaskList(body: unknown, options: NormalizeTaskOptions = {}): Task[] | null {
  const raw = unwrapTaskList(body);
  if (raw === null) return null;

  const seen = new Set<string>();
  const tasks: Task[] = [];
  for (const entry of raw) {
    const task = normalizeTask(entry, options);
    if (task === null) continue;
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    tasks.push(task);
  }
  return tasks;
}

/** Runtime guard for an already-decoded list of tasks. */
export function isTaskList(value: unknown): value is Task[] {
  return Array.isArray(value) && value.every((entry: unknown) => normalizeTask(entry) !== null);
}

/**
 * Persistence port for the FULL-LIST replace flow.
 *
 * Structurally compatible with the router's store parameter, so a store
 * implementing this interface can be handed straight to the API lane. Declared here
 * so both sides depend on ONE contract.
 */
export interface TaskListStore {
  /** All tasks, newest first, optionally narrowed by filter. */
  list(options?: ListTasksOptions): Promise<Task[]>;
  /** Swap the ENTIRE list for a validated copy of `input`; resolves with what is stored. */
  replaceAll(input: unknown): Promise<Task[]>;
}

/** Factory signature used by the composition root to build a full-list store. */
export type TaskListStoreFactory = () => TaskListStore;

/** Wrap a list in the `{ tasks }` envelope (the bare array is the canonical body). */
export function toTaskListEnvelope(tasks: readonly Task[]): { tasks: Task[] } {
  return { tasks: tasks.map((task: Task) => ({ ...task })) };
}

/** Filter applied to a list, expressed over the shared {@link Filter} union. */
export function selectByFilter(tasks: readonly Task[], filter: Filter): Task[] {
  if (filter === 'active') return tasks.filter((task: Task) => !task.completed);
  if (filter === 'completed') return tasks.filter((task: Task) => task.completed);
  return [...tasks];
}
