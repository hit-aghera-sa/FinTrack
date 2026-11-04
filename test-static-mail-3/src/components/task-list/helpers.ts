/**
 * Pure presentation helpers for the task list.
 *
 * Kept free of React so they can be unit-tested directly and reused by any screen
 * that renders task rows. All user-facing wording comes from the shared copy
 * contract; the Task shape comes from the shared domain model.
 */
import { COPY } from '../../models/copy.js';
import type { Task } from '../../models/task.js';

/** Root class of the list element. */
export const TASK_LIST_CLASS = 'task-list';

/** Visible label of the destructive (no-confirmation) action. */
export const REMOVE_LABEL = 'Remove';

/** Class list for a single row, marking the completed variant. */
export function rowClassName(completed: boolean): string {
  return completed ? 'task-list__row card task-list__row--done' : 'task-list__row card';
}

/** Class list for the title, adding the strikethrough variant when done. */
export function titleClassName(completed: boolean): string {
  return completed ? 'task-list__title task-list__title--done' : 'task-list__title';
}

/** Accessible label for the row checkbox. */
export function toggleLabel(title: string): string {
  return COPY.item.toggle(title);
}

/** Accessible label for the row's Remove button. */
export function removeLabel(title: string): string {
  return COPY.item.delete(title);
}

/** Everything a row needs to render, derived from a task. */
export interface TaskRowView {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly rowClass: string;
  readonly titleClass: string;
  readonly toggleLabel: string;
  readonly removeLabel: string;
}

/** Build the row view model for a task. Order of the input is preserved by callers. */
export function toRowView(task: Task): TaskRowView {
  return {
    id: task.id,
    title: task.title,
    completed: task.completed,
    rowClass: rowClassName(task.completed),
    titleClass: titleClassName(task.completed),
    toggleLabel: toggleLabel(task.title),
    removeLabel: removeLabel(task.title),
  };
}

/**
 * Map a list of tasks to row view models, PRESERVING the given order.
 * The list is rendered exactly as supplied (the caller sorts newest first).
 */
export function toRowViews(tasks: readonly Task[]): TaskRowView[] {
  return tasks.map(toRowView);
}
