import {
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/** What every field has: its label, and the optional help and error lines under it. */
interface FieldBase {
  /** The field's visible label. Always present - a control is never label-free. */
  label: string;
  /** Optional help under the control. */
  hint?: string;
  /** The validation message. When set, the control is marked invalid and the message is announced. */
  error?: string;
}

function describedBy(hintId: string, errorId: string, hint?: string, error?: string): string | undefined {
  const ids = [error !== undefined ? errorId : null, hint !== undefined ? hintId : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function FieldNotes({ hintId, errorId, hint, error }: { hintId: string; errorId: string; hint?: string; error?: string }): ReactElement {
  return (
    <>
      {hint !== undefined ? (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      ) : null}
      {error !== undefined ? (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}

function FieldLabel({ htmlFor, label, required }: { htmlFor: string; label: string; required?: boolean }): ReactElement {
  return (
    <label className="field-label" htmlFor={htmlFor}>
      {label}
      {required === true ? (
        <span className="field-required" aria-hidden="true">
          {' *'}
        </span>
      ) : null}
    </label>
  );
}

export type TextFieldProps = FieldBase & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

/** A single-line input with its label. Pass `type` for email, number, date, search and so on. */
export function TextField({ label, hint, error, className, ...input }: TextFieldProps): ReactElement {
  const id = useId();
  return (
    <div className="field">
      <FieldLabel htmlFor={id} label={label} required={input.required} />
      <input
        id={id}
        className={'input' + (className !== undefined ? ' ' + className : '')}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={describedBy(id + '-hint', id + '-error', hint, error)}
        {...input}
      />
      <FieldNotes hintId={id + '-hint'} errorId={id + '-error'} hint={hint} error={error} />
    </div>
  );
}

export type TextAreaFieldProps = FieldBase & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

/** A multi-line input with its label, for notes and descriptions. */
export function TextAreaField({ label, hint, error, className, ...input }: TextAreaFieldProps): ReactElement {
  const id = useId();
  return (
    <div className="field">
      <FieldLabel htmlFor={id} label={label} required={input.required} />
      <textarea
        id={id}
        className={'input' + (className !== undefined ? ' ' + className : '')}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={describedBy(id + '-hint', id + '-error', hint, error)}
        {...input}
      />
      <FieldNotes hintId={id + '-hint'} errorId={id + '-error'} hint={hint} error={error} />
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export type SelectFieldProps = FieldBase &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> & {
    /** The choices, in display order. */
    options: readonly SelectOption[];
    /** When set, a first empty choice with this text (e.g. "Choose a status"). */
    placeholder?: string;
  };

/** A dropdown with its label. */
export function SelectField({ label, hint, error, options, placeholder, className, ...select }: SelectFieldProps): ReactElement {
  const id = useId();
  return (
    <div className="field">
      <FieldLabel htmlFor={id} label={label} required={select.required} />
      <select
        id={id}
        className={'input' + (className !== undefined ? ' ' + className : '')}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={describedBy(id + '-hint', id + '-error', hint, error)}
        {...select}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldNotes hintId={id + '-hint'} errorId={id + '-error'} hint={hint} error={error} />
    </div>
  );
}

export type CheckboxFieldProps = Pick<FieldBase, 'label'> & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'>;

/** A checkbox with its label beside it. */
export function CheckboxField({ label, ...input }: CheckboxFieldProps): ReactElement {
  const id = useId();
  return (
    <div className="field field-checkbox">
      <input id={id} type="checkbox" {...input} />
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
    </div>
  );
}
