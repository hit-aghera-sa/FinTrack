/**
 * The single-task screen at /tasks/:id.
 *
 * The shell passes the route parameter in as `taskId` and an `onBack` callback
 * that returns to the board. Everything persisted is read and written through
 * the shared browser API client (`src/lib/api`) over same-origin `/api`:
 *
 *   GET   /api/tasks/:id                 the task being viewed
 *   GET   /api/tasks/:id/comments        the thread, in creation order
 *   GET   /api/members                   the roster the assignee select offers
 *   PATCH /api/tasks/:id                 saving the editable fields
 *   POST  /api/tasks/:id/comments        adding a comment
 *
 * The loaded task's priority is shown in the shared `PrioritySelect` among the
 * editable fields, and saving sends it in the PATCH body as part of
 * `TaskUpdate`. The loaded task's LABELS are shown — and edited — with the
 * shared `LabelPicker`, which reads `GET /api/labels` and can create one with
 * `POST /api/labels`; saving sends the whole selection as `labelIds` in the
 * PATCH body, so a label created from inside the picker is attached to this
 * task.
 *
 * The task's CHECKLIST is rendered by `ChecklistPanel`, which owns its own
 * fetch client over `/api/tasks/:id/checklist`.
 *
 * The header also links to this task's ACTIVITY timeline
 * (`/tasks/:id/activity`), which is rendered in every state of this screen.
 *
 * `TaskDetailView` is the same screen with the client injected, which is how
 * the co-located tests drive it with a stub; `TaskDetailPage` is the exported
 * page and binds the real client.
 *
 * The page header and the "Back to board" action are rendered in EVERY state —
 * loading, ready, not found and failed.
 */

import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import { Badge, type BadgeTone } from '../../components/Badge.js';
import { Button, buttonClass } from '../../components/Button.js';
import { EmptyState } from '../../components/EmptyState.js';
import { PageHeader } from '../../components/PageHeader.js';
import { Link } from '../../router.js';
import { ErrorBanner, PrioritySelect } from '../../ui/index.js';
import { taskActivityRoutePath } from '../activity/index.js';
import { LabelPicker } from '../labels/index.js';
import { ApiError, api, type BoardApi } from '../../lib/api/index.js';
import type { TaskComment } from '../../models/comment.js';
import type { TeamMemberWithWorkload } from '../../models/member.js';
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  isTaskStatus,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskUpdate,
} from '../../models/task.js';
import { ChecklistPanel } from './ChecklistPanel.js';
import './TaskDetailPage.css';

/** Exactly the API calls this screen makes. The shipped `api` satisfies it. */
export type TaskDetailApi = Pick<
  BoardApi,
  'getTask' | 'listComments' | 'listMembers' | 'updateTask' | 'addComment'
>;

export interface TaskDetailPageProps {
  taskId: string;
  onBack: () => void;
}

export interface TaskDetailViewProps extends TaskDetailPageProps {
  /** The API client the screen talks to. */
  client: TaskDetailApi;
}

/** What the editable controls hold while being edited. */
interface TaskForm {
  title: string;
  description: string;
  assigneeId: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
}

type LoadState = 'loading' | 'ready' | 'missing' | 'failed';

const EMPTY_FORM: TaskForm = {
  title: '',
  description: '',
  assigneeId: '',
  dueDate: '',
  status: DEFAULT_TASK_STATUS,
  priority: DEFAULT_TASK_PRIORITY,
};

const STATUS_TONES: Record<TaskStatus, BadgeTone> = {
  todo: 'info',
  doing: 'warning',
  done: 'success',
};

function toForm(task: Task): TaskForm {
  return {
    title: task.title,
    description: task.description,
    assigneeId: task.assigneeId ?? '',
    dueDate: task.dueDate ?? '',
    status: task.status,
    priority: task.priority,
  };
}

/**
 * The ids of the labels a task carries. The repositories and the HTTP API
 * always populate `labels`; it is read defensively so a payload written before
 * labels existed simply has none.
 */
function labelIdsOf(task: Task): string[] {
  return (task.labels ?? []).map((label) => label.id);
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return fallback;
}

/** A readable stamp for a comment. Falls back to the raw value if unparseable. */
function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

/** "No comments yet", "1 comment", "4 comments" — never a bare figure on its own. */
function threadSummary(count: number): string {
  if (count === 0) {
    return 'No comments yet';
  }
  return count === 1 ? '1 comment' : `${String(count)} comments`;
}

export function TaskDetailView({ taskId, onBack, client }: TaskDetailViewProps): JSX.Element {
  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string>('');
  const [task, setTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<TeamMemberWithWorkload[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setState('loading');
    setLoadError('');
    try {
      const loadedTask = await client.getTask(taskId);
      const [loadedComments, loadedMembers] = await Promise.all([
        client.listComments(taskId),
        client.listMembers(),
      ]);
      setTask(loadedTask);
      setForm(toForm(loadedTask));
      setLabelIds(labelIdsOf(loadedTask));
      setComments(loadedComments);
      setMembers(loadedMembers);
      setState('ready');
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        setTask(null);
        setState('missing');
        return;
      }
      setLoadError(messageOf(error, 'This task could not be loaded.'));
      setState('failed');
    }
  }, [client, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateField = <Key extends keyof TaskForm>(key: Key, value: TaskForm[Key]): void => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next: string = event.target.value;
    if (isTaskStatus(next)) {
      updateField('status', next);
    }
  };

  /**
   * The picker hands back the whole selection — including a label it has just
   * created, which is therefore attached to this task the moment it exists.
   * Declared as `readonly string[]` so it fits a picker that passes either a
   * mutable or a readonly array.
   */
  const handleLabelsChange = (ids: readonly string[]): void => {
    setLabelIds([...ids]);
    setSaved(false);
  };

  async function saveChanges(): Promise<void> {
    const title = form.title.trim();
    if (title === '') {
      setTitleError('Enter a title for this task.');
      return;
    }
    setTitleError(null);
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    const patch: TaskUpdate = {
      title,
      description: form.description,
      assigneeId: form.assigneeId === '' ? null : form.assigneeId,
      dueDate: form.dueDate === '' ? null : form.dueDate,
      status: form.status,
      priority: form.priority,
      labelIds: [...labelIds],
    };
    try {
      const updated = await client.updateTask(taskId, patch);
      setTask(updated);
      setForm(toForm(updated));
      if (updated.labels !== undefined) {
        setLabelIds(labelIdsOf(updated));
      }
      setSaved(true);
    } catch (error: unknown) {
      setSaveError(messageOf(error, 'These changes could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  async function postComment(): Promise<void> {
    const body = commentBody.trim();
    if (body === '') {
      setCommentError('Write a comment before adding it.');
      return;
    }
    setCommentError(null);
    setAdding(true);
    try {
      const created = await client.addComment(taskId, body);
      setComments((current) => [...current, created]);
      setCommentBody('');
    } catch (error: unknown) {
      setCommentError(messageOf(error, 'This comment could not be added.'));
    } finally {
      setAdding(false);
    }
  }

  const handleSaveSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void saveChanges();
  };

  const handleCommentSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void postComment();
  };

  const resetForm = (): void => {
    if (task !== null) {
      setForm(toForm(task));
      setLabelIds(labelIdsOf(task));
      setTitleError(null);
      setSaveError(null);
      setSaved(false);
    }
  };

  const headerDescription = task === null ? 'Viewing and editing a single task.' : task.title;

  let body: JSX.Element;
  if (state === 'loading') {
    body = (
      <section className="card" aria-label="Loading task">
        <div className="card-body">
          <p className="task-detail-note" role="status">
            Loading this task and its comments…
          </p>
        </div>
      </section>
    );
  } else if (state === 'missing') {
    body = (
      <EmptyState
        title="Task not found"
        message="This task may have been removed. Open the board to pick another one."
        action={
          <Button variant="primary" onClick={onBack}>
            Open the board
          </Button>
        }
      />
    );
  } else if (state === 'failed' || task === null) {
    body = (
      <ErrorBanner
        message={loadError === '' ? 'This task could not be loaded.' : loadError}
        onRetry={() => {
          void load();
        }}
      />
    );
  } else {
    const statusLabel = TASK_STATUS_LABELS[task.status];
    body = (
      <>
        <section className="card" aria-label="Edit task">
          <div className="card-header">
            <span className="card-title">Edit task</span>
            <span
              className="task-detail-status"
              data-testid="task-detail-status"
              aria-label={`Current status: ${statusLabel}`}
            >
              <Badge tone={STATUS_TONES[task.status]}>{statusLabel}</Badge>
            </span>
          </div>
          <div className="card-body">
            <form className="form" noValidate onSubmit={handleSaveSubmit}>
              <div className="field">
                <label className="field-label" htmlFor="td-title">
                  Title
                </label>
                <input
                  className="input"
                  id="td-title"
                  type="text"
                  value={form.title}
                  aria-invalid={titleError !== null ? true : undefined}
                  onChange={(event) => {
                    updateField('title', event.target.value);
                  }}
                />
                {titleError !== null ? (
                  <span className="task-detail-field-error" role="alert">
                    {titleError}
                  </span>
                ) : null}
              </div>

              <div className="field">
                <label className="field-label" htmlFor="td-desc">
                  Description
                </label>
                <textarea
                  className="input"
                  id="td-desc"
                  rows={4}
                  value={form.description}
                  onChange={(event) => {
                    updateField('description', event.target.value);
                  }}
                />
              </div>

              <div className="task-detail-row">
                <div className="field">
                  <label className="field-label" htmlFor="td-assignee">
                    Assignee
                  </label>
                  <select
                    className="input"
                    id="td-assignee"
                    value={form.assigneeId}
                    onChange={(event) => {
                      updateField('assigneeId', event.target.value);
                    }}
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="td-due">
                    Due date
                  </label>
                  <input
                    className="input"
                    id="td-due"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => {
                      updateField('dueDate', event.target.value);
                    }}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="td-status">
                    Status
                  </label>
                  <select
                    className="input"
                    id="td-status"
                    value={form.status}
                    onChange={handleStatusChange}
                  >
                    {TASK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {TASK_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>

                <PrioritySelect
                  id="td-priority"
                  value={form.priority}
                  disabled={saving}
                  onChange={(next: TaskPriority) => {
                    updateField('priority', next);
                  }}
                />
              </div>

              <div className="field" data-testid="task-detail-labels">
                <span className="field-label">Labels</span>
                <LabelPicker selectedIds={labelIds} onChange={handleLabelsChange} />
              </div>

              {saveError !== null ? <ErrorBanner message={saveError} /> : null}
              {saved ? (
                <p className="task-detail-saved" role="status">
                  Changes saved.
                </p>
              ) : null}

              <div className="form-actions">
                <Button type="submit" variant="primary" disabled={saving}>
                  Save changes
                </Button>
                <Button variant="secondary" onClick={resetForm} disabled={saving}>
                  Undo edits
                </Button>
              </div>
            </form>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <span className="card-title">Comments</span>
            <span className="task-detail-comment-count">{threadSummary(comments.length)}</span>
          </div>
          <div className="card-body">
            {comments.length === 0 ? (
              <p className="task-detail-note">
                No comments yet. Add the first note so the team can follow this task.
              </p>
            ) : (
              <ul className="task-detail-comments">
                {comments.map((comment) => (
                  <li key={comment.id} className="task-detail-comment">
                    <p className="task-detail-comment-body">{comment.body}</p>
                    <p className="task-detail-comment-meta">{formatTimestamp(comment.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}

            <form className="form" noValidate onSubmit={handleCommentSubmit}>
              <div className="field">
                <label className="field-label" htmlFor="td-comment">
                  Add a comment
                </label>
                <textarea
                  className="input"
                  id="td-comment"
                  rows={3}
                  placeholder="Share an update on this task…"
                  value={commentBody}
                  onChange={(event) => {
                    setCommentBody(event.target.value);
                  }}
                />
                {commentError !== null ? (
                  <span className="task-detail-field-error" role="alert">
                    {commentError}
                  </span>
                ) : null}
              </div>
              <div className="form-actions">
                <Button type="submit" variant="primary" disabled={adding}>
                  Add comment
                </Button>
              </div>
            </form>
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="task-detail">
      <PageHeader
        title="Task detail"
        description={headerDescription}
        actions={
          <>
            <Link className={buttonClass('secondary')} to={taskActivityRoutePath(taskId)}>
              Activity
            </Link>
            <Button variant="secondary" onClick={onBack}>
              Back to board
            </Button>
          </>
        }
      />
      {body}
      <ChecklistPanel taskId={taskId} />
    </div>
  );
}

/** The page the shell registers for /tasks/:id, bound to the real API client. */
export function TaskDetailPage({ taskId, onBack }: TaskDetailPageProps): JSX.Element {
  return <TaskDetailView taskId={taskId} onBack={onBack} client={api} />;
}
