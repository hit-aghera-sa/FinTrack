/**
 * The activity store the feed reads and the recording service writes through.
 *
 * `ActivityRepository` is the INTERFACE the service and the HTTP layer are
 * written against, so the storage behind it can change without touching a rule
 * or a route: a Prisma-backed implementation of this same interface drops
 * straight into the composition root.
 *
 * `createMemoryActivityRepository` is the implementation this build ships with.
 * It keeps the entries of every task in memory, hands them back NEWEST FIRST,
 * and applies the same limit clamp the HTTP layer uses.
 */
import { MAX_ACTIVITY_LIMIT, } from "./types.js";
/** The number of entries a read may really return. */
export function clampActivityLimit(limit) {
    const whole = Math.trunc(limit);
    if (!Number.isFinite(whole) || whole < 1) {
        return 1;
    }
    return Math.min(whole, MAX_ACTIVITY_LIMIT);
}
/**
 * Builds an in-memory activity store. The composition root creates one for the
 * lifetime of the process, so every request sees the same feed.
 */
export function createMemoryActivityRepository(options = {}) {
    const rows = [];
    const clock = options.now ?? (() => new Date());
    let sequence = 0;
    return {
        async listByTask(taskId, limit) {
            const mine = rows.filter((row) => row.taskId === taskId);
            const newestFirst = mine.reverse();
            if (limit === undefined) {
                return newestFirst;
            }
            return newestFirst.slice(0, clampActivityLimit(limit));
        },
        async create(entry) {
            sequence += 1;
            const stored = {
                id: `activity-${String(sequence)}`,
                taskId: entry.taskId,
                kind: entry.kind,
                field: entry.field ?? null,
                fromValue: entry.fromValue ?? null,
                toValue: entry.toValue ?? null,
                // The name the timeline shows. Stored exactly as the service resolved it.
                actor: entry.actor ?? null,
                message: entry.message,
                createdAt: clock().toISOString(),
            };
            rows.push(stored);
            return stored;
        },
    };
}
