import type { ReactElement } from 'react';
import { COPY, type Filter } from '../../models/index.js';
import { filterOptions, type FilterOption } from './logic.js';
import { ControlStyles } from './styles.js';

export interface FilterBarProps {
  /** The currently selected filter. */
  readonly filter: Filter;
  /** Called with the newly chosen filter. */
  readonly onFilterChange: (filter: Filter) => void;
  /** Disables the whole group (e.g. during the initial load). */
  readonly disabled?: boolean;
}

/**
 * All / Active / Completed controls, derived from the shared FILTERS order.
 *
 * The selected control is visually distinct and exposes its state to assistive
 * technology through `aria-pressed`.
 */
export function FilterBar({ filter, onFilterChange, disabled = false }: FilterBarProps): ReactElement {
  const options = filterOptions(filter);
  return (
    <div className="controls-filterbar" role="group" aria-label={COPY.filtersLabel}>
      <ControlStyles />
      {options.map((option: FilterOption) => (
        <button
          key={option.filter}
          type="button"
          className={`btn ${option.selected ? 'btn-primary' : 'btn-ghost'} controls-filterbar__button`}
          aria-pressed={option.selected}
          data-filter={option.filter}
          disabled={disabled}
          onClick={() => onFilterChange(option.filter)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
