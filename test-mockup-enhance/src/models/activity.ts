/**
 * Shared task-activity domain types. Declared exactly once for the whole
 * project — every other lane imports these rather than re-declaring them.
 *
 * An activity row records ONE thing that happened to a task. A change records
 * which `field` moved and its `fromValue` / `toValue`; a note (a comment, a
 * creation) simply carries a `message`. `actor` is the person's name as typed,
 * or null — this product has no accounts, so it is never an account id.
 */

/** The kinds of thing that can happen to a task. */
export type TaskActivityKind =
  | "created"
  | "updated"
  | "status_changed"
  | "priority_changed"
  | "assignee_changed"
  | "due_date_changed"
  | "labels_changed"
  | "commented";

/** Every kind, in the order a filter should offer them. */
export const TASK_ACTIVITY_KINDS: readonly TaskActivityKind[] = [
  "created",
  "updated",
  "status_changed",
  "priority_changed",
  "assignee_changed",
  "due_date_changed",
  "labels_changed",
  "commented",
];

/** Human-readable label for each kind. */
export const TASK_ACTIVITY_KIND_LABELS: Record<TaskActivityKind, string> = {
  created: "Created",
  updated: "Updated",
  status_changed: "Status changed",
  priority_changed: "Priority changed",
  assignee_changed: "Assignee changed",
  due_date_changed: "Due date changed",
  labels_changed: "Labels changed",
  commented: "Commented",
};

/** The kind a row gets when the stored value is not one of the known kinds. */
export const DEFAULT_TASK_ACTIVITY_KIND: TaskActivityKind = "updated";

/** One stored entry of a task's activity feed. */
export interface TaskActivity {
  id: string;
  /** The task this entry belongs to. */
  taskId: string;
  kind: TaskActivityKind;
  /** The field that changed ("status", "priority", …), or null for a note. */
  field: string | null;
  /** The value before the change, or null. */
  fromValue: string | null;
  /** The value after the change, or null. */
  toValue: string | null;
  /** Who did it, as plain text, or null when nobody was named. */
  actor: string | null;
  /** A sentence for the feed. Always present; "" when there is nothing to add. */
  message: string;
  /** ISO-8601 timestamp of the moment it was recorded. */
  createdAt: string;
}

/** What recording one entry needs. */
export interface NewTaskActivity {
  taskId: string;
  kind: TaskActivityKind;
  /** Absent or empty is stored as null. */
  field?: string | null;
  /** Absent or empty is stored as null. */
  fromValue?: string | null;
  /** Absent or empty is stored as null. */
  toValue?: string | null;
  /** Absent or empty is stored as null. */
  actor?: string | null;
  /** Absent is stored as "". */
  message?: string;
}

/**
 * The data-access surface for task activity. The Prisma-backed implementation
 * is `createTaskActivityRepository` (src/db/activity.ts); the in-memory one is
 * `createMemoryTaskActivityRepository` (src/db/activityMemory.ts). Backend
 * lanes depend on THIS interface, never on a concrete store.
 */
export interface TaskActivityRepository {
  /** Records one entry and returns it as stored. */
  record(input: NewTaskActivity): Promise<TaskActivity>;
  /** Records several entries, in the order given, and returns them as stored. */
  recordMany(inputs: readonly NewTaskActivity[]): Promise<TaskActivity[]>;
  /**
   * One task's feed, NEWEST FIRST. With `limit` only that many of the newest
   * entries are returned; a limit of zero or less returns none.
   */
  listByTask(taskId: string, limit?: number): Promise<TaskActivity[]>;
}

/** Narrowing guard for untrusted input (request bodies, stored strings). */
export function isTaskActivityKind(value: unknown): value is TaskActivityKind {
  return (
    typeof value === "string" &&
    TASK_ACTIVITY_KINDS.some((kind: TaskActivityKind): boolean => kind === value)
  );
}

/** Label lookup that is safe to call with an unvalidated value. */
export function taskActivityKindLabel(value: unknown): string {
  return isTaskActivityKind(value) ? TASK_ACTIVITY_KIND_LABELS[value] : "";
}
