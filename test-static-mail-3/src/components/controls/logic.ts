/**
 * Pure presentation logic for the screen's control components.
 *
 * Everything here is framework-free and side-effect-free so it can be unit tested
 * without a DOM. All user-facing wording is read from the shared COPY contract in
 * `src/models` — this module never declares copy of its own except the footer
 * summary format, which the copy contract does not provide.
 */
import {
  COPY,
  FILTERS,
  validateTitle,
  type Filter,
  type Task,
} from '../../models/index.js';

/** Whether the current composer value may be submitted. */
export function canSubmitTitle(value: string): boolean {
  return validateTitle(value).ok;
}

/** The validation message for a composer value, or `null` when it is acceptable. */
export function titleErrorMessage(value: string): string | null {
  const result = validateTitle(value);
  return result.ok ? null : result.message;
}

/** The footer summary sentence: exactly `N of M tasks done`. */
export function formatDoneSummary(done: number, total: number): string {
  return `${done} of ${total} tasks done`;
}

/** Counts rendered by the footer, computed over ALL tasks (never the filtered view). */
export interface TaskSummary {
  readonly done: number;
  readonly total: number;
  readonly text: string;
}

/** Summarise every task for the footer line. */
export function summarizeTasks(tasks: readonly Task[]): TaskSummary {
  const total = tasks.length;
  const done = tasks.filter((task: Task) => task.completed).length;
  return { done, total, text: formatDoneSummary(done, total) };
}

/** One rendered filter control. */
export interface FilterOption {
  readonly filter: Filter;
  readonly label: string;
  readonly selected: boolean;
}

/** The filter controls in display order, with the active one marked selected. */
export function filterOptions(selected: Filter): FilterOption[] {
  return FILTERS.map((filter: Filter) => ({
    filter,
    label: COPY.filters[filter],
    selected: filter === selected,
  }));
}

/**
 * The single empty-state message to render, or `null` when the list has rows.
 *
 * Exactly one message is ever produced: the "no tasks at all" message when nothing
 * has been created, otherwise the message for the active filter.
 */
export function emptyStateMessage(
  filter: Filter,
  totalCount: number,
  visibleCount: number,
): string | null {
  if (visibleCount > 0) return null;
  if (totalCount === 0) return COPY.empty.all;
  return COPY.empty[filter];
}

/** Normalise an error message down to a single renderable line, or `null`. */
export function errorText(message: string | null | undefined): string | null {
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : null;
}
