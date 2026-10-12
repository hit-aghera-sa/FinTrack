import { prisma } from "./client.js";
import { buildMemberReports, startOfUtcDay, } from "./reportMappers.js";
/**
 * Prisma-backed reporting repository.
 *
 * Every count is aggregated server-side from the stored rows: the roster is
 * read in full (so members with no tasks appear with zero counts) and the
 * assigned tasks are read with just the three columns the report needs.
 */
export function createReportRepository(client = prisma) {
    return {
        async workloadReport(now = new Date()) {
            const members = await client.teamMember.findMany({
                orderBy: [{ name: "asc" }, { id: "asc" }],
                select: { id: true, name: true, role: true },
            });
            const tasks = await client.task.findMany({
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
