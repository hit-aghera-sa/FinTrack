/**
 * Mapping between the stored `TaskActivity` row and the shared domain type.
 *
 * Deliberately free of Prisma and of every other module except the shared
 * model, so it can be unit tested without a generated client and reused by the
 * in-memory store.
 */

import {
  DEFAULT_TASK_ACTIVITY_KIND,
  isTaskActivityKind,
  type NewTaskActivity,
  type TaskActivity,
  type TaskActivityKind,
} from "../models/activity.js";

/** One row of the TaskActivity table, exactly as the database holds it. */
export interface TaskActivityRow {
  id: string;
  taskId: string;
  kind: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  actor: string | null;
  message: string;
  createdAt: Date;
}

/** The columns a write sets. `createdAt` and `id` are the database's own. */
export interface TaskActivityWriteData {
  taskId: string;
  kind: TaskActivityKind;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  actor: string | null;
  message: string;
}

/** The stored kind, falling back to {@link DEFAULT_TASK_ACTIVITY_KIND}. */
export function toActivityKind(value: unknown): TaskActivityKind {
  return isTaskActivityKind(value) ? value : DEFAULT_TASK_ACTIVITY_KIND;
}

/** Trimmed text, or null for nothing worth storing. */
export function activityTextOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** The stored row as the shared domain type. */
export function toTaskActivity(row: TaskActivityRow): TaskActivity {
  return {
    id: row.id,
    taskId: row.taskId,
    kind: toActivityKind(row.kind),
    field: row.field,
    fromValue: row.fromValue,
    toValue: row.toValue,
    actor: row.actor,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The columns to write for one new entry. */
export function toActivityWriteData(input: NewTaskActivity): TaskActivityWriteData {
  return {
    taskId: input.taskId.trim(),
    kind: input.kind,
    field: activityTextOrNull(input.field),
    fromValue: activityTextOrNull(input.fromValue),
    toValue: activityTextOrNull(input.toValue),
    actor: activityTextOrNull(input.actor),
    message: input.message === undefined ? "" : input.message.trim(),
  };
}

/**
 * The feed limit as a whole, non-negative count — `undefined` for "every
 * entry", and 0 for "none at all".
 */
export function normaliseActivityLimit(limit?: number): number | undefined {
  if (limit === undefined || !Number.isFinite(limit)) {
    return undefined;
  }
  const whole = Math.floor(limit);
  return whole <= 0 ? 0 : whole;
}
