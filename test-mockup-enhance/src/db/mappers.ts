/**
 * Pure translation helpers between database rows and the shared domain models.
 * This module imports no database driver, so it is safe to unit test and to
 * import from anywhere.
 */

import type { Task, TaskPriority, TaskStatus } from "../models/task.js";
import type { TeamMember, TeamMemberWithWorkload } from "../models/member.js";
import type { TaskComment } from "../models/comment.js";

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** The task columns the repositories read. */
export interface TaskRow {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  dueDate: Date | null;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
}

/** The team-member columns the repositories read. */
export interface TeamMemberRow {
  id: string;
  name: string;
  role: string;
}

/** The comment columns the repositories read. */
export interface CommentRow {
  id: string;
  taskId: string;
  body: string;
  createdAt: Date;
}

/** Projection used when counting open tasks per assignee. */
export interface OpenTaskAssigneeRow {
  assigneeId: string | null;
}

/** Renders a stored timestamp as the calendar day the UI edits. */
export function formatDueDate(value: Date | null): string | null {
  if (value === null) {
    return null;
  }
  return value.toISOString().slice(0, 10);
}

/**
 * Accepts `YYYY-MM-DD` (the value an `<input type="date">` produces), a full
 * ISO timestamp, null, undefined or an empty string. Throws on anything else.
 */
export function parseDueDate(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const candidate = ISO_DATE_ONLY.test(trimmed)
    ? new Date(`${trimmed}T00:00:00.000Z`)
    : new Date(trimmed);
  if (Number.isNaN(candidate.getTime())) {
    throw new Error(`Invalid due date: ${trimmed}`);
  }
  return candidate;
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assigneeId: row.assigneeId,
    dueDate: formatDueDate(row.dueDate),
    status: row.status,
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
  };
}

export function toTaskComment(row: CommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.taskId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Tallies open (non-done) tasks per assignee id, ignoring unassigned rows. */
export function countOpenTasksByAssignee(
  rows: readonly OpenTaskAssigneeRow[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const assigneeId = row.assigneeId;
    if (assigneeId === null) {
      continue;
    }
    counts.set(assigneeId, (counts.get(assigneeId) ?? 0) + 1);
  }
  return counts;
}

/** Combines a roster with the open-task rows into the roster view model. */
export function withWorkload(
  members: readonly TeamMemberRow[],
  openTasks: readonly OpenTaskAssigneeRow[],
): TeamMemberWithWorkload[] {
  const counts = countOpenTasksByAssignee(openTasks);
  return members.map((member: TeamMemberRow): TeamMemberWithWorkload => ({
    id: member.id,
    name: member.name,
    role: member.role,
    openTaskCount: counts.get(member.id) ?? 0,
  }));
}
