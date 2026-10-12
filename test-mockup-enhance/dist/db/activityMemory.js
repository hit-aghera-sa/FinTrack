/**
 * The in-memory task activity store.
 *
 * The very same `TaskActivityRepository` interface as the Prisma-backed one, so
 * the app can boot its test-mode datastore (`APP_DB=memory`) and backend unit
 * tests can exercise the activity endpoints without a database. No Prisma
 * import, so importing this module costs nothing.
 */
import { normaliseActivityLimit, toActivityWriteData, } from "./activityMappers.js";
function toPayload(stored) {
    return {
        id: stored.id,
        taskId: stored.data.taskId,
        kind: stored.data.kind,
        field: stored.data.field,
        fromValue: stored.data.fromValue,
        toValue: stored.data.toValue,
        actor: stored.data.actor,
        message: stored.data.message,
        createdAt: stored.createdAt,
    };
}
/** Newest first: by timestamp, then by insertion order. */
function newestFirst(left, right) {
    if (left.createdAt !== right.createdAt) {
        return left.createdAt < right.createdAt ? 1 : -1;
    }
    return right.sequence - left.sequence;
}
/** A fresh, empty activity store. */
export function createMemoryTaskActivityRepository() {
    const rows = [];
    let sequence = 0;
    const write = (input) => {
        sequence += 1;
        const stored = {
            id: `activity-m${String(sequence)}`,
            sequence,
            createdAt: new Date().toISOString(),
            data: toActivityWriteData(input),
        };
        rows.push(stored);
        return stored;
    };
    return {
        record(input) {
            return Promise.resolve(toPayload(write(input)));
        },
        recordMany(inputs) {
            const written = [];
            for (const input of inputs) {
                written.push(toPayload(write(input)));
            }
            return Promise.resolve(written);
        },
        listByTask(taskId, limit) {
            const take = normaliseActivityLimit(limit);
            if (take === 0) {
                return Promise.resolve([]);
            }
            const feed = rows
                .filter((stored) => stored.data.taskId === taskId)
                .sort(newestFirst)
                .map(toPayload);
            return Promise.resolve(take === undefined ? feed : feed.slice(0, take));
        },
    };
}
