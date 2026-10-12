/**
 * Shared reporting contracts for the member workload report.
 *
 * Every count here is computed on the server from the stored tasks; the client
 * renders the numbers and derives none of its own.
 */

/** One team member's workload, as the report presents it. */
export interface MemberReport {
  memberId: string;
  memberName: string;
  /** The member's descriptive role label. */
  role: string;
  /** Tasks assigned to this member with status "todo". */
  todo: number;
  /** Tasks assigned to this member with status "doing". */
  doing: number;
  /** Tasks assigned to this member with status "done". */
  done: number;
  /** Tasks whose due date is before today and whose status is not "done". */
  overdue: number;
  /** Every task assigned to this member, whatever its status. */
  total: number;
}

/** The whole roster's workload, as `GET /api/reports` returns it. */
export interface WorkloadReport {
  /** One entry per team member, including members with no tasks at all. */
  members: MemberReport[];
  /** ISO-8601 timestamp of the moment the server computed the report. */
  generatedAt: string;
}
