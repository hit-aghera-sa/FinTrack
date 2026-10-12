/**
 * THE TASK ACTIVITY SCREEN (`/tasks/:id/activity`).
 *
 * Shows one task's activity timeline, read from the real backend through the
 * lane's `TaskActivityClient` (`GET /api/tasks/:taskId/activity`), and offers a
 * back action to that task's detail route. The heading and the back action are
 * rendered in EVERY state — loading, ready, empty and failed — so the page is
 * never a blank area.
 *
 * The client is injectable so the co-located tests can drive the screen with a
 * stub; callers never need to supply it.
 */

import { useEffect, useState } from 'react';

import { Button } from '../../components/Button.js';
import { PageHeader } from '../../components/PageHeader.js';
import { ApiError } from '../../lib/api/index.js';
import { ActivityTimeline } from './ActivityTimeline.js';
import { taskActivityClient, type TaskActivityClient } from './TaskActivityClient.js';
import type { TaskActivity } from './activityModel.js';
import './activity.css';

/** The page's heading. */
export const TASK_ACTIVITY_TITLE = 'Activity';

/** Shown when the task itself does not exist. */
export const TASK_ACTIVITY_NOT_FOUND = 'That task could not be found, so it has no activity to show.';

/** Shown when the server cannot be reached at all. */
export const TASK_ACTIVITY_OFFLINE = 'The server could not be reached. Check your connection and try again.';

export interface TaskActivityScreenProps {
  /** The task whose activity is shown, from the route's `:id` part. */
  taskId: string;
  /** Goes back to this task's detail screen. */
  onBack: () => void;
  /** The client the screen reads through. Defaults to the shared one. */
  client?: TaskActivityClient;
}

/** Turns an unknown rejection into a sentence worth showing. */
function describeFailure(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return TASK_ACTIVITY_NOT_FOUND;
    }
    if (error.status === 0) {
      return TASK_ACTIVITY_OFFLINE;
    }
    return error.message;
  }
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return 'This activity could not be loaded.';
}

/** "1 entry", "4 entries" — never a bare figure on its own. */
function countLabel(count: number): string {
  return count === 1 ? '1 entry' : `${String(count)} entries`;
}

export function TaskActivityScreen({
  taskId,
  onBack,
  client = taskActivityClient,
}: TaskActivityScreenProps): JSX.Element {
  const [entries, setEntries] = useState<readonly TaskActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void client
      .listActivity(taskId)
      .then((loaded: TaskActivity[]) => {
        if (!active) {
          return;
        }
        setEntries(loaded);
        setLoading(false);
      })
      .catch((failure: unknown) => {
        if (!active) {
          return;
        }
        setError(describeFailure(failure));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, taskId, attempt]);

  const retry = (): void => {
    setAttempt((value: number): number => value + 1);
  };

  const showCount = !loading && error === null && entries.length > 0;

  return (
    <div className="task-activity" data-screen="/tasks/:id/activity">
      <PageHeader
        title={TASK_ACTIVITY_TITLE}
        description="Everything that has happened to this task, newest first."
        actions={
          <Button variant="secondary" onClick={onBack}>
            Back to task
          </Button>
        }
      />

      <section className="card" aria-label="Activity timeline">
        <div className="card-header">
          <span className="card-title">Activity timeline</span>
          {showCount ? <span className="task-activity-count">{countLabel(entries.length)}</span> : null}
        </div>
        <div className="card-body">
          <ActivityTimeline entries={entries} loading={loading} error={error} onRetry={retry} />
        </div>
      </section>
    </div>
  );
}

export default TaskActivityScreen;
