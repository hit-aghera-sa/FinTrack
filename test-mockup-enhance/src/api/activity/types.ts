/**
 * The activity payloads of a task's feed, declared exactly once for the whole
 * project.
 *
 * The HTTP router serialises these and the task screen reads them, so the field
 * names below are the wire contract of `GET /api/tasks/:taskId/activity`.
 */

/** Every kind of entry the feed can hold. */
export const TASK_ACTIVITY_KINDS = [
  "task_created",
  "status_changed",
  "priority_changed",
  "assignee_changed",
  "labels_changed",
  "field_changed",
  "comment_added",
  "task_deleted",
] as const;

export type TaskActivityKind = (typeof TASK_ACTIVITY_KINDS)[number];

/** Narrowing guard for untrusted input (query strings, request bodies). */
export function isTaskActivityKind(value: unknown): value is TaskActivityKind {
  return (
    typeof value === "string" &&
    TASK_ACTIVITY_KINDS.some((kind: TaskActivityKind): boolean => kind === value)
  );
}

/** One recorded thing that happened to a task. */
export interface TaskActivity {
  id: string;
  taskId: string;
  kind: TaskActivityKind;
  /**
   * The task field the entry is about (`"status"`, `"title"`, …), or null for
   * an entry that is not about one field (a creation, a comment, a deletion).
   */
  field: string | null;
  /** The value before the change, as text, or null when there was none. */
  fromValue: string | null;
  /** The value after the change, as text, or null when there is none. */
  toValue: string | null;
  /**
   * WHO THE ENTRY IS ATTRIBUTED TO, as a readable name — the team member the
   * task belongs to, never an id. This product has no accounts, so a task
   * nobody is assigned to is attributed to the board itself; it is null only
   * for a row written before this field existed. The timeline shows this name,
   * so an entry that arrives without one reads as a nameless "Someone".
   */
  actor: string | null;
  /** A human-readable sentence, ready to render. */
  message: string;
  /** ISO-8601 timestamp of the moment the entry was recorded. */
  createdAt: string;
}

/** An entry as it is handed to the store: the id and the stamp are its job. */
export interface NewTaskActivity {
  taskId: string;
  kind: TaskActivityKind;
  field?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  /** The name the entry is attributed to. Absent is stored as null. */
  actor?: string | null;
  message: string;
}

/**
 * The most entries one read may ask for. A larger `?limit` is clamped to this
 * rather than refused, so a feed request can never ask the store for an
 * unbounded page.
 */
export const MAX_ACTIVITY_LIMIT = 200;
