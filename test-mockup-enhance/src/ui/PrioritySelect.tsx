import { useId, type ChangeEvent } from "react";

import {
  DEFAULT_PRIORITY,
  PRIORITY_LABELS,
  PRIORITY_LEVELS,
  isPriorityLevel,
  type PriorityLevel,
} from "./priority.js";
import "./priority.css";

export interface PrioritySelectProps {
  /** The chosen level. Defaults to Medium when the caller has none yet. */
  readonly value?: PriorityLevel;
  /** Raised with the newly chosen level. */
  readonly onChange: (next: PriorityLevel) => void;
  /** The visible label. Defaults to "Priority". */
  readonly label?: string;
  /** An explicit id, when the host needs to address the control itself. */
  readonly id?: string;
  /** The form field name. Defaults to "priority". */
  readonly name?: string;
  /** Optional help line under the control. */
  readonly hint?: string;
  /** Disables the control, e.g. while a form is saving. */
  readonly disabled?: boolean;
}

/**
 * A labelled dropdown listing the shared priority levels in order (Low,
 * Medium, High) and defaulting to Medium.
 *
 * Purely presentational: value in, change out. It fetches nothing and keeps no
 * state of its own, and it is built from the classes the app's stylesheet
 * already ships (`.field`, `.field-label`, `.input`, `.field-hint`).
 */
export function PrioritySelect({
  value = DEFAULT_PRIORITY,
  onChange,
  label = "Priority",
  id,
  name = "priority",
  hint,
  disabled,
}: PrioritySelectProps): JSX.Element {
  const generated = useId();
  const selectId = id ?? `${generated}-priority`;
  const hintId = `${selectId}-hint`;

  const handleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next: string = event.target.value;
    if (isPriorityLevel(next)) {
      onChange(next);
    }
  };

  return (
    <div className="field ui-priority-field">
      <label className="field-label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        name={name}
        className="input ui-priority-select"
        value={value}
        disabled={disabled}
        aria-describedby={hint !== undefined ? hintId : undefined}
        onChange={handleChange}
      >
        {PRIORITY_LEVELS.map((level: PriorityLevel) => (
          <option key={level} value={level}>
            {PRIORITY_LABELS[level]}
          </option>
        ))}
      </select>
      {hint !== undefined ? (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export default PrioritySelect;
