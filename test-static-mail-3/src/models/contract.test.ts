import { describe, it, expect } from 'vitest';
import {
  ACCEPTANCE_COPY,
  FILTER_CONTRACT,
  REMOVE_ACTION_LABEL,
  SELECTORS,
  TEST_IDS,
  emptyMessageFor,
  filterButtonSelector,
  filterLabelFor,
  taskRowSelector,
  testIdSelector,
  type FilterContract,
} from './contract.js';
import { COPY } from './copy.js';
import { FILTERS, type Filter } from './task.js';

describe('acceptance copy', () => {
  it('pins the exact specification wording', () => {
    expect(ACCEPTANCE_COPY.appTitle).toBe('Tasks');
    expect(ACCEPTANCE_COPY.addPlaceholder).toBe('What needs to be done?');
    expect(ACCEPTANCE_COPY.addSubmit).toBe('Add task');
    expect(ACCEPTANCE_COPY.removeAction).toBe('Remove');
    expect(ACCEPTANCE_COPY.emptyAll).toBe('No tasks yet. Add your first task above.');
    expect(ACCEPTANCE_COPY.emptyActive).toBe('No active tasks. Nice work!');
    expect(ACCEPTANCE_COPY.emptyCompleted).toBe('No completed tasks yet.');
    expect(ACCEPTANCE_COPY.titleRequired).toBe('Enter a task title.');
    expect(ACCEPTANCE_COPY.titleTooLong).toBe('Task title must be 100 characters or fewer.');
  });

  it('is derived from the shared copy contract, never retyped', () => {
    expect(ACCEPTANCE_COPY.appTitle).toBe(COPY.appTitle);
    expect(ACCEPTANCE_COPY.addPlaceholder).toBe(COPY.composer.placeholder);
    expect(ACCEPTANCE_COPY.addSubmit).toBe(COPY.composer.submit);
    expect(ACCEPTANCE_COPY.emptyAll).toBe(COPY.empty.all);
    expect(ACCEPTANCE_COPY.emptyActive).toBe(COPY.empty.active);
    expect(ACCEPTANCE_COPY.emptyCompleted).toBe(COPY.empty.completed);
    expect(ACCEPTANCE_COPY.titleRequired).toBe(COPY.errors.titleRequired);
    expect(ACCEPTANCE_COPY.titleTooLong).toBe(COPY.errors.titleTooLong);
    expect(ACCEPTANCE_COPY.filterAll).toBe(COPY.filters.all);
    expect(ACCEPTANCE_COPY.filterActive).toBe(COPY.filters.active);
    expect(ACCEPTANCE_COPY.filterCompleted).toBe(COPY.filters.completed);
    expect(REMOVE_ACTION_LABEL).toBe(ACCEPTANCE_COPY.removeAction);
  });

  it('never leaves a string blank', () => {
    for (const value of Object.values(ACCEPTANCE_COPY)) {
      expect(typeof value).toBe('string');
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('selectors and test ids', () => {
  it('pins the composer and row hooks the screens render', () => {
    expect(SELECTORS.titleInput).toBe('#new-task-title');
    expect(SELECTORS.submitButton).toBe('.controls-add__submit');
    expect(SELECTORS.taskRow).toBe('li[data-task-id]');
    expect(SELECTORS.taskTitle).toBe('.task-list__title');
    expect(SELECTORS.taskTitleDone).toBe('.task-list__title--done');
    expect(SELECTORS.taskCheckbox).toBe('.task-list__checkbox');
    expect(SELECTORS.removeButton).toBe('.task-list__remove');
  });

  it('derives the testid selectors from the shared ids', () => {
    expect(SELECTORS.taskList).toBe(testIdSelector(TEST_IDS.taskList));
    expect(SELECTORS.emptyState).toBe(testIdSelector(TEST_IDS.taskListEmpty));
    expect(SELECTORS.errorLine).toBe(testIdSelector(TEST_IDS.errorLine));
    expect(SELECTORS.footer).toBe(testIdSelector(TEST_IDS.taskFooter));
  });

  it('keeps every selector and test id unique', () => {
    const selectors = Object.values(SELECTORS);
    expect(new Set(selectors).size).toBe(selectors.length);

    const ids = Object.values(TEST_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('addresses one row by id and every row without one', () => {
    expect(taskRowSelector()).toBe('li[data-task-id]');
    expect(taskRowSelector('a1')).toBe('li[data-task-id="a1"]');
  });

  it('builds a filter control selector per filter', () => {
    expect(filterButtonSelector('all')).toBe('button[data-filter="all"]');
    expect(filterButtonSelector('completed')).toBe('button[data-filter="completed"]');
  });
});

describe('filter contract', () => {
  it('covers every filter in display order', () => {
    expect(FILTER_CONTRACT.map((entry: FilterContract) => entry.filter)).toEqual([...FILTERS]);
  });

  it('carries a label, an empty message and a selector for each filter', () => {
    for (const entry of FILTER_CONTRACT) {
      expect(entry.label).toBe(filterLabelFor(entry.filter));
      expect(entry.emptyMessage).toBe(emptyMessageFor(entry.filter));
      expect(entry.selector).toBe(filterButtonSelector(entry.filter));
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.emptyMessage.length).toBeGreaterThan(0);
    }
  });

  it('gives each filter a distinct empty-state message', () => {
    const messages = FILTERS.map((filter: Filter) => emptyMessageFor(filter));
    expect(new Set(messages).size).toBe(messages.length);
  });
});
