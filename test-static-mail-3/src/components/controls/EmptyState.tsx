import type { ReactElement } from 'react';
import { DEFAULT_FILTER, type Filter } from '../../models/index.js';
import { emptyStateMessage } from './logic.js';
import { ControlStyles } from './styles.js';

export interface EmptyStateProps {
  /** The currently selected filter. Defaults to the shared default filter. */
  readonly filter?: Filter;
  /** Number of tasks that exist in total (never the filtered view). Defaults to 0. */
  readonly totalCount?: number;
  /** Number of tasks currently rendered by the list. Defaults to 0. */
  readonly visibleCount?: number;
}

/**
 * The single empty-state line.
 *
 * Renders EXACTLY ONE message, never both:
 *  - nothing at all while the list has rows;
 *  - the "add your first task" message when no task exists at all;
 *  - otherwise the message for the active filter.
 *
 * Every prop is optional so an owner that only renders this component when its list
 * is empty can mount it bare; the defaults then produce the "no tasks at all" line.
 *
 * The selection rule lives in `./logic.ts` (unit tested without a DOM) and every
 * string comes from the shared COPY contract in `src/models`.
 */
export function EmptyState({
  filter = DEFAULT_FILTER,
  totalCount = 0,
  visibleCount = 0,
}: EmptyStateProps = {}): ReactElement | null {
  const message = emptyStateMessage(filter, totalCount, visibleCount);
  if (message === null) return null;
  return (
    <>
      <ControlStyles />
      <p
        className="state-empty controls-empty"
        role="status"
        data-filter={filter}
        data-testid="controls-empty"
      >
        {message}
      </p>
    </>
  );
}
