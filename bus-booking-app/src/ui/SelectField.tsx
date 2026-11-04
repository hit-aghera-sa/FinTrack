import type { ChangeEvent } from 'react';
import { FieldShell, hasMessage } from './FieldShell';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<SelectOption>;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
}

/** A labelled picker: security questions, From/To cities, boarding points. */
export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  error,
  required = false,
  disabled = false,
}: SelectFieldProps): JSX.Element {
  const controlId = `field-${name}`;
  const errorId = `${controlId}-error`;
  const invalid = hasMessage(error);

  return (
    <FieldShell label={label} controlId={controlId} errorId={errorId} error={error} required={required}>
      <select
        className="input"
        id={controlId}
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
