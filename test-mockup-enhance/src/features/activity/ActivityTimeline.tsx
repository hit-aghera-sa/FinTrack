/**
 * THE REUSABLE ACTIVITY TIMELINE.
 *
 * Renders a task's activity as a reverse-chronological list: an icon and a
 * written label for each kind, the change summary with its `from \u2192 to`
 * values (or the sentence the backend recorded), the actor and a relative
 * timestamp (with the full stamp as its title). It also renders the three
 * states the feature owes a reader:
 *
 *   • loading  — while the entries are on their way;
 *   • empty    — "No activity yet", saying what will appear there;
 *   • error    — the failure, with a way to try again.
 *
 * The label and the icon are resolved per ENTRY, so an entry recorded under the
 * backend's own spelling of a kind (or one that only names the field it
 * changed) still reads correctly instead of falling back to "Task updated".
 *
 * The component is presentational: the caller owns the fetching. Styling uses
 * the app's shared classes and the rules in activity.css beside this file.
 */

import { Button } from '../../components/Button.js';
import { EmptyState } from '../../components/EmptyState.js';
import {
  absoluteTime,
  activityActorName,
  activityEntryIcon,
  activityEntryLabel,
  changeSummary,
  relativeTime,
  sortNewestFirst,
  type TaskActivity,
} from './activityModel.js';
import './activity.css';

/** The words the empty state opens with. */
export const NO_ACTIVITY_TITLE = 'No activity yet';

/** The words the loading state shows. */
export const ACTIVITY_LOADING_TEXT = 'Loading the activity\u2026';

export interface ActivityTimelineProps {
  /** The entries to show, in any order; the list is drawn newest first. */
  entries: readonly TaskActivity[];
  /** True while the entries are being loaded. */
  loading?: boolean;
  /** The failure to show instead of the list, when there is one. */
  error?: string | null;
  /** Offered beside an error, when the caller can try again. */
  onRetry?: () => void;
  /** Reference point for the relative timestamps. Defaults to the current time. */
  now?: number;
}

export function ActivityTimeline({
  entries,
  loading = false,
  error = null,
  onRetry,
  now,
}: ActivityTimelineProps): JSX.Element {
  if (loading) {
    return (
      <p className="activity-note" role="status">
        {ACTIVITY_LOADING_TEXT}
      </p>
    );
  }

  if (error !== null && error !== '') {
    return (
      <div className="activity-error">
        <p className="notice notice-danger" role="alert">
          {error}
        </p>
        {onRetry !== undefined ? (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        title={NO_ACTIVITY_TITLE}
        message="Status moves, edits and comments on this task will appear here, newest first."
      />
    );
  }

  const at = now ?? Date.now();

  return (
    <ol className="activity-timeline">
      {sortNewestFirst(entries).map((entry: TaskActivity) => {
        const summary = changeSummary(entry);
        return (
          <li className="activity-entry" key={entry.id} data-kind={entry.kind}>
            <span className="activity-entry-icon" aria-hidden="true">
              {activityEntryIcon(entry)}
            </span>
            <div className="activity-entry-body">
              <p className="activity-entry-label">{activityEntryLabel(entry)}</p>
              {summary !== null ? <p className="activity-entry-change">{summary}</p> : null}
              <p className="activity-entry-meta">
                <span className="activity-entry-actor">{activityActorName(entry)}</span>
                <time
                  dateTime={entry.createdAt === '' ? undefined : entry.createdAt}
                  title={absoluteTime(entry.createdAt)}
                >
                  {relativeTime(entry.createdAt, at)}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
