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

/** A single task as persisted and as sent over the wire. */
export interface Task {
  /** Opaque, stable identifier. Never rendered as user-facing copy. */
  readonly id: string;
  /** Normalised (trimmed) title, 1-100 characters. */
  readonly title: string;
  /** Whether the task has been completed. */
  readonly completed: boolean;
  /** ISO-8601 creation timestamp, e.g. `2024-05-01T10:00:00.000Z`. */
  readonly createdAt: string;
}

/** The list filter applied in the UI and accepted by the API. */
export type Filter = 'all' | 'active' | 'completed';

/** Every filter, in display order. */
export const FILTERS: readonly Filter[] = ['all', 'active', 'completed'] as const;

/** The filter used when none is supplied. */
export const DEFAULT_FILTER: Filter = 'all';

/** Inclusive title length bounds (applied AFTER trimming). */
export const TITLE_MIN_LENGTH = 1;
export const TITLE_MAX_LENGTH = 100;

/** Machine-readable reason a title was rejected. */
export type TitleErrorCode = 'title_required' | 'title_too_long';

export interface TitleValidationSuccess {
  readonly ok: true;
  /** The normalised title, safe to persist. */
  readonly value: string;
}

export interface TitleValidationFailure {
  readonly ok: false;
  readonly code: TitleErrorCode;
  /** User-facing message taken verbatim from the copy contract. */
  readonly message: string;
}

export type TitleValidationResult = TitleValidationSuccess | TitleValidationFailure;

/** Thrown by the factory helpers when a title is rejected. */
export class TaskValidationError extends Error {
  readonly code: TitleErrorCode;

  constructor(code: TitleErrorCode, message: string) {
    super(message);
    this.name = 'TaskValidationError';
    this.code = code;
  }
}

/** Trim surrounding whitespace. The only normalisation applied to a title. */
export function normalizeTitle(raw: string): string {
  return raw.trim();
}

/** Validate a (possibly untrusted) title value: trim, then enforce 1-100 characters. */
export function validateTitle(raw: unknown): TitleValidationResult {
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
export function isValidTitle(raw: unknown): boolean {
  return validateTitle(raw).ok;
}

/** Runtime guard for the {@link Filter} union (query strings, persisted prefs, …). */
export function isFilter(value: unknown): value is Filter {
  return typeof value === 'string' && (FILTERS as readonly string[]).includes(value);
}

/** Coerce an unknown value to a {@link Filter}, falling back to {@link DEFAULT_FILTER}. */
export function parseFilter(value: unknown): Filter {
  return isFilter(value) ? value : DEFAULT_FILTER;
}

/** Runtime guard for a decoded {@link Task} (API responses, database rows). */
export function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.title === 'string' &&
    typeof candidate.completed === 'boolean' &&
    typeof candidate.createdAt === 'string'
  );
}

/** Options accepted by {@link createTask}. */
export interface CreateTaskOptions {
  readonly id: string;
  readonly title: string;
  readonly completed?: boolean;
  /** ISO-8601 timestamp. Defaults to the current time. */
  readonly createdAt?: string;
}

/**
 * Build a validated {@link Task}. Pure apart from the default timestamp, which the
 * caller can pin for deterministic tests.
 *
 * @throws {TaskValidationError} when the title fails {@link validateTitle}.
 */
export function createTask(options: CreateTaskOptions): Task {
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

/** Fields that may be patched on an existing task. */
export interface TaskPatch {
  readonly title?: string;
  readonly completed?: boolean;
}

/**
 * Apply a patch to a task, returning a NEW task. Validates the title when present.
 *
 * @throws {TaskValidationError} when a supplied title fails {@link validateTitle}.
 */
export function applyTaskPatch(task: Task, patch: TaskPatch): Task {
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
export function toggleTask(task: Task): Task {
  return { ...task, completed: !task.completed };
}

/** Select the tasks visible under a filter. Never mutates the input. */
export function filterTasks(tasks: readonly Task[], filter: Filter): Task[] {
  switch (filter) {
    case 'active':
      return tasks.filter((task: Task) => !task.completed);
    case 'completed':
      return tasks.filter((task: Task) => task.completed);
    case 'all':
    default:
      return [...tasks];
  }
}

/** Number of tasks still to do. */
export function countActive(tasks: readonly Task[]): number {
  return tasks.reduce((total: number, task: Task) => (task.completed ? total : total + 1), 0);
}

/** Number of completed tasks. */
export function countCompleted(tasks: readonly Task[]): number {
  return tasks.length - countActive(tasks);
}

/** Stable display order: newest first, ties broken by id so the order is deterministic. */
export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a: Task, b: Task) => {
    if (a.createdAt === b.createdAt) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}
