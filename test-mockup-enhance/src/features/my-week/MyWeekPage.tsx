/**
 * THE "MY WEEK" SCREEN (`/my-week`).
 *
 * Everything due within the next 7 days, read from the existing
 * `GET /api/tasks` and grouped in the browser: an OVERDUE group first (due
 * before today, status not Done, drawn in the danger tokens), then Today,
 * Tomorrow, and one weekday-named group per remaining calendar day of the
 * window, in chronological order. A day with no tasks produces no heading, and
 * with nothing to show at all the page says "Nothing due this week".
 *
 * Each row shows the task title, the assignee's name, the priority and the
 * status. Clicking a row only raises `onOpenTask` with the task id: the shell
 * decides where that goes (`/tasks/:id`), so this page performs no navigation
 * of its own and stays a presentational unit.
 *
 * `MyWeekView` is the same screen with the reader and the clock injected,
 * which is how the co-located tests drive it; `MyWeekPage` is the registered
 * page and binds the real reader.
 */

import { useEffect, useMemo, useState } from 'react';

import { Badge, type BadgeTone } from '../../components/Badge.js';
import { buttonClass } from '../../components/Button.js';
import { EmptyState } from '../../components/EmptyState.js';
import { PageHeader } from '../../components/PageHeader.js';
import { Link } from '../../router.js';
import { ErrorBanner, priorityBadgeClass, priorityLabel, prioritySlug } from '../../ui/index.js';
import { TASK_STATUS_LABELS, type Task, type TaskStatus, type TeamMemberWithWorkload } from '../../models/index.js';
import { myWeekClient, type MyWeekTasksClient } from './myWeekClient.js';
import {
  MY_WEEK_EMPTY_TEXT,
  assigneeNameOf,
  dueText,
  groupSummary,
  groupTasksForWeek,
  type MyWeekGroup,
} from './myWeekModel.js';
import './MyWeekPage.css';

/** The page as the shell registers it. */
export interface MyWeekPageProps {
  /** Raised with the clicked task's id so the shell opens its detail page. */
  onOpenTask: (taskId: string) => void;
}

/** The same screen with its reader and its clock supplied. */
export interface MyWeekViewProps extends MyWeekPageProps {
  /** Where the tasks and the roster are read from. */
  client: MyWeekTasksClient;
  /** The moment "today" is measured from. Defaults to the real clock. */
  now?: () => Date;
}

type LoadState = 'loading' | 'ready' | 'failed';

const STATUS_TONES: Record<TaskStatus, BadgeTone> = {
  todo: 'info',
  doing: 'warning',
  done: 'success',
};

const LOAD_FALLBACK = 'This week could not be loaded.';

/** The wording shown for a failure: the server's own message wins. */
function describeFailure(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return LOAD_FALLBACK;
}

export function MyWeekView({ onOpenTask, client, now }: MyWeekViewProps): JSX.Element {
  // The clock is read once, when the screen mounts, so a re-render never
  // reshuffles the groups under the reader's hands.
  const [today] = useState<Date>(() => (now === undefined ? new Date() : now()));
  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMemberWithWorkload[]>([]);
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    let active = true;
    setState('loading');
    setLoadError('');

    const roster = client
      .listMembers()
      .catch((): TeamMemberWithWorkload[] => []);

    void client
      .listTasks()
      .then(async (loadedTasks: Task[]): Promise<void> => {
        const loadedMembers = await roster;
        if (!active) {
          return;
        }
        setTasks(loadedTasks);
        setMembers(loadedMembers);
        setState('ready');
      })
      .catch((error: unknown): void => {
        if (!active) {
          return;
        }
        setTasks([]);
        setLoadError(describeFailure(error));
        setState('failed');
      });

    return (): void => {
      active = false;
    };
  }, [client, attempt]);

  const groups = useMemo<MyWeekGroup[]>(
    () => groupTasksForWeek(tasks, today),
    [tasks, today],
  );

  let body: JSX.Element;
  if (state === 'loading') {
    body = (
      <p className="notice" role="status">
        Loading everything due this week…
      </p>
    );
  } else if (state === 'failed') {
    body = (
      <ErrorBanner
        message={loadError === '' ? LOAD_FALLBACK : loadError}
        onRetry={(): void => {
          setAttempt((count: number): number => count + 1);
        }}
      />
    );
  } else if (groups.length === 0) {
    body = (
      <EmptyState
        title={MY_WEEK_EMPTY_TEXT}
        message="Tasks due in the next 7 days, and anything already past its due date, will appear here grouped by day."
        action={
          <Link className={buttonClass('primary')} to="/">
            Open the board
          </Link>
        }
      />
    );
  } else {
    body = (
      <div className="my-week-groups">
        {groups.map((group: MyWeekGroup) => (
          <section
            key={group.key}
            className={group.overdue ? 'my-week-group my-week-group--overdue' : 'my-week-group'}
            data-testid="my-week-group"
            data-group-key={group.key}
            data-group-label={group.label}
            data-overdue={group.overdue ? 'yes' : 'no'}
            aria-label={group.label}
          >
            <div className="my-week-group-head">
              <h2 className="my-week-group-title">{group.label}</h2>
              <span className="my-week-group-note">{groupSummary(group)}</span>
            </div>
            <ul className="my-week-rows">
              {group.tasks.map((task: Task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className="my-week-row"
                    data-testid="my-week-row"
                    data-task-id={task.id}
                    onClick={(): void => {
                      onOpenTask(task.id);
                    }}
                  >
                    <span className="my-week-row-main">
                      <span className="my-week-row-title">{task.title}</span>
                      <span className="my-week-row-meta">
                        <span className="my-week-row-assignee">
                          {assigneeNameOf(task, members)}
                        </span>
                        <span className="my-week-row-due">{dueText(task)}</span>
                      </span>
                    </span>
                    <span className="my-week-row-badges">
                      <span
                        className={priorityBadgeClass(task.priority)}
                        data-priority={prioritySlug(task.priority)}
                      >
                        <span className="ui-priority-badge__mark" aria-hidden="true" />
                        <span className="ui-priority-badge__text">
                          {priorityLabel(task.priority)}
                        </span>
                      </span>
                      <Badge tone={STATUS_TONES[task.status]}>
                        {TASK_STATUS_LABELS[task.status]}
                      </Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="my-week" data-screen="/my-week">
      <PageHeader
        title="My week"
        description="Everything due in the next 7 days, grouped by the day it is due — anything already past its due date comes first."
        actions={
          <Link className={buttonClass('secondary')} to="/">
            Board
          </Link>
        }
      />
      {body}
    </div>
  );
}

/** The page the shell registers for /my-week, bound to the real reader. */
export function MyWeekPage({ onOpenTask }: MyWeekPageProps): JSX.Element {
  return <MyWeekView onOpenTask={onOpenTask} client={myWeekClient} />;
}
