import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FILTER,
  FILTERS,
  TITLE_MAX_LENGTH,
  TaskValidationError,
  applyTaskPatch,
  countActive,
  countCompleted,
  createTask,
  filterTasks,
  isFilter,
  isTask,
  isValidTitle,
  normalizeTitle,
  parseFilter,
  sortTasks,
  toggleTask,
  validateTitle,
  type Task,
} from './task.js';
import { COPY } from './copy.js';

const sample: Task[] = [
  { id: 'a1', title: 'Alex QA groceries', completed: false, createdAt: '2024-05-01T10:00:00.000Z' },
  { id: 'b2', title: 'Priya Lunch prep', completed: true, createdAt: '2024-05-02T10:00:00.000Z' },
  { id: 'c3', title: 'Book dentist', completed: false, createdAt: '2024-05-03T10:00:00.000Z' },
];

describe('title validation', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeTitle('   Alex QA run-b7  ')).toBe('Alex QA run-b7');
  });

  it('accepts a trimmed title within bounds', () => {
    expect(validateTitle('  Water the plants ')).toEqual({ ok: true, value: 'Water the plants' });
  });

  it('rejects empty and whitespace-only titles with the copy message', () => {
    for (const raw of ['', '   ', '\n\t']) {
      const result = validateTitle(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('title_required');
        expect(result.message).toBe(COPY.errors.titleRequired);
      }
    }
  });

  it('rejects non-string input', () => {
    expect(validateTitle(undefined).ok).toBe(false);
    expect(validateTitle(42).ok).toBe(false);
  });

  it('accepts exactly the maximum length and rejects one more', () => {
    const max = 'x'.repeat(TITLE_MAX_LENGTH);
    expect(isValidTitle(max)).toBe(true);

    const tooLong = validateTitle(`${max}y`);
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) {
      expect(tooLong.code).toBe('title_too_long');
      expect(tooLong.message).toBe(COPY.errors.titleTooLong);
    }
  });

  it('measures length after trimming', () => {
    expect(isValidTitle(`  ${'x'.repeat(TITLE_MAX_LENGTH)}  `)).toBe(true);
  });
});

describe('filters', () => {
  it('exposes the three filters in display order', () => {
    expect([...FILTERS]).toEqual(['all', 'active', 'completed']);
    expect(DEFAULT_FILTER).toBe('all');
  });

  it('guards and parses unknown values', () => {
    expect(isFilter('active')).toBe(true);
    expect(isFilter('archived')).toBe(false);
    expect(parseFilter('completed')).toBe('completed');
    expect(parseFilter(null)).toBe('all');
  });

  it('selects the visible tasks without mutating the input', () => {
    expect(filterTasks(sample, 'all')).toHaveLength(3);
    expect(filterTasks(sample, 'active').map((task: Task) => task.id)).toEqual(['a1', 'c3']);
    expect(filterTasks(sample, 'completed').map((task: Task) => task.id)).toEqual(['b2']);
    expect(sample).toHaveLength(3);
  });

  it('counts active and completed tasks', () => {
    expect(countActive(sample)).toBe(2);
    expect(countCompleted(sample)).toBe(1);
    expect(countActive([])).toBe(0);
  });
});

describe('task factory helpers', () => {
  it('creates a normalised task with defaults', () => {
    const task = createTask({ id: 'a1', title: '  Alex QA run-b7 ', createdAt: '2024-05-01T10:00:00.000Z' });
    expect(task).toEqual({
      id: 'a1',
      title: 'Alex QA run-b7',
      completed: false,
      createdAt: '2024-05-01T10:00:00.000Z',
    });
  });

  it('throws a TaskValidationError for an invalid title', () => {
    expect(() => createTask({ id: 'a1', title: '   ' })).toThrow(TaskValidationError);
    try {
      createTask({ id: 'a1', title: '' });
      throw new Error('expected createTask to throw');
    } catch (error: unknown) {
      expect(error instanceof TaskValidationError).toBe(true);
      if (error instanceof TaskValidationError) {
        expect(error.code).toBe('title_required');
        expect(error.message).toBe(COPY.errors.titleRequired);
      }
    }
  });

  it('patches immutably and validates patched titles', () => {
    const original = sample[0] as Task;
    const patched = applyTaskPatch(original, { title: '  Renamed task ', completed: true });
    expect(patched).toEqual({
      id: 'a1',
      title: 'Renamed task',
      completed: true,
      createdAt: original.createdAt,
    });
    expect(original.title).toBe('Alex QA groceries');
    expect(() => applyTaskPatch(original, { title: ' ' })).toThrow(TaskValidationError);
  });

  it('toggles completion immutably', () => {
    const original = sample[0] as Task;
    expect(toggleTask(original).completed).toBe(true);
    expect(original.completed).toBe(false);
  });

  it('sorts newest first with deterministic tie-breaking', () => {
    expect(sortTasks(sample).map((task: Task) => task.id)).toEqual(['c3', 'b2', 'a1']);
    const tied: Task[] = [
      { id: 'z9', title: 'Later id', completed: false, createdAt: '2024-05-04T10:00:00.000Z' },
      { id: 'a0', title: 'Earlier id', completed: false, createdAt: '2024-05-04T10:00:00.000Z' },
    ];
    expect(sortTasks(tied).map((task: Task) => task.id)).toEqual(['a0', 'z9']);
  });

  it('guards decoded task payloads', () => {
    expect(isTask(sample[0])).toBe(true);
    expect(isTask({ id: 'a1', title: 'x', completed: 'yes', createdAt: 'now' })).toBe(false);
    expect(isTask(null)).toBe(false);
  });
});
