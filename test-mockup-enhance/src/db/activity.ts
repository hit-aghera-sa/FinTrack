/**
 * The Prisma-backed task activity repository.
 *
 * Every read and write goes through the generated client, so every value is a
 * parameterised query argument and never string-interpolated SQL. Importing
 * this module opens no connection: the client is created lazily in
 * src/db/client.ts and connects on first use.
 */

import type { PrismaClient } from "./generated.js";

import { prisma } from "./client.js";
import {
  normaliseActivityLimit,
  toActivityWriteData,
  toTaskActivity,
  type TaskActivityWriteData,
} from "./activityMappers.js";
import type {
  NewTaskActivity,
  TaskActivity,
  TaskActivityRepository,
} from "../models/activity.js";

// The interface is declared once in the shared model; re-exported here so a
// consumer may import it from either path.
export type { TaskActivityRepository } from "../models/activity.js";

/**
 * The activity store for the board. `listByTask` answers newest-first and is
 * backed by the `(taskId, createdAt)` index; a task removed by the task
 * repository takes its activity rows with it (cascade delete in the schema).
 */
export function createTaskActivityRepository(
  client: PrismaClient = prisma,
): TaskActivityRepository {
  return {
    async record(input: NewTaskActivity): Promise<TaskActivity> {
      const data: TaskActivityWriteData = toActivityWriteData(input);
      const row = await client.taskActivity.create({ data });
      return toTaskActivity(row);
    },

    async recordMany(inputs: readonly NewTaskActivity[]): Promise<TaskActivity[]> {
      const written: TaskActivity[] = [];
      for (const input of inputs) {
        const data: TaskActivityWriteData = toActivityWriteData(input);
        const row = await client.taskActivity.create({ data });
        written.push(toTaskActivity(row));
      }
      return written;
    },

    async listByTask(taskId: string, limit?: number): Promise<TaskActivity[]> {
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
