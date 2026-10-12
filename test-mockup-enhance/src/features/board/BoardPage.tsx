import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../ui/ErrorBanner.js";
import { api as boardApi, type BoardApi } from "../../lib/api/client.js";
import type { Task, TaskStatus } from "../../models/task.js";
import type { TeamMemberWithWorkload } from "../../models/member.js";
import type { ChecklistProgress } from "../../models/checklist/index.js";
import {
  checklistSummaryClient,
  type ChecklistSummaryClient,
} from "./checklistSummaryClient.js";
import { BoardStyles } from "./BoardStyles.js";
import { TaskCard } from "./TaskCard.js";
import {
  assigneeName,
  buildColumns,
  checklistProgressFor,
  describeError,
  formatDueDate,
  moveTargets,
  replaceTask,
  taskCountLabel,
  type BoardColumn,
} from "./boardModel.js";

/**
 * The board screen's contract with the shell: opening a card and the
 * "Add task" action are raised to the host, which owns navigation to
 * `/tasks/:id` and `/tasks/new`.
 */
export interface BoardPageProps {
  onOpenTask: (taskId: string) => void;
  onAddTask: () => void;
}

/** The same screen with the API client injected — used by this lane's tests. */
export interface BoardPageWithApiProps extends BoardPageProps {
  api: BoardApi;
  /**
   * Where the checklist progress counts come from. Defaults to the real
   * same-origin `GET /api/checklist/summary` client; the unit tests pass a
   * stub.
   */
  checklist?: ChecklistSummaryClient;
}

const LOAD_FALLBACK = "The board could not be loaded.";
const MOVE_FALLBACK = "The task could not be moved.";

/**
 * The three-column board.
 *
 * Reads every task from `GET /api/tasks` and the roster from `GET /api/members`
 * through the shared browser client, groups the tasks into To do / Doing / Done
 * (every column drawn even when empty), and persists a move with
 * `PATCH /api/tasks/:id`, re-rendering the card in its new column from the
 * server's response — no page reload.
 *
 * Alongside the task list it reads the checklist progress counts from
 * `GET /api/checklist/summary`, so every card can show its own `done/total`
 * badge; a task with no checklist items shows `0/0`, and a summary that cannot
 * be read leaves every badge at `0/0` rather than breaking the board.
 */
export function BoardPageWithApi({
  api,
  checklist = checklistSummaryClient,
  onOpenTask,
  onAddTask,
}: BoardPageWithApiProps): JSX.Element {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [members, setMembers] = useState<TeamMemberWithWorkload[]>([]);
  const [progress, setProgress] = useState<ChecklistProgress[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);

    const load = async (): Promise<void> => {
      try {
        const [loadedTasks, loadedMembers, loadedProgress] = await Promise.all([
          api.listTasks(),
          api.listMembers(),
          // The checklist counts are a decoration on the cards: a summary that
          // cannot be read must never stop the board from rendering.
          checklist.listProgress().catch((): ChecklistProgress[] => []),
        ]);
        if (!active) {
          return;
        }
        setTasks(loadedTasks);
        setMembers(loadedMembers);
        setProgress(loadedProgress);
        setLoadError(null);
      } catch (error: unknown) {
        if (!active) {
          return;
        }
        setTasks(null);
        setLoadError(describeError(error, LOAD_FALLBACK));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [api, checklist, attempt]);

  const retry = useCallback((): void => {
    setAttempt((value: number): number => value + 1);
  }, []);

  const moveTask = useCallback(
    async (taskId: string, status: TaskStatus): Promise<void> => {
      setMovingId(taskId);
      setMoveError(null);
      try {
        const updated = await api.updateTask(taskId, { status });
        setTasks((current: Task[] | null): Task[] | null =>
          current === null ? current : replaceTask(current, updated),
        );
      } catch (error: unknown) {
        setMoveError(describeError(error, MOVE_FALLBACK));
      } finally {
        setMovingId(null);
      }
    },
    [api],
  );

  const handleMove = useCallback(
    (taskId: string, status: TaskStatus): void => {
      void moveTask(taskId, status);
    },
    [moveTask],
  );

  const columns: BoardColumn[] = useMemo(() => buildColumns(tasks ?? []), [tasks]);
  const boardIsEmpty = !loading && loadError === null && tasks !== null && tasks.length === 0;

  return (
    <div className="board-page">
      <BoardStyles />

      <header className="page-header">
        <div>
          <h1 className="page-title">Board</h1>
          <p className="page-description">
            All tasks for the team, grouped by status. Move a card between columns or open it for
            details.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={onAddTask}>
            + Add task
          </Button>
        </div>
      </header>

      {loadError !== null ? <ErrorBanner message={loadError} onRetry={retry} /> : null}
      {moveError !== null ? <ErrorBanner message={moveError} /> : null}

      {loading ? (
        <p className="board-state" role="status">
          Loading the board…
        </p>
      ) : null}

      {boardIsEmpty ? (
        <EmptyState
          title="No tasks on the board yet"
          message="Tasks you add appear in the To do column. Use Add task to create the first one."
          action={
            <Button variant="primary" onClick={onAddTask}>
              + Add task
            </Button>
          }
        />
      ) : null}

      <div className="board-grid">
        {columns.map((column: BoardColumn) => (
          <section key={column.status} className="board-column" aria-label={column.label}>
            <div className="board-column-head">
              <h2 className="board-column-title">{column.label}</h2>
              <span className="board-column-count">{taskCountLabel(column.tasks.length)}</span>
            </div>
            <ul className="board-column-stack">
              {column.tasks.length === 0 ? (
                <li className="board-column-empty">
                  {loading
                    ? `Loading ${column.label}…`
                    : `Nothing in ${column.label} at the moment.`}
                </li>
              ) : (
                column.tasks.map((task: Task) => (
                  <li key={task.id}>
                    <TaskCard
                      task={task}
                      assignee={assigneeName(members, task.assigneeId)}
                      dueDate={formatDueDate(task.dueDate)}
                      progress={checklistProgressFor(progress, task.id)}
                      moveTo={moveTargets(task.status)}
                      moving={movingId === task.id}
                      onOpen={onOpenTask}
                      onMove={handleMove}
                    />
                  </li>
                ))
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * The board page as the shell mounts it: the same screen wired to the real
 * same-origin API client, so every read and every move goes to the backend.
 */
export function BoardPage(props: BoardPageProps): JSX.Element {
  return (
    <BoardPageWithApi api={boardApi} onOpenTask={props.onOpenTask} onAddTask={props.onAddTask} />
  );
}
