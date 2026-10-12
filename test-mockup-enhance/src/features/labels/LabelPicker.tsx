/**
 * THE LABEL PICKER — the shared, route-less label control the task screens use.
 *
 *   • loads the existing labels from `GET /api/labels` through the label client;
 *   • lets any of them be toggled for the current task (the selection is the
 *     caller's state, so the screen owns what is saved);
 *   • draws the selected ones as chips, each with a remove action;
 *   • embeds an inline create-label control — a name field plus a colour from
 *     `LABEL_COLORS` — that POSTs `/api/labels`, reports a duplicate name or a
 *     validation problem inline, and on success adds the new label to the list
 *     and selects it.
 *
 * It deliberately draws NO nested <form>: both task screens already wrap their
 * fields in one, so the create action is a plain button (and Enter in the name
 * field is handled here rather than submitting the surrounding form).
 */

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import { Button } from "../../components/Button.js";
import { ApiError } from "../../lib/api/index.js";
import { LabelBadge } from "./LabelBadge.js";
import { labelApi, type LabelApi } from "./labelsClient.js";
import {
  DEFAULT_LABEL_COLOR,
  LABEL_COLORS,
  isLabelColor,
  type Label,
  type LabelColor,
  type LabelColorOption,
} from "./labels.js";
import "./LabelPicker.css";

export interface LabelPickerProps {
  /** The ids of the labels chosen for the task being edited. */
  readonly selectedIds: readonly string[];
  /** Raised with the new selection when a label is toggled, removed or created. */
  readonly onChange: (selectedIds: string[]) => void;
  /** The field heading. Defaults to "Labels". */
  readonly heading?: string;
  /** An optional line under the heading. */
  readonly hint?: string;
  /** Disables every control, e.g. while the task is being saved. */
  readonly disabled?: boolean;
  /** The label API to talk to. Defaults to the shared same-origin client. */
  readonly client?: LabelApi;
}

/** Turns an unknown rejection into a sentence worth showing. */
function describeFailure(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.status === 0
      ? "The server could not be reached. Check your connection and try again."
      : error.message;
  }
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }
  return fallback;
}

export function LabelPicker({
  selectedIds,
  onChange,
  heading = "Labels",
  hint,
  disabled = false,
  client = labelApi,
}: LabelPickerProps): JSX.Element {
  const idBase = useId();
  const headingId = `${idBase}-labels-heading`;
  const nameFieldId = `${idBase}-label-name`;
  const colorFieldId = `${idBase}-label-color`;
  const createErrorId = `${idBase}-label-error`;

  const [labels, setLabels] = useState<readonly Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>(DEFAULT_LABEL_COLOR);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void client
      .listLabels()
      .then((loaded: Label[]) => {
        if (!active) {
          return;
        }
        setLabels(loaded);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setLoadError(
          describeFailure(error, "The labels could not be loaded. You can still save the task."),
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [client]);

  const selected = useMemo<readonly Label[]>(() => {
    const found: Label[] = [];
    for (const id of selectedIds) {
      const match = labels.find((candidate: Label): boolean => candidate.id === id);
      if (match !== undefined) {
        found.push(match);
      }
    }
    return found;
  }, [labels, selectedIds]);

  const toggle = (id: string): void => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((value: string): boolean => value !== id)
      : [...selectedIds, id];
    onChange([...next]);
  };

  const createLabel = (): void => {
    const trimmed = name.trim();
    if (trimmed === "") {
      setCreateError("Enter a name for the new label.");
      return;
    }
    setCreateError(null);
    setCreating(true);
    void client
      .createLabel({ name: trimmed, color })
      .then((created: Label) => {
        setLabels((current: readonly Label[]) =>
          current.some((candidate: Label): boolean => candidate.id === created.id)
            ? current
            : [...current, created],
        );
        setName("");
        setColor(DEFAULT_LABEL_COLOR);
        if (!selectedIds.includes(created.id)) {
          onChange([...selectedIds, created.id]);
        }
      })
      .catch((error: unknown) => {
        setCreateError(describeFailure(error, "The label could not be created."));
      })
      .finally(() => {
        setCreating(false);
      });
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      // The picker sits inside the screen's own form: Enter adds the label here
      // rather than submitting the task.
      event.preventDefault();
      createLabel();
    }
  };

  const handleColorChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next: string = event.target.value;
    if (isLabelColor(next)) {
      setColor(next);
    }
  };

  const busy = disabled || creating;

  return (
    <section className="label-picker" aria-labelledby={headingId}>
      <h3 className="label-picker-heading" id={headingId}>
        {heading}
      </h3>
      {hint !== undefined ? <p className="label-picker-note">{hint}</p> : null}

      {loadError !== null ? (
        <p className="notice notice-danger" role="alert">
          {loadError}
        </p>
      ) : null}

      {selected.length === 0 ? (
        <p className="label-picker-note">
          No labels on this task yet. Choose one below, or add a new one.
        </p>
      ) : (
        <ul className="label-picker-chips" aria-label="Labels on this task">
          {selected.map((item: Label) => (
            <li key={item.id}>
              <LabelBadge
                label={item}
                onRemove={
                  disabled
                    ? undefined
                    : () => {
                        toggle(item.id);
                      }
                }
              />
            </li>
          ))}
        </ul>
      )}

      <div className="label-picker-choices" role="group" aria-label="Available labels">
        {loading ? (
          <p className="label-picker-note" role="status">
            Loading the labels\u2026
          </p>
        ) : null}
        {!loading && loadError === null && labels.length === 0 ? (
          <p className="label-picker-note">No labels exist yet. Add the first one below.</p>
        ) : null}
        {labels.map((item: Label) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              className={
                isSelected ? "label-picker-choice is-selected" : "label-picker-choice"
              }
              aria-pressed={isSelected}
              aria-label={`${item.name} label`}
              disabled={disabled}
              onClick={() => {
                toggle(item.id);
              }}
            >
              <LabelBadge label={item} />
              <span className="label-picker-choice-state">
                {isSelected ? "Selected" : "Add"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="label-picker-create">
        <p className="label-picker-note">Not in the list? Name a new label and pick its colour.</p>
        <div className="form-row">
          <div className="field">
            <label className="field-label" htmlFor={nameFieldId}>
              New label name
            </label>
            <input
              id={nameFieldId}
              className="input"
              type="text"
              value={name}
              placeholder="e.g. Design review"
              disabled={busy}
              aria-invalid={createError !== null ? true : undefined}
              aria-describedby={createError !== null ? createErrorId : undefined}
              onChange={(event) => {
                setName(event.target.value);
                if (createError !== null) {
                  setCreateError(null);
                }
              }}
              onKeyDown={handleNameKeyDown}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={colorFieldId}>
              Label colour
            </label>
            <select
              id={colorFieldId}
              className="input"
              value={color}
              disabled={busy}
              onChange={handleColorChange}
            >
              {LABEL_COLORS.map((option: LabelColorOption) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {createError !== null ? (
          <span id={createErrorId} className="field-error" role="alert">
            {createError}
          </span>
        ) : null}
        <div className="form-actions">
          <Button variant="secondary" small disabled={busy} onClick={createLabel}>
            {creating ? "Adding\u2026" : "Add label"}
          </Button>
        </div>
      </div>
    </section>
  );
}
