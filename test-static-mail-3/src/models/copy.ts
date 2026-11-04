/**
 * The exact user-facing copy for the app. Defined ONCE here; components, tests and
 * server error payloads all read these strings so rendered wording and asserted
 * wording can never drift.
 *
 * No framework imports, no side effects.
 */
import type { Filter } from './task.js';

export interface ComposerCopy {
  readonly heading: string;
  readonly label: string;
  readonly placeholder: string;
  readonly submit: string;
}

export interface ItemCopy {
  readonly toggle: (title: string) => string;
  readonly delete: (title: string) => string;
  readonly completedBadge: string;
}

export interface StatusCopy {
  readonly loading: string;
  readonly remaining: (count: number) => string;
  readonly clearCompleted: string;
  readonly retry: string;
}

export interface ErrorCopy {
  readonly titleRequired: string;
  readonly titleTooLong: string;
  readonly loadFailed: string;
  readonly saveFailed: string;
  readonly deleteFailed: string;
  readonly notFound: string;
  readonly unexpected: string;
}

export interface AppCopy {
  readonly appTitle: string;
  readonly appSubtitle: string;
  readonly listLabel: string;
  readonly filtersLabel: string;
  readonly composer: ComposerCopy;
  readonly filters: Readonly<Record<Filter, string>>;
  readonly empty: Readonly<Record<Filter, string>>;
  readonly item: ItemCopy;
  readonly status: StatusCopy;
  readonly errors: ErrorCopy;
}

/** The copy contract. Treat every string as specification text: do not paraphrase. */
export const COPY: AppCopy = {
  appTitle: 'Tasks',
  appSubtitle: 'Keep track of what needs doing.',
  listLabel: 'Task list',
  filtersLabel: 'Filter tasks',
  composer: {
    heading: 'Add a task',
    label: 'Task title',
    placeholder: 'What needs to be done?',
    submit: 'Add task',
  },
  filters: {
    all: 'All',
    active: 'Active',
    completed: 'Completed',
  },
  empty: {
    all: 'No tasks yet. Add your first task above.',
    active: 'No active tasks. Nice work!',
    completed: 'No completed tasks yet.',
  },
  item: {
    toggle: (title: string): string => `Toggle ${title}`,
    delete: (title: string): string => `Delete ${title}`,
    completedBadge: 'Completed',
  },
  status: {
    loading: 'Loading tasks...',
    remaining: (count: number): string => `${count} ${count === 1 ? 'task' : 'tasks'} left`,
    clearCompleted: 'Clear completed',
    retry: 'Try again',
  },
  errors: {
    titleRequired: 'Enter a task title.',
    titleTooLong: 'Task title must be 100 characters or fewer.',
    loadFailed: 'Could not load tasks. Please try again.',
    saveFailed: 'Could not save your change. Please try again.',
    deleteFailed: 'Could not delete that task. Please try again.',
    notFound: 'That task no longer exists.',
    unexpected: 'Something went wrong. Please try again.',
  },
};

/** Label for a filter tab. */
export function filterLabel(filter: Filter): string {
  return COPY.filters[filter];
}

/** Empty-state message for a filter. */
export function emptyMessage(filter: Filter): string {
  return COPY.empty[filter];
}
