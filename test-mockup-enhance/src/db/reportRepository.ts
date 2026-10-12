import type { PrismaClient } from "./generated.js";

import { prisma } from "./client.js";
import {
  buildMemberReports,
  startOfUtcDay,
  type ReportMemberRow,
  type ReportTaskRow,
} from "./reportMappers.js";
import type { WorkloadReport } from "../models/report.js";

export interface ReportRepository {
  /**
   * The whole roster's workload, computed from the stored tasks.
   *
   * `now` exists so a caller (or a test) can pin the moment the report is
   * computed for; the server passes nothing and the current time is used.
   */
  workloadReport(now?: Date): Promise<WorkloadReport>;
}

/**
 * Prisma-backed reporting repository.
 *
 * Every count is aggregated server-side from the stored rows: the roster is
 * read in full (so members with no tasks appear with zero counts) and the
 * assigned tasks are read with just the three columns the report needs.
 */
export function createReportRepository(
  client: PrismaClient = prisma,
): ReportRepository {
  return {
    async workloadReport(now: Date = new Date()): Promise<WorkloadReport> {
      const members: ReportMemberRow[] = await client.teamMember.findMany({
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true, role: true },
      });
      const tasks: ReportTaskRow[] = await client.task.findMany({
        where: { assigneeId: { not: null } },
        select: { assigneeId: true, status: true, dueDate: true },
      });

      return {
        members: buildMemberReports(members, tasks, startOfUtcDay(now)),
        generatedAt: now.toISOString(),
      };
    },
  };
}
