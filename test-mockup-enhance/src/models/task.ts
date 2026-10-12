/**
 * Shared task domain types. Defined once for the whole project — every other
 * lane imports these rather than re-declaring them.
 */

import type { Label } from "./label.js";

export type TaskStatus = "todo" | "doing" | "done";

/** Board order: left to right. */
export const TASK_STATUSES: readonly TaskStatus[] = ["todo", "doing", "done"];

/** Human-readable column / badge labels for each status. */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  doing: "Doing",
  done: "Done",
};

/** The status a newly created task gets when none is supplied. */
export const DEFAULT_TASK_STATUS: TaskStatus = "todo";

/** How urgent a task is. */
export type TaskPriority = "Low" | "Medium" | "High";

/** Ordered from least to most urgent. */
export const TASK_PRIORITIES: readonly TaskPriority[] = ["Low", "Medium", "High"];

/** Display labels for each priority. */
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
};

/** The priority a newly created task gets when none is supplied. */
export const DEFAULT_TASK_PRIORITY: TaskPriority = "Medium";

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  /** Calendar day in `YYYY-MM-DD` form, or null when no due date is set. */
  dueDate: string | null;
  status: TaskStatus;
  /** Always present: a task stored without one carries the default. */
  priority: TaskPriority;
  /**
   * The labels this task carries, in name order — ALWAYS POPULATED by the
   * repositories and by the HTTP API (an empty array for a task with no
   * labels). It is spelled optional only so the stores written before labels
   * existed still compile; read it as `task.labels ?? []`.
   */
  labels?: Label[];
  /** ISO-8601 timestamp. */
  createdAt: string;
}

export interface NewTask {
  title: string;
  description?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  status?: TaskStatus;
  /** Absent means {@link DEFAULT_TASK_PRIORITY}. */
  priority?: TaskPriority;
  /** The labels the new task starts with. Absent or empty means no labels. */
  labelIds?: string[];
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  /**
   * REPLACES the task's whole label set with exactly these labels. Absent
   * leaves the labels alone; an empty array clears every label.
   */
  labelIds?: string[];
}

/** Narrowing guard for untrusted input (query strings, request bodies). */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" &&
    TASK_STATUSES.some((status: TaskStatus): boolean => status === value)
  );
}

/** Label lookup that is safe to call with an unvalidated value. */
export function taskStatusLabel(value: unknown): string {
  return isTaskStatus(value) ? TASK_STATUS_LABELS[value] : "";
}

/** Narrowing guard for untrusted input (query strings, request bodies). */
export function isTaskPriority(value: unknown): value is TaskPriority {
  return (
    typeof value === "string" &&
    TASK_PRIORITIES.some((priority: TaskPriority): boolean => priority === value)
  );
}

/** Label lookup that is safe to call with an unvalidated value. */
export function taskPriorityLabel(value: unknown): string {
  return isTaskPriority(value) ? TASK_PRIORITY_LABELS[value] : "";
}
