/**
 * The report repository.
 *
 * It reads through the repositories the data lane owns — which are the
 * Prisma-backed implementations in production and the in-memory ones in the
 * test/capture harness — so the aggregation always runs against the stored
 * tasks and never bypasses the ORM or re-implements a query of its own.
 */
import { buildMemberReports } from "./workload.js";
/** Builds the report repository over the shared task and roster repositories. */
export function createReportRepository(deps) {
    return {
        async memberWorkload(today) {
            const [members, tasks] = await Promise.all([deps.members.list(), deps.tasks.list()]);
            return buildMemberReports(members, tasks, today);
        },
    };
}
