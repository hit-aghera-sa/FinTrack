/**
 * Pure state transitions behind the `useTasks` hook.
 *
 * Everything here is framework-free and side-effect-free (no React, no fetch, no
 * globals touched at import time) so the whole behaviour of the screen's state can
 * be unit tested without a DOM. The hook in `./useTasks.js` is a thin React shell
 * around these functions.
 *
 * All validation and all user-facing wording comes from the shared domain model in
 * `src/models` — nothing is re-declared here.
 */
import { COPY, countCompleted, filterTasks, validateTitle } from '../models/index.js';
import type { Filter, Task, TitleErrorCode } from '../models/index.js';
import { isApiError } from '../api/index.js';

const HEX = '0123456789abcdef';

/** Shape of an RFC-4122 v4 identifier, used by {@link isUuid}. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when `value` looks like a v4 uuid. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Generate the client-side task id.
 *
 * Uses `crypto.randomUUID()` when the runtime provides it (every modern browser and
 * Node 18+) and falls back to an equivalent v4 shape otherwise.
 */
export function createTaskId(): string {
  const cryptoLike = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoLike !== undefined && typeof cryptoLike.randomUUID === 'function') {
    return cryptoLike.randomUUID();
  }
  let out = '';
  for (let index = 0; index < 36; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) {
      out += '-';
      continue;
    }
    if (index === 14) {
      out += '4';
      continue;
    }
    const random = Math.floor(Math.random() * 16);
    if (index === 19) {
      out += HEX[(random & 0x3) | 0x8];
      continue;
    }
    out += HEX[random];
  }
  return out;
}

/** The current instant as an ISO-8601 timestamp. */
export function isoNow(): string {
  return new Date().toISOString();
}

/** Fields the caller may pin when creating a task (tests supply both). */
export interface NewTaskFields {
  readonly id?: string;
  readonly createdAt?: string;
}

/** Outcome of attempting to add a task to the list. */
export type AddTaskResult =
  | { readonly ok: true; readonly task: Task; readonly tasks: Task[] }
  | { readonly ok: false; readonly code: TitleErrorCode; readonly message: string };

/**
 * Validate `rawTitle` and PREPEND the resulting task to a copy of `tasks`.
 *
 * The new task carries a client-generated uuid and an ISO `createdAt`; the input
 * array is never mutated. A rejected title yields the shared validation message so
 * the hook can render it on the single error line.
 */
export function addTaskToList(
  tasks: readonly Task[],
  rawTitle: unknown,
  fields: NewTaskFields = {},
): AddTaskResult {
  const validated = validateTitle(rawTitle);
  if (!validated.ok) {
    return { ok: false, code: validated.code, message: validated.message };
  }
  const task: Task = {
    id: fields.id ?? createTaskId(),
    title: validated.value,
    completed: false,
    createdAt: fields.createdAt ?? isoNow(),
  };
  return { ok: true, task, tasks: [task, ...tasks] };
}

/**
 * Return a new list with the task's `completed` flag set.
 *
 * When `completed` is omitted the current value is flipped. When no task matches
 * `id` the SAME array reference is returned so the caller can skip the update (and
 * the PUT) entirely.
 */
export function setTaskCompleted(
  tasks: readonly Task[],
  id: string,
  completed?: boolean,
): readonly Task[] {
  const exists = tasks.some((task: Task) => task.id === id);
  if (!exists) return tasks;
  return tasks.map((task: Task) =>
    task.id === id ? { ...task, completed: completed ?? !task.completed } : task,
  );
}

/**
 * Return a new list without the task carrying `id`, or the SAME reference when no
 * task matches (nothing changed, so nothing needs persisting).
 */
export function removeTaskById(tasks: readonly Task[], id: string): readonly Task[] {
  const exists = tasks.some((task: Task) => task.id === id);
  if (!exists) return tasks;
  return tasks.filter((task: Task) => task.id !== id);
}

/** The counts rendered by the footer — always over ALL tasks, never the filtered view. */
export interface TaskCounts {
  readonly doneCount: number;
  readonly totalCount: number;
}

/** Count completed and total tasks across the whole list. */
export function countTasks(tasks: readonly Task[]): TaskCounts {
  return { doneCount: countCompleted(tasks), totalCount: tasks.length };
}

/** The tasks the list should render for `filter`, in the order given. */
export function selectVisibleTasks(tasks: readonly Task[], filter: Filter): Task[] {
  return filterTasks(tasks, filter);
}

/**
 * Reduce any thrown value to the ONE line the UI shows.
 *
 * Only an `ApiError` carries a message meant for a human (the API client already
 * maps transport/status failures onto the shared copy contract); anything else
 * degrades to `fallback` so raw runtime details never reach the screen.
 */
export function errorMessageFrom(error: unknown, fallback: string): string {
  if (isApiError(error)) {
    const message = error.message.trim();
    if (message.length > 0) return message;
  }
  return fallback;
}

/** The message shown when the initial load fails. */
export const LOAD_ERROR = COPY.errors.loadFailed;

/** The message shown when persisting the list fails. */
export const SAVE_ERROR = COPY.errors.saveFailed;
