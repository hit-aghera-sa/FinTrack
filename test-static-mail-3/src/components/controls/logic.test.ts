import { describe, it, expect } from 'vitest';
import {
  canSubmitTitle,
  emptyStateMessage,
  errorText,
  filterOptions,
  formatDoneSummary,
  summarizeTasks,
  titleErrorMessage,
  type FilterOption,
} from './logic.js';
import { COPY, type Task } from '../../models/index.js';

const tasks: Task[] = [
  { id: 'a1', title: 'Alex QA groceries', completed: false, createdAt: '2024-05-01T10:00:00.000Z' },
  { id: 'b2', title: 'Priya Lunch prep', completed: true, createdAt: '2024-05-02T10:00:00.000Z' },
  { id: 'c3', title: 'Book dentist', completed: false, createdAt: '2024-05-03T10:00:00.000Z' },
];

describe('composer submit guard', () => {
  it('rejects blank input and accepts a real title', () => {
    expect(canSubmitTitle('')).toBe(false);
    expect(canSubmitTitle('   ')).toBe(false);
    expect(canSubmitTitle('  Alex QA run-b7 ')).toBe(true);
  });

  it('surfaces the shared validation copy', () => {
    expect(titleErrorMessage('')).toBe(COPY.errors.titleRequired);
    expect(titleErrorMessage('x'.repeat(101))).toBe(COPY.errors.titleTooLong);
    expect(titleErrorMessage('Water the plants')).toBeNull();
  });
});

describe('footer summary', () => {
  it('formats exactly "N of M tasks done"', () => {
    expect(formatDoneSummary(0, 0)).toBe('0 of 0 tasks done');
    expect(formatDoneSummary(1, 3)).toBe('1 of 3 tasks done');
  });

  it('counts over all tasks, not a filtered view', () => {
    expect(summarizeTasks(tasks)).toEqual({ done: 1, total: 3, text: '1 of 3 tasks done' });
    expect(summarizeTasks([])).toEqual({ done: 0, total: 0, text: '0 of 0 tasks done' });
  });
});

describe('filter options', () => {
  it('lists every filter in display order with exactly one selected', () => {
    const options = filterOptions('active');
    expect(options.map((option: FilterOption) => option.filter)).toEqual(['all', 'active', 'completed']);
    expect(options.map((option: FilterOption) => option.label)).toEqual(['All', 'Active', 'Completed']);
    expect(options.filter((option: FilterOption) => option.selected)).toHaveLength(1);
    expect(options.find((option: FilterOption) => option.selected)?.filter).toBe('active');
  });
});

describe('empty state selection', () => {
  it('renders nothing while rows are visible', () => {
    expect(emptyStateMessage('all', 3, 3)).toBeNull();
    expect(emptyStateMessage('active', 3, 2)).toBeNull();
  });

  it('renders the first-task message when nothing exists', () => {
    expect(emptyStateMessage('all', 0, 0)).toBe(COPY.empty.all);
    expect(emptyStateMessage('completed', 0, 0)).toBe(COPY.empty.all);
  });

  it('renders the filter message when tasks exist but none match', () => {
    expect(emptyStateMessage('active', 3, 0)).toBe(COPY.empty.active);
    expect(emptyStateMessage('completed', 3, 0)).toBe(COPY.empty.completed);
  });

  it('never produces two messages at once', () => {
    const message = emptyStateMessage('completed', 3, 0);
    expect(typeof message).toBe('string');
    expect(message).not.toBe(COPY.empty.all);
  });
});

describe('error line text', () => {
  it('collapses absent or blank messages to null', () => {
    expect(errorText(null)).toBeNull();
    expect(errorText(undefined)).toBeNull();
    expect(errorText('   ')).toBeNull();
  });

  it('keeps a single trimmed message', () => {
    expect(errorText(`  ${COPY.errors.saveFailed} `)).toBe(COPY.errors.saveFailed);
  });
});
