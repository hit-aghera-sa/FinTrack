import type { PrismaClient } from "./generated.js";

import { prisma } from "./client.js";
import { toTaskComment } from "./mappers.js";
import type { NewComment, TaskComment } from "../models/comment.js";

export interface CommentRepository {
  listByTask(taskId: string): Promise<TaskComment[]>;
  create(taskId: string, input: NewComment): Promise<TaskComment>;
}

/** Prisma-backed comment thread repository, one thread per task. */
export function createCommentRepository(
  client: PrismaClient = prisma,
): CommentRepository {
  return {
    async listByTask(taskId: string): Promise<TaskComment[]> {
      const rows = await client.comment.findMany({
        where: { taskId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return rows.map((row) => toTaskComment(row));
    },

    async create(taskId: string, input: NewComment): Promise<TaskComment> {
      const row = await client.comment.create({
        data: { taskId, body: input.body.trim() },
      });
      return toTaskComment(row);
    },
  };
}
