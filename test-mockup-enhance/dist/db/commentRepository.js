import { prisma } from "./client.js";
import { toTaskComment } from "./mappers.js";
/** Prisma-backed comment thread repository, one thread per task. */
export function createCommentRepository(client = prisma) {
    return {
        async listByTask(taskId) {
            const rows = await client.comment.findMany({
                where: { taskId },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            });
            return rows.map((row) => toTaskComment(row));
        },
        async create(taskId, input) {
            const row = await client.comment.create({
                data: { taskId, body: input.body.trim() },
            });
            return toTaskComment(row);
        },
    };
}
