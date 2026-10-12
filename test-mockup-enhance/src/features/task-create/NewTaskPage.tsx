/**
 * THE CREATE-TASK SCREEN (`/tasks/new`).
 *
 * The form captures Title, Description, Assignee, Due date, Status, Priority
 * and Labels.
 *
 *   • Assignee is restricted to the current team members, loaded from the real
 *     backend through the shared browser API client (`GET /api/members`).
 *   • Status is restricted to To do / Doing / Done and defaults to To do.
 *   • Priority is restricted to Low / Medium / High and defaults to Medium
 *     (`DEFAULT_TASK_PRIORITY`); the chosen value is sent with the create.
 *   • Labels are chosen with the shared `LabelPicker`, which loads the existing
 *     labels from `GET /api/labels` and can create a new one with
 *     `POST /api/labels`. The picker starts empty, and the chosen ids are sent
 *     as `labelIds` in the `POST /api/tasks` body as part of `NewTask` — so a
 *     label created from inside the picker is attached to the task being
 *     created.
 *   • Title is required: a blank title is reported inline and the form does not
 *     submit. Everything else may be left empty.
 *   • On success the task is persisted with `POST /api/tasks` and `onCreated`
 *     is raised with the new id so the shell can return to the board, where the
 *     card appears in the column matching the chosen status.
 *   • Cancel raises `onCancel` and creates nothing.
 *
 * The markup mirrors the approved mockup of this route and uses only classes
 * the project's stylesheets already ship — it declares no colour of its own.
 */

import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button.js';
import { PrioritySelect } from '../../ui/PrioritySelect.js';
import { LabelPicker } from '../labels/index.js';
import { ApiError, api as defaultApi, type BoardApi } from '../../lib/api/client.js';
import type { TeamMemberWithWorkload } from '../../models/member.js';
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  isTaskStatus,
  type NewTask,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '../../models/task.js';

/** The slice of the board API this screen uses. */
export type NewTaskApi = Pick<BoardApi, 'listMembers' | 'createTask'>;

export interface NewTaskPageProps {
  /** Raised with the new task's id once it has been persisted. */
  onCreated: (taskId: string) => void;
  /** Raised when the person leaves without creating anything. */
  onCancel: () => void;
  /**
   * The API client to talk to. Defaults to the app's shared same-origin client;
   * the unit tests pass a stub. Callers never need to supply it.
   */
  api?: NewTaskApi;
}

/** Turns an unknown rejection into a sentence worth showing. */
function describeFailure(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.status === 0
      ? 'The server could not be reached. Check your connection and try again.'
      : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function NewTaskPage({ onCreated, onCancel, api = defaultApi }: NewTaskPageProps): JSX.Element {
  const idBase = useId();
  const titleFieldId = `${idBase}-title`;
  const titleHintId = `${idBase}-title-hint`;
  const titleErrorId = `${idBase}-title-error`;
  const descriptionFieldId = `${idBase}-description`;
  const assigneeFieldId = `${idBase}-assignee`;
  const dueDateFieldId = `${idBase}-due-date`;
  const statusFieldId = `${idBase}-status`;
  const priorityFieldId = `${idBase}-priority`;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<TaskStatus>(DEFAULT_TASK_STATUS);
  const [priority, setPriority] = useState<TaskPriority>(DEFAULT_TASK_PRIORITY);
  const [labelIds, setLabelIds] = useState<string[]>([]);

  const [members, setMembers] = useState<readonly TeamMemberWithWorkload[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingMembers(true);
    void api
      .listMembers()
      .then((roster: TeamMemberWithWorkload[]) => {
        if (!active) {
          return;
        }
        setMembers(roster);
        setRosterError(null);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setRosterError(
          describeFailure(error, 'The team roster could not be loaded. You can still save the task unassigned.'),
        );
      })
      .finally(() => {
        if (active) {
          setLoadingMembers(false);
        }
      });
    return () => {
      active = false;
    };
  }, [api]);

  /**
   * The picker hands back the whole selection. Declared as `readonly string[]`
   * so it fits a picker that passes either a mutable or a readonly array, and
   * copied into this screen's own state.
   */
  const handleLabelsChange = (ids: readonly string[]): void => {
    setLabelIds([...ids]);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (trimmedTitle === '') {
      setTitleError('Enter a title for the task.');
      setSubmitError(null);
      return;
    }

    setTitleError(null);
    setSubmitError(null);
    setSaving(true);

    const input: NewTask = {
      title: trimmedTitle,
      description: description.trim(),
      assigneeId: assignee === '' ? null : assignee,
      dueDate: dueDate === '' ? null : dueDate,
      status,
      priority,
      labelIds: [...labelIds],
    };

    void api
      .createTask(input)
      .then((created: Task) => {
        onCreated(created.id);
      })
      .catch((error: unknown) => {
        setSubmitError(describeFailure(error, 'The task could not be saved. Please try again.'));
        setSaving(false);
      });
  };

  return (
    <div data-screen="/tasks/new">
      <header className="page-header">
        <div>
          <h1 className="page-title">Add task</h1>
          <p className="page-description">Create a new task and place it directly into the right column.</p>
        </div>
      </header>

      <section className="card" aria-label="Add task">
        <div className="card-body">
          {submitError !== null ? (
            <p className="notice notice-danger" role="alert">
              {submitError}
            </p>
          ) : null}
          {rosterError !== null ? (
            <p className="notice" role="status">
              {rosterError}
            </p>
          ) : null}

          <form className="form" aria-label="Add task" noValidate onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label" htmlFor={titleFieldId}>
                Title
                <span className="field-required" aria-hidden="true">
                  {' *'}
                </span>
              </label>
              <input
                id={titleFieldId}
                className="input"
                type="text"
                value={title}
                placeholder="e.g. Write release notes"
                aria-invalid={titleError !== null ? true : undefined}
                aria-describedby={titleError !== null ? titleErrorId : titleHintId}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (titleError !== null) {
                    setTitleError(null);
                  }
                }}
              />
              {titleError !== null ? (
                <span id={titleErrorId} className="field-error" role="alert">
                  {titleError}
                </span>
              ) : (
                <span id={titleHintId} className="field-hint">
                  Required — describe the task in a few words.
                </span>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor={descriptionFieldId}>
                Description
              </label>
              <textarea
                id={descriptionFieldId}
                className="input"
                value={description}
                placeholder="Add any extra context for this task..."
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
              />
            </div>

            <div className="form-row">
              <div className="field">
                <label className="field-label" htmlFor={assigneeFieldId}>
                  Assignee
                </label>
                <select
                  id={assigneeFieldId}
                  className="input"
                  value={assignee}
                  onChange={(event) => {
                    setAssignee(event.target.value);
                  }}
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                {loadingMembers ? (
                  <span className="field-hint">Loading the team roster…</span>
                ) : members.length === 0 && rosterError === null ? (
                  <span className="field-hint">No team members yet — the task can be saved unassigned.</span>
                ) : (
                  <span className="field-hint">Exactly one team member, or leave it unassigned.</span>
                )}
              </div>

              <div className="field">
                <label className="field-label" htmlFor={dueDateFieldId}>
                  Due date
                </label>
                <input
                  id={dueDateFieldId}
                  className="input"
                  type="date"
                  value={dueDate}
                  onChange={(event) => {
                    setDueDate(event.target.value);
                  }}
                />
                <span className="field-hint">Optional.</span>
              </div>

              <div className="field">
                <label className="field-label" htmlFor={statusFieldId}>
                  Status
                </label>
                <select
                  id={statusFieldId}
                  className="input"
                  value={status}
                  onChange={(event) => {
                    const next: string = event.target.value;
                    if (isTaskStatus(next)) {
                      setStatus(next);
                    }
                  }}
                >
                  {TASK_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {TASK_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
                <span className="field-hint">The column the new card lands in.</span>
              </div>

              <PrioritySelect
                id={priorityFieldId}
                value={priority}
                hint="How urgent this task is. Medium unless you change it."
                disabled={saving}
                onChange={(next: TaskPriority) => {
                  setPriority(next);
                }}
              />
            </div>

            <div className="field" data-testid="new-task-labels">
              <span className="field-label">Labels</span>
              <LabelPicker selectedIds={labelIds} onChange={handleLabelsChange} />
            </div>

            <div className="form-actions">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save task'}
              </Button>
              <Button variant="secondary" disabled={saving} onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
