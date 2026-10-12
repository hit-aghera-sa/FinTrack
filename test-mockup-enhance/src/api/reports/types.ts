/**
 * The reporting payloads, declared exactly once for the whole project.
 *
 * The HTTP router serialises these and the reports screen reads them, so the
 * field names below are the wire contract of `GET /api/reports`.
 */

/** One roster member's workload, as counted on the server. */
export interface MemberReport {
  memberId: string;
  memberName: string;
  role: string;
  /** Tasks assigned to this member whose status is "todo". */
  todo: number;
  /** Tasks assigned to this member whose status is "doing". */
  doing: number;
  /** Tasks assigned to this member whose status is "done". */
  done: number;
  /** Tasks whose due date is before today AND whose status is not "done". */
  overdue: number;
  /** Every task assigned to this member, whatever its status. */
  total: number;
}

/** The whole report: one entry per team member, plus when it was produced. */
export interface WorkloadReport {
  /** ISO-8601 timestamp of the moment the server produced the report. */
  generatedAt: string;
  /** The whole roster, in roster order — members with no tasks included. */
  members: MemberReport[];
}
