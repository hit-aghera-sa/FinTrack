import type { ReactElement } from 'react';
import { COPY, type Task } from '../../models/index.js';
import { resolveFooterSummary } from './compat.js';
import type { TaskSummary } from './logic.js';
import { ControlStyles } from './styles.js';

export interface TaskFooterProps {
  /** ALL tasks — the summary is never computed over the filtered view. */
  readonly tasks?: readonly Task[];
  /** Number of tasks still to do, when the owner derived the counts itself. */
  readonly activeCount?: number;
  /** Number of completed tasks, when the owner derived the counts itself. */
  readonly completedCount?: number;
  /**
   * Optional clear-completed action. The control is rendered only when the owner
   * wires this callback AND at least one task is done, so the default footer is
   * exactly the one summary line.
   */
  readonly onClearCompleted?: () => void;
}

/**
 * Renders exactly one line: `N of M tasks done`, counted over every task.
 *
 * Accepts either the full task list or the already-derived active/completed counts;
 * the list wins when both are given.
 */
export function TaskFooter({
  tasks,
  activeCount,
  completedCount,
  onClearCompleted,
}: TaskFooterProps): ReactElement {
  const summary: TaskSummary = resolveFooterSummary(tasks, activeCount, completedCount);
  const showClear = onClearCompleted !== undefined && summary.done > 0;
  return (
    <footer className="controls-footer">
      <ControlStyles />
      <p className="controls-footer__summary" data-testid="task-footer" aria-live="polite">
        {summary.text}
      </p>
      {showClear ? (
        <button type="button" className="btn btn-ghost" onClick={onClearCompleted}>
          {COPY.status.clearCompleted}
        </button>
      ) : null}
    </footer>
  );
}
