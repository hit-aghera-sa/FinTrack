import type { ChangeEvent } from 'react';
import { FieldShell, hasMessage } from './FieldShell';

export interface TextFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password' | 'tel' | 'number' | 'date';
  error?: string | null;
  required?: boolean;
  maxLength?: number;
  /** Lower bound for a number or date field, as the input expects it (YYYY-MM-DD for a date). */
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * A labelled text input with its inline error. `tel` and `number` ask the phone for the numeric
 * keypad; `date` passes min/max straight to the platform date picker.
 */
export function TextField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  error,
  required = false,
  maxLength,
  min,
  max,
  placeholder,
  disabled = false,
}: TextFieldProps): JSX.Element {
  const controlId = `field-${name}`;
  const errorId = `${controlId}-error`;
  const invalid = hasMessage(error);
  const numeric = type === 'tel' || type === 'number';

  return (
    <FieldShell label={label} controlId={controlId} errorId={errorId} error={error} required={required}>
      <input
        className="input"
        id={controlId}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        inputMode={numeric ? 'numeric' : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}
