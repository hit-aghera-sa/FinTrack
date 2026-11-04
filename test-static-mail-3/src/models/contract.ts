/**
 * The specification contract: the exact user-facing copy the app must render, and
 * the stable DOM hooks (ids, classes, test ids) the rendered screens expose.
 *
 * WHY THIS EXISTS
 * ---------------
 * The acceptance/regression suite and the component lanes both need to agree on two
 * things that are easy to let drift apart: the literal wording of the screen, and
 * the selectors used to find it. Both are declared ONCE here.
 *
 * Every string in {@link ACCEPTANCE_COPY} is DERIVED from {@link COPY} rather than
 * retyped, so a copy change can never leave the contract stale — the co-located test
 * pins the literal values, so an accidental wording change fails the unit gate
 * instead of silently passing.
 *
 * Pure TypeScript: no framework imports, no environment access, no I/O and no side
 * effects at import time. Safe for both the browser bundle and the Node server.
 */
import { COPY } from './copy.js';
import { FILTERS } from './task.js';
import type { Filter } from './task.js';

/** The visible label of the row's destructive action. */
export const REMOVE_ACTION_LABEL = 'Remove';

/** The specification copy an end-to-end run asserts on. */
export interface AcceptanceCopy {
  readonly appTitle: string;
  readonly addPlaceholder: string;
  readonly addSubmit: string;
  readonly removeAction: string;
  readonly emptyAll: string;
  readonly emptyActive: string;
  readonly emptyCompleted: string;
  readonly titleRequired: string;
  readonly titleTooLong: string;
  readonly filterAll: string;
  readonly filterActive: string;
  readonly filterCompleted: string;
}

/**
 * Flattened, assertion-friendly view of the copy contract.
 *
 * Consumers that only need a handful of strings (specs, smoke checks) read them from
 * here; components keep reading the structured {@link COPY} object.
 */
export const ACCEPTANCE_COPY: AcceptanceCopy = {
  appTitle: COPY.appTitle,
  addPlaceholder: COPY.composer.placeholder,
  addSubmit: COPY.composer.submit,
  removeAction: REMOVE_ACTION_LABEL,
  emptyAll: COPY.empty.all,
  emptyActive: COPY.empty.active,
  emptyCompleted: COPY.empty.completed,
  titleRequired: COPY.errors.titleRequired,
  titleTooLong: COPY.errors.titleTooLong,
  filterAll: COPY.filters.all,
  filterActive: COPY.filters.active,
  filterCompleted: COPY.filters.completed,
};

/** Stable `data-testid` values rendered by the screens. */
export const TEST_IDS = {
  taskList: 'task-list',
  taskListEmpty: 'task-list-empty',
  controlsEmpty: 'controls-empty',
  errorLine: 'error-line',
  taskFooter: 'task-footer',
} as const;

/** Name of a known test id. */
export type TestIdName = keyof typeof TEST_IDS;

/** A rendered test id value. */
export type TestId = (typeof TEST_IDS)[TestIdName];

/** Build the attribute selector for a test id. */
export function testIdSelector(id: string): string {
  return `[data-testid="${id}"]`;
}

/**
 * The DOM hooks the screens expose. These mirror what the components really render;
 * nothing else should hardcode them.
 */
export const SELECTORS = {
  /** The composer text field. */
  titleInput: '#new-task-title',
  /** The composer submit button. */
  submitButton: '.controls-add__submit',
  /** Any rendered task row. */
  taskRow: 'li[data-task-id]',
  /** The title element inside a row. */
  taskTitle: '.task-list__title',
  /** The completed (struck-through) title variant. */
  taskTitleDone: '.task-list__title--done',
  /** The completion checkbox inside a row. */
  taskCheckbox: '.task-list__checkbox',
  /** The row's Remove button. */
  removeButton: '.task-list__remove',
  /** The list element. */
  taskList: '[data-testid="task-list"]',
  /** The list's empty state line. */
  emptyState: '[data-testid="task-list-empty"]',
  /** The single error line above the list. */
  errorLine: '[data-testid="error-line"]',
  /** The footer summary line. */
  footer: '[data-testid="task-footer"]',
} as const;

/** Name of a known selector. */
export type SelectorName = keyof typeof SELECTORS;

/** Selector for a filter control. */
export function filterButtonSelector(filter: Filter): string {
  return `button[data-filter="${filter}"]`;
}

/** Selector for one task row, or for every row when no id is given. */
export function taskRowSelector(id?: string): string {
  return id === undefined ? SELECTORS.taskRow : `li[data-task-id="${id}"]`;
}

/** The label rendered on a filter control. */
export function filterLabelFor(filter: Filter): string {
  return COPY.filters[filter];
}

/** The empty-state message rendered for a filter. */
export function emptyMessageFor(filter: Filter): string {
  return COPY.empty[filter];
}

/** Every filter paired with its label and empty-state message, in display order. */
export interface FilterContract {
  readonly filter: Filter;
  readonly label: string;
  readonly emptyMessage: string;
  readonly selector: string;
}

/** The filter contract, derived from the shared FILTERS order. */
export const FILTER_CONTRACT: readonly FilterContract[] = FILTERS.map(
  (filter: Filter): FilterContract => ({
    filter,
    label: filterLabelFor(filter),
    emptyMessage: emptyMessageFor(filter),
    selector: filterButtonSelector(filter),
  }),
);
