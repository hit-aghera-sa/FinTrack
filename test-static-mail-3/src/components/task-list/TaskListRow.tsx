import type { ChangeEvent, ReactElement } from 'react';
import type { Task } from '../../models/task.js';
import { REMOVE_LABEL, toRowView } from './helpers.js';

/** A row's removal callback: it receives the task id and nothing else. */
export type RemoveHandler = (id: string) => void;

/** Props of a single task row. Pure props in, callbacks out. */
export interface TaskListRowProps {
  /** The task rendered by this row. */
  readonly task: Task;
  /** Called with the task id and the NEW completed value when the checkbox changes. */
  readonly onToggle: (id: string, completed: boolean) => void;
  /** Called with the task id when Remove is pressed. No confirmation step. */
  readonly onRemove?: RemoveHandler;
  /**
   * Alias of {@link TaskListRowProps.onRemove} for callers that name the callback
   * `onDelete`. Exactly one of the two should be supplied; `onRemove` wins when both
   * are present.
   */
  readonly onDelete?: RemoveHandler;
}

/**
 * The fallback used when neither removal callback was supplied.
 *
 * Declared WITHOUT parameters on purpose: a zero-argument function is assignable to
 * {@link RemoveHandler}, and an unused named parameter is a lint error under the
 * project's ESLint config.
 */
function ignoreRemove(): void {
  return;
}

/**
 * Pick the removal callback to fire, preferring `onRemove` over the `onDelete` alias.
 * Pure, so the choice is unit-testable without a DOM.
 */
export function resolveRemoveHandler(
  onRemove?: RemoveHandler,
  onDelete?: RemoveHandler,
): RemoveHandler {
  return onRemove ?? onDelete ?? ignoreRemove;
}

/**
 * One task row: a checkbox bound to `completed`, the title (struck through when
 * done) and a small secondary Remove button that fires immediately.
 *
 * Holds no state and performs no I/O.
 */
export function TaskListRow({ task, onToggle, onRemove, onDelete }: TaskListRowProps): ReactElement {
  const view = toRowView(task);
  const remove = resolveRemoveHandler(onRemove, onDelete);
  return (
    <li className={view.rowClass} data-task-id={view.id} data-completed={view.completed ? 'true' : 'false'}>
      <input
        className="task-list__checkbox"
        type="checkbox"
        checked={view.completed}
        aria-label={view.toggleLabel}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onToggle(view.id, event.target.checked)}
      />
      <span className={view.titleClass}>{view.title}</span>
      <button
        type="button"
        className="btn-secondary task-list__remove"
        aria-label={view.removeLabel}
        onClick={() => remove(view.id)}
      >
        {REMOVE_LABEL}
      </button>
    </li>
  );
}
