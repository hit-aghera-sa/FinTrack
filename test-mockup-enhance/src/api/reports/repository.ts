/**
 * The report repository.
 *
 * It reads through the repositories the data lane owns — which are the
 * Prisma-backed implementations in production and the in-memory ones in the
 * test/capture harness — so the aggregation always runs against the stored
 * tasks and never bypasses the ORM or re-implements a query of its own.
 */

import type { TeamMemberRepository } from "../../db/memberRepository.js";
import type { TaskRepository } from "../../db/taskRepository.js";
import type { MemberReport } from "./types.js";
import { buildMemberReports } from "./workload.js";

/** What the reporting endpoint asks for. */
export interface ReportRepository {
  /**
   * One entry per team member — the whole roster — counted against `today`,
   * which the caller computes on the server.
   */
  memberWorkload(today: string): Promise<MemberReport[]>;
}

/** The stores the report repository reads. */
export interface ReportRepositoryDeps {
  tasks: TaskRepository;
  members: TeamMemberRepository;
}

/** Builds the report repository over the shared task and roster repositories. */
export function createReportRepository(deps: ReportRepositoryDeps): ReportRepository {
  return {
    async memberWorkload(today: string): Promise<MemberReport[]> {
      const [members, tasks] = await Promise.all([deps.members.list(), deps.tasks.list()]);
      return buildMemberReports(members, tasks, today);
    },
  };
}
