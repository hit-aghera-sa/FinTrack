/**
 * The Prisma-backed task activity repository.
 *
 * Every read and write goes through the generated client, so every value is a
 * parameterised query argument and never string-interpolated SQL. Importing
 * this module opens no connection: the client is created lazily in
 * src/db/client.ts and connects on first use.
 */
import { prisma } from "./client.js";
import { normaliseActivityLimit, toActivityWriteData, toTaskActivity, } from "./activityMappers.js";
/**
 * The activity store for the board. `listByTask` answers newest-first and is
 * backed by the `(taskId, createdAt)` index; a task removed by the task
 * repository takes its activity rows with it (cascade delete in the schema).
 */
export function createTaskActivityRepository(client = prisma) {
    return {
        async record(input) {
            const data = toActivityWriteData(input);
            const row = await client.taskActivity.create({ data });
            return toTaskActivity(row);
        },
        async recordMany(inputs) {
            const written = [];
            for (const input of inputs) {
                const data = toActivityWriteData(input);
                const row = await client.taskActivity.create({ data });
                written.push(toTaskActivity(row));
            }
            return written;
        },
        async listByTask(taskId, limit) {
            const take = normaliseActivityLimit(limit);
            if (take === 0) {
                return [];
            }
            const rows = await client.taskActivity.findMany({
                where: { taskId },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                ...(take === undefined ? {} : { take }),
            });
            return rows.map(toTaskActivity);
        },
    };
}
