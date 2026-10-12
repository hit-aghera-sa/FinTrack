/**
 * Shared comment domain types. Comments carry no author attribution.
 */

export interface TaskComment {
  id: string;
  taskId: string;
  body: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

export interface NewComment {
  body: string;
}
