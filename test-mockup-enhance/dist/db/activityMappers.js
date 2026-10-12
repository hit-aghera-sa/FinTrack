/**
 * Mapping between the stored `TaskActivity` row and the shared domain type.
 *
 * Deliberately free of Prisma and of every other module except the shared
 * model, so it can be unit tested without a generated client and reused by the
 * in-memory store.
 */
import { DEFAULT_TASK_ACTIVITY_KIND, isTaskActivityKind, } from "../models/activity.js";
/** The stored kind, falling back to {@link DEFAULT_TASK_ACTIVITY_KIND}. */
export function toActivityKind(value) {
    return isTaskActivityKind(value) ? value : DEFAULT_TASK_ACTIVITY_KIND;
}
/** Trimmed text, or null for nothing worth storing. */
export function activityTextOrNull(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}
/** The stored row as the shared domain type. */
export function toTaskActivity(row) {
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
export function toActivityWriteData(input) {
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
export function normaliseActivityLimit(limit) {
    if (limit === undefined || !Number.isFinite(limit)) {
        return undefined;
    }
    const whole = Math.floor(limit);
    return whole <= 0 ? 0 : whole;
}
