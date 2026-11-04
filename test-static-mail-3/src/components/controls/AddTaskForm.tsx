import {
  forwardRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from 'react';
import { COPY, normalizeTitle } from '../../models/index.js';
import { resolveSubmitHandler } from './compat.js';
import { canSubmitTitle } from './logic.js';
import { ControlStyles } from './styles.js';

export interface AddTaskFormProps {
  /**
   * Current composer value when the owner controls the field. Omit it to let the
   * form keep the draft itself (the owner then only needs a submit callback).
   */
  readonly value?: string;
  /** Called on every keystroke with the raw input value. */
  readonly onValueChange?: (value: string) => void;
  /** Called once with the normalised title when the form is submitted. */
  readonly onSubmit?: (title: string) => void;
  /**
   * Alias of {@link AddTaskFormProps.onSubmit} for owners that name the callback
   * `onAdd`. Exactly one of the two should be supplied; `onSubmit` wins when both
   * are present.
   */
  readonly onAdd?: (title: string) => void;
  /** Disables the input and button while a create request is in flight. */
  readonly pending?: boolean;
}

/**
 * Controlled composer: a text input plus an Add button.
 *
 * Pressing Enter inside the input and clicking the button both go through the SAME
 * handler (the form's submit event), and the input ref is forwarded so the owner can
 * refocus the field after a successful create.
 *
 * VALIDATION IS THE OWNER'S JOB. The form deliberately does NOT block submission for
 * a blank or over-long title: it hands the normalised value to the submit callback and
 * the owner (the `useTasks` hook) validates it and renders the single error line.
 * Blocking here would make an invalid title silently unrejectable — a disabled submit
 * button swallows the click AND suppresses the browser's implicit Enter submission, so
 * the user would never see `Enter a task title.` or the too-long message.
 *
 * The only disabled state is `pending`, while a write is in flight.
 *
 * When `value` is omitted the field keeps its own draft and clears it after a title
 * that passes validation was submitted; an invalid draft is kept so the user can fix it.
 */
export const AddTaskForm = forwardRef<HTMLInputElement, AddTaskFormProps>(function AddTaskForm(
  { value, onValueChange, onSubmit, onAdd, pending = false }: AddTaskFormProps,
  ref,
): ReactElement {
  const [draft, setDraft] = useState('');
  const controlled = value !== undefined;
  const current: string = value ?? draft;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (pending) return;
    const accepted = canSubmitTitle(current);
    resolveSubmitHandler(onSubmit, onAdd)(normalizeTitle(current));
    if (!controlled && accepted) {
      setDraft('');
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const next = event.target.value;
    if (!controlled) {
      setDraft(next);
    }
    if (onValueChange !== undefined) {
      onValueChange(next);
    }
  }

  return (
    <form
      className="controls-add"
      aria-label={COPY.composer.heading}
      onSubmit={handleSubmit}
      noValidate
    >
      <ControlStyles />
      <label className="controls-visually-hidden" htmlFor="new-task-title">
        {COPY.composer.label}
      </label>
      <input
        id="new-task-title"
        ref={ref}
        className="input controls-add__input"
        type="text"
        name="title"
        autoComplete="off"
        placeholder={COPY.composer.placeholder}
        value={current}
        disabled={pending}
        onChange={handleChange}
      />
      <button type="submit" className="btn btn-primary controls-add__submit" disabled={pending}>
        {COPY.composer.submit}
      </button>
    </form>
  );
});
