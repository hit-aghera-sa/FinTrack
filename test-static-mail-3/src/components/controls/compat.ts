/**
 * Prop-resolution helpers for the control components.
 *
 * WHY THIS EXISTS
 * ---------------
 * The screen owner (the composition root) and this lane name a few callbacks and
 * counts differently: the composer's submit callback is `onSubmit` here and `onAdd`
 * there, and the footer is handed either the full task list or the already-derived
 * active/completed counts. Rather than each component re-deriving that choice inline
 * (and rather than this lane editing files it does not own), the rules live here as
 * PURE functions so they can be unit tested without a DOM.
 *
 * No React, no I/O, no side effects at import time.
 */
import type { Task } from '../../models/index.js';
import { formatDoneSummary, summarizeTasks, type TaskSummary } from './logic.js';

/** A composer submit callback: it receives the normalised title and nothing else. */
export type SubmitHandler = (title: string) => void;

/**
 * Fallback used when the owner wired neither callback.
 *
 * Declared WITHOUT parameters on purpose: a zero-argument function is assignable to
 * {@link SubmitHandler}, and an unused named parameter is a lint error under the
 * project's ESLint config.
 */
function ignoreSubmit(): void {
  return;
}

/**
 * Pick the submit callback to fire, preferring `onSubmit` over the `onAdd` alias.
 * Always returns a callable, so the caller never needs an existence check.
 */
export function resolveSubmitHandler(
  onSubmit?: SubmitHandler,
  onAdd?: SubmitHandler,
): SubmitHandler {
  return onSubmit ?? onAdd ?? ignoreSubmit;
}

/**
 * Resolve the footer summary from whichever shape the owner supplied.
 *
 * The full task list wins when it is given (the summary is then counted over EVERY
 * task, never a filtered view); otherwise the active/completed counts are used, with
 * `total = active + completed`. With nothing supplied the summary is `0 of 0 tasks done`.
 */
export function resolveFooterSummary(
  tasks?: readonly Task[],
  activeCount?: number,
  completedCount?: number,
): TaskSummary {
  if (tasks !== undefined) {
    return summarizeTasks(tasks);
  }
  const done = completedCount ?? 0;
  const active = activeCount ?? 0;
  const total = done + active;
  return { done, total, text: formatDoneSummary(done, total) };
}
