/**
 * Shared team-member domain types. Roles are descriptive labels only; they
 * carry no permissions.
 */

export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export interface NewTeamMember {
  name: string;
  role: string;
}

export interface TeamMemberWithWorkload {
  id: string;
  name: string;
  role: string;
  /** Number of tasks assigned to this member whose status is not "done". */
  openTaskCount: number;
}
