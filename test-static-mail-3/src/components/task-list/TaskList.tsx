import type { ReactElement } from 'react';
import { COPY } from '../../models/copy.js';
import type { Task } from '../../models/task.js';
import { TASK_LIST_CLASS } from './helpers.js';
import { TASK_LIST_CSS, TASK_LIST_STYLE_ID } from './styles.js';
import { TaskListRow } from './TaskListRow.js';
import type { RemoveHandler } from './TaskListRow.js';

/** Props of the presentational task list. */
export interface TaskListProps {
  /** Tasks rendered in the order given (the caller supplies them newest first). */
  readonly tasks: readonly Task[];
  /** Called with the task id and the NEW completed value when a checkbox changes. */
  readonly onToggle: (id: string, completed: boolean) => void;
  /** Called with the task id when a row's Remove button is pressed. */
  readonly onRemove?: RemoveHandler;
  /**
   * Alias of {@link TaskListProps.onRemove} for callers that name the callback
   * `onDelete`. Exactly one of the two should be supplied; `onRemove` wins when both
   * are present.
   */
  readonly onDelete?: RemoveHandler;
  /** Message shown when `tasks` is empty. Defaults to the shared copy for "all". */
  readonly emptyMessage?: string;
  /** Accessible label of the list. Defaults to the shared copy. */
  readonly label?: string;
}

/**
 * The task list: one row per task, rendered in the order given, keyed by `task.id`.
 *
 * Purely presentational — no local state, no fetching. Its stylesheet is rendered
 * beside the markup so every class it emits resolves to a real rule in the bundle.
 */
export function TaskList({
  tasks,
  onToggle,
  onRemove,
  onDelete,
  emptyMessage = COPY.empty.all,
  label = COPY.listLabel,
}: TaskListProps): ReactElement {
  return (
    <>
      <style id={TASK_LIST_STYLE_ID}>{TASK_LIST_CSS}</style>
      {tasks.length === 0 ? (
        <p className="state-empty task-list__empty" data-testid="task-list-empty">
          {emptyMessage}
        </p>
      ) : (
        <ul className={TASK_LIST_CLASS} aria-label={label} data-testid="task-list">
          {tasks.map((task) => (
            <TaskListRow
              key={task.id}
              task={task}
              onToggle={onToggle}
              onRemove={onRemove}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </>
  );
}
