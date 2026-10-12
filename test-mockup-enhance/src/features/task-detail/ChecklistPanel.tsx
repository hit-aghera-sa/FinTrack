/**
 * THE SUBTASKS (checklist) PANEL of the task detail screen (`/tasks/:id`).
 *
 * The panel's ROOT element carries `data-testid="task-checklist"` and holds,
 * as descendants:
 *
 *   • the add-item form — a real `<input type="text">` whose accessible name is
 *     "Checklist item" (a visible `<label for>`), with an `Add subtask` submit
 *     button;
 *   • the item list — one row per item, a checkbox labelled with the item's
 *     title (ticking it PATCHes `done` and re-renders immediately) and a
 *     `Delete` button that removes the item straight away, with no
 *     confirmation step (CL-20);
 *   • a SEPARATE progress element with `data-testid="checklist-progress"`
 *     reading `done/total` and carrying an aria-label of the form
 *     "N of M checklist items done". The progress text is never the element
 *     `data-testid="task-checklist"` resolves to — that was the defect this
 *     panel fixes.
 *
 * Adds are OPTIMISTIC BUT PERSISTED: the new item appears at once and is then
 * replaced by the row the server stored, so it survives a reload; a failed
 * write rolls the list back and puts the typed title back in the box.
 *
 * Everything persisted goes through this screen's own checklist client over
 * same-origin `/api`. Ticking an item never changes the task's own status
 * (CL-17), items are always listed in their stored creation order with no
 * reordering controls (CL-18), and a title cannot be edited once created
 * (CL-19).
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { Button } from '../../components/Button.js';
import { ErrorBanner } from '../../ui/ErrorBanner.js';
import { ApiError } from '../../lib/api/index.js';
import {
  checklistProgressLabel,
  compareChecklistItems,
  countChecklistProgress,
  type ChecklistItem,
  type ChecklistProgress,
} from '../../models/checklist/index.js';
import { checklistClient, type ChecklistClient } from './checklistClient.js';
import './ChecklistPanel.css';

/** The panel as the task detail screen mounts it. */
export interface ChecklistPanelProps {
  taskId: string;
}

/** The same panel with the checklist client injected — used by the unit tests. */
export interface ChecklistPanelViewProps extends ChecklistPanelProps {
  client: ChecklistClient;
}

const LOAD_FALLBACK = 'The checklist could not be loaded.';
const ADD_FALLBACK = 'That checklist item could not be added.';
const TICK_FALLBACK = 'That checklist item could not be saved.';
const REMOVE_FALLBACK = 'That checklist item could not be removed.';

/** The wording shown for a failure: the server's own message wins. */
function describeFailure(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'The checklist could not be reached. Check your connection and try again.';
    }
    return error.message.trim() === '' ? fallback : error.message;
  }
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return fallback;
}

/** The subtasks panel with its client supplied. */
export function ChecklistPanelView({ taskId, client }: ChecklistPanelViewProps): JSX.Element {
  const fieldId = `${useId()}-checklist-item`;
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const pending = useRef<number>(0);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    try {
      const loaded = await client.listItems(taskId);
      setItems([...loaded].sort(compareChecklistItems));
    } catch (error: unknown) {
      setItems([]);
      setLoadError(describeFailure(error, LOAD_FALLBACK));
    } finally {
      setLoading(false);
    }
  }, [client, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addItem(title: string): Promise<void> {
    pending.current += 1;
    const pendingId = `pending-item-${String(pending.current)}`;
    const optimistic: ChecklistItem = {
      id: pendingId,
      taskId,
      title,
      done: false,
      position: items.length + 1,
      createdAt: new Date().toISOString(),
    };

    setItems((current: ChecklistItem[]): ChecklistItem[] => [...current, optimistic]);
    setDraft('');
    setDraftError(null);
    setActionError(null);
    setBusy(true);

    try {
      const created = await client.addItem(taskId, title);
      setItems((current: ChecklistItem[]): ChecklistItem[] =>
        current.map((item: ChecklistItem): ChecklistItem =>
          item.id === pendingId ? created : item,
        ),
      );
    } catch (error: unknown) {
      setItems((current: ChecklistItem[]): ChecklistItem[] =>
        current.filter((item: ChecklistItem): boolean => item.id !== pendingId),
      );
      setDraft(title);
      setActionError(describeFailure(error, ADD_FALLBACK));
    } finally {
      setBusy(false);
    }
  }

  async function toggleItem(item: ChecklistItem): Promise<void> {
    const next = !item.done;
    setActionError(null);
    setItems((current: ChecklistItem[]): ChecklistItem[] =>
      current.map((row: ChecklistItem): ChecklistItem =>
        row.id === item.id ? { ...row, done: next } : row,
      ),
    );

    try {
      const saved = await client.setDone(taskId, item.id, next);
      setItems((current: ChecklistItem[]): ChecklistItem[] =>
        current.map((row: ChecklistItem): ChecklistItem => (row.id === item.id ? saved : row)),
      );
    } catch (error: unknown) {
      setItems((current: ChecklistItem[]): ChecklistItem[] =>
        current.map((row: ChecklistItem): ChecklistItem =>
          row.id === item.id ? { ...row, done: item.done } : row,
        ),
      );
      setActionError(describeFailure(error, TICK_FALLBACK));
    }
  }

  async function removeItem(item: ChecklistItem): Promise<void> {
    setActionError(null);
    setItems((current: ChecklistItem[]): ChecklistItem[] =>
      current.filter((row: ChecklistItem): boolean => row.id !== item.id),
    );

    try {
      await client.removeItem(taskId, item.id);
    } catch (error: unknown) {
      setItems((current: ChecklistItem[]): ChecklistItem[] =>
        [...current, item].sort(compareChecklistItems),
      );
      setActionError(describeFailure(error, REMOVE_FALLBACK));
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const title = draft.trim();
    if (title === '') {
      setDraftError('Enter a checklist item.');
      return;
    }
    void addItem(title);
  };

  const progress: ChecklistProgress = countChecklistProgress(taskId, items);
  const progressText = checklistProgressLabel(progress);
  const progressLabel = `${String(progress.done)} of ${String(progress.total)} checklist items done`;
  const showEmpty = !loading && loadError === null && items.length === 0;

  return (
    <section className="checklist-panel" data-testid="task-checklist" aria-label="Subtasks">
      <div className="checklist-panel-head">
        <h2 className="checklist-panel-title">Subtasks</h2>
        <span
          className="checklist-progress"
          data-testid="checklist-progress"
          aria-label={progressLabel}
        >
          {progressText}
        </span>
      </div>

      <form className="checklist-add" noValidate onSubmit={handleSubmit}>
        <div className="checklist-add-field">
          <label className="field-label" htmlFor={fieldId}>
            Checklist item
          </label>
          <input
            id={fieldId}
            className="input"
            type="text"
            value={draft}
            placeholder="e.g. Draft the release note"
            aria-invalid={draftError !== null ? true : undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              if (draftError !== null) {
                setDraftError(null);
              }
            }}
          />
          {draftError !== null ? (
            <span className="checklist-field-error" role="alert">
              {draftError}
            </span>
          ) : null}
        </div>
        <Button type="submit" variant="primary" disabled={busy}>
          Add subtask
        </Button>
      </form>

      {loading ? (
        <p className="checklist-note" role="status">
          Loading the checklist…
        </p>
      ) : null}

      {loadError !== null ? (
        <ErrorBanner
          message={loadError}
          onRetry={() => {
            void load();
          }}
        />
      ) : null}

      {actionError !== null ? <ErrorBanner message={actionError} /> : null}

      {showEmpty ? (
        <p className="checklist-empty">
          No checklist items yet. Add the first step above and it will appear here.
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="checklist-items">
          {items.map((item: ChecklistItem) => (
            <li
              key={item.id}
              className={item.done ? 'checklist-item is-done' : 'checklist-item'}
              data-testid="checklist-item"
            >
              <label className="checklist-item-label">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => {
                    void toggleItem(item);
                  }}
                />
                <span className="checklist-item-text">{item.title}</span>
              </label>
              <Button
                small
                variant="ghost"
                onClick={() => {
                  void removeItem(item);
                }}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** The subtasks panel as the task detail screen mounts it, on the real API. */
export function ChecklistPanel({ taskId }: ChecklistPanelProps): JSX.Element {
  return <ChecklistPanelView taskId={taskId} client={checklistClient} />;
}
