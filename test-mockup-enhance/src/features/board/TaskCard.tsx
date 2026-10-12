import { Button } from "../../components/Button";
import { Link } from "../../router";
import { PriorityBadge } from "../../ui/PriorityBadge.js";
import { TASK_STATUS_LABELS, type Task, type TaskStatus } from "../../models/task.js";
import {
  checklistProgressLabel,
  type ChecklistProgress,
} from "../../models/checklist/index.js";
import { checklistProgressAriaLabel } from "./boardModel.js";

export interface TaskCardProps {
  task: Task;
  /** The assignee's name, already resolved from the roster. */
  assignee: string;
  /** The due date, already formatted for display. */
  dueDate: string;
  /**
   * This task's checklist progress, taken from the checklist summary the board
   * loaded. A task with no checklist items carries a total of 0, and then the
   * card shows no progress badge at all.
   */
  progress: ChecklistProgress;
  /** The columns this card can be moved to. */
  moveTo: readonly TaskStatus[];
  /** True while this card's move is being saved. */
  moving: boolean;
  onOpen: (taskId: string) => void;
  onMove: (taskId: string, status: TaskStatus) => void;
}

/**
 * One task on the board: its title with the task's priority label beside it,
 * its assignee and due date, an action to open it, and one button per other
 * column to move it there.
 *
 * The priority comes straight off the task payload and is rendered with the
 * shared `PriorityBadge`, which brings the priority colour tokens with it and
 * always spells the level out in words beside a per-level shape.
 *
 * THE CHECKLIST BADGE IS ONLY DRAWN WHEN THERE IS A CHECKLIST. A task with no
 * checklist items has nothing to report, so no badge is rendered — an empty
 * `0/0` chip said nothing and read as noise on the card. When the task does
 * have items the badge reads `done/total` (e.g. `2/5`) and carries an
 * aria-label of the form "N of M checklist items done", so the figure is never
 * a bare number on its own to a screen reader.
 */
export function TaskCard({
  task,
  assignee,
  dueDate,
  progress,
  moveTo,
  moving,
  onOpen,
  onMove,
}: TaskCardProps): JSX.Element {
  const hasChecklist = progress.total > 0;

  return (
    <article className="board-task-card" aria-label={task.title}>
      <div className="board-task-heading">
        <h3 className="board-task-title">
          <Link to={`/tasks/${task.id}`}>{task.title}</Link>
        </h3>
        <PriorityBadge priority={task.priority} />
        {hasChecklist ? (
          <span
            className="board-task-checklist"
            data-testid="checklist-progress"
            aria-label={checklistProgressAriaLabel(progress)}
            title={checklistProgressAriaLabel(progress)}
          >
            {checklistProgressLabel(progress)}
          </span>
        ) : null}
      </div>
      <dl className="board-task-meta">
        <div className="board-task-meta-row">
          <dt>Assignee</dt>
          <dd>{assignee}</dd>
        </div>
        <div className="board-task-meta-row">
          <dt>Due</dt>
          <dd>{dueDate}</dd>
        </div>
      </dl>
      <div className="board-task-actions">
        <Button
          small
          variant="secondary"
          onClick={() => {
            onOpen(task.id);
          }}
        >
          Open
        </Button>
        {moveTo.map((status: TaskStatus) => (
          <Button
            key={status}
            small
            variant="ghost"
            disabled={moving}
            onClick={() => {
              onMove(task.id, status);
            }}
          >
            {`Move to ${TASK_STATUS_LABELS[status]}`}
          </Button>
        ))}
      </div>
      {moving ? (
        <p className="board-task-note" role="status">
          Saving the move…
        </p>
      ) : null}
    </article>
  );
}
