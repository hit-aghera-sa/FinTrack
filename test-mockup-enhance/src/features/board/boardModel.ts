/**
 * Pure board logic for the three-column board screen.
 *
 * Everything here is free of React and of the network, so it can be unit
 * tested on its own. The shared domain types and the status list / labels come
 * from the data lane (`src/models/task.ts`) and are never re-declared here.
 */

import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type Task,
  type TaskStatus,
} from "../../models/task.js";
import type { TeamMemberWithWorkload } from "../../models/member.js";
import type { ChecklistProgress } from "../../models/checklist/index.js";
import { ApiError } from "../../lib/api/client.js";

/** Shown for a task with no assignee (or an assignee that is no longer on the roster). */
export const UNASSIGNED_LABEL = "Unassigned";

/** Shown for a task with no due date. */
export const NO_DUE_DATE_LABEL = "No due date";

/** One rendered column of the board: a status, its heading, and its tasks. */
export interface BoardColumn {
  status: TaskStatus;
  label: string;
  tasks: Task[];
}

/**
 * The three columns in board order (To do, Doing, Done). Every column is
 * returned even when it has no tasks, and each task lands in exactly the
 * column matching its status.
 */
export function buildColumns(tasks: readonly Task[]): BoardColumn[] {
  return TASK_STATUSES.map(
    (status: TaskStatus): BoardColumn => ({
      status,
      label: TASK_STATUS_LABELS[status],
      tasks: tasks.filter((task: Task): boolean => task.status === status),
    }),
  );
}

/** The statuses a task can be moved to: every column except the one it is in. */
export function moveTargets(status: TaskStatus): TaskStatus[] {
  return TASK_STATUSES.filter((candidate: TaskStatus): boolean => candidate !== status);
}

/** The assignee's name for a card, or {@link UNASSIGNED_LABEL}. */
export function assigneeName(
  members: readonly TeamMemberWithWorkload[],
  assigneeId: string | null,
): string {
  if (assigneeId === null) {
    return UNASSIGNED_LABEL;
  }
  const found = members.find(
    (member: TeamMemberWithWorkload): boolean => member.id === assigneeId,
  );
  return found === undefined ? UNASSIGNED_LABEL : found.name;
}

/**
 * One task's checklist progress, taken from the summary the board loaded.
 *
 * A task the summary does not mention has no checklist items at all, and is
 * reported as nothing out of nothing — which the card shows as `0/0`.
 */
export function checklistProgressFor(
  progress: readonly ChecklistProgress[],
  taskId: string,
): ChecklistProgress {
  const found = progress.find((row: ChecklistProgress): boolean => row.taskId === taskId);
  return found === undefined ? { taskId, done: 0, total: 0 } : found;
}

/** The accessible name of a card's checklist badge: "2 of 5 checklist items done". */
export function checklistProgressAriaLabel(progress: ChecklistProgress): string {
  return `${String(progress.done)} of ${String(progress.total)} checklist items done`;
}

const MONTH_LABELS: readonly string[] = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Renders the stored `YYYY-MM-DD` day for a card, e.g. "18 Feb 2026".
 *
 * Deliberately does not use `Date`, so the label never shifts by a day with
 * the reader's time zone, and never depends on a runtime locale.
 */
export function formatDueDate(dueDate: string | null): string {
  if (dueDate === null || dueDate.trim() === "") {
    return NO_DUE_DATE_LABEL;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate.trim());
  if (match === null) {
    return dueDate;
  }
  const year = match[1];
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (monthIndex < 0 || monthIndex > 11) {
    return dueDate;
  }
  return `${String(day)} ${MONTH_LABELS[monthIndex]} ${year}`;
}

/**
 * The task list with `updated` put in place of the task that has its id — how
 * the board re-renders a moved card from the server's own response.
 */
export function replaceTask(tasks: readonly Task[], updated: Task): Task[] {
  return tasks.map((task: Task): Task => (task.id === updated.id ? updated : task));
}

/** The count chip beside a column heading: "No tasks", "1 task", "4 tasks". */
export function taskCountLabel(count: number): string {
  if (count === 0) {
    return "No tasks";
  }
  return count === 1 ? "1 task" : `${String(count)} tasks`;
}

/**
 * The wording shown in the error banner. The server's own message wins; a
 * request that never reached the backend (status 0) gets a connection message;
 * anything else falls back to the caller's wording.
 */
export function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return "The board could not be reached. Check your connection and try again.";
    }
    if (error.message.trim() !== "") {
      return error.message;
    }
    return fallback;
  }
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
}
