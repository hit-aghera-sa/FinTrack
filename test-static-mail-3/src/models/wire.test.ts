import { describe, it, expect } from 'vitest';
import {
  isTaskList,
  normalizeTask,
  sanitizeTaskList,
  selectByFilter,
  toTaskListEnvelope,
  unwrapTaskList,
} from './wire.js';
import type { Task } from './task.js';

const PINNED = '2024-05-01T10:00:00.000Z';

const tasks: Task[] = [
  { id: 'c3', title: 'Book dentist run-b7', completed: false, createdAt: '2024-05-03T10:00:00.000Z' },
  { id: 'b2', title: 'Priya Lunch prep', completed: true, createdAt: '2024-05-02T10:00:00.000Z' },
  { id: 'a1', title: 'Alex QA groceries', completed: false, createdAt: PINNED },
];

describe('normalizeTask', () => {
  it('accepts a well-formed record and trims the title', () => {
    expect(normalizeTask({ id: 'a1', title: '  Alex QA run-b7 ', completed: true, createdAt: PINNED })).toEqual({
      id: 'a1',
      title: 'Alex QA run-b7',
      completed: true,
      createdAt: PINNED,
    });
  });

  it('treats a non-true completed value as not completed', () => {
    const task = normalizeTask({ id: 'a1', title: 'Water the plants', completed: 'yes', createdAt: PINNED });
    expect(task?.completed).toBe(false);
  });

  it('falls back to a supplied timestamp when createdAt is missing', () => {
    const task = normalizeTask({ id: 'a1', title: 'Water the plants' }, { fallbackCreatedAt: PINNED });
    expect(task?.createdAt).toBe(PINNED);
  });

  it('rejects records that can never be a task', () => {
    expect(normalizeTask(null)).toBeNull();
    expect(normalizeTask('nope')).toBeNull();
    expect(normalizeTask({ id: '', title: 'x', createdAt: PINNED })).toBeNull();
    expect(normalizeTask({ id: 'a1', title: '   ', createdAt: PINNED })).toBeNull();
    expect(normalizeTask({ id: 'a1', title: 'x'.repeat(101), createdAt: PINNED })).toBeNull();
    expect(normalizeTask({ id: 'a1', title: 'x' })).toBeNull();
  });
});

describe('unwrapTaskList', () => {
  it('accepts a bare array, including an empty one', () => {
    expect(unwrapTaskList([])).toEqual([]);
    expect(unwrapTaskList(tasks)).toHaveLength(3);
  });

  it('accepts the wrapped envelope', () => {
    expect(unwrapTaskList({ tasks })).toHaveLength(3);
  });

  it('copies rather than aliases the incoming array', () => {
    const incoming: unknown[] = [{ id: 'a1', title: 'Alex QA groceries', createdAt: PINNED }];
    const unwrapped = unwrapTaskList(incoming);
    unwrapped?.push({ id: 'b2', title: 'Priya Lunch prep', createdAt: PINNED });
    expect(incoming).toHaveLength(1);
  });

  it('rejects anything that is not a list', () => {
    for (const body of [undefined, null, 'nope', 42, {}, { tasks: 'nope' }]) {
      expect(unwrapTaskList(body)).toBeNull();
    }
  });
});

describe('sanitizeTaskList', () => {
  it('preserves the incoming order', () => {
    const result = sanitizeTaskList(tasks);
    expect(result?.map((task: Task) => task.id)).toEqual(['c3', 'b2', 'a1']);
  });

  it('accepts an empty list as valid input', () => {
    expect(sanitizeTaskList([])).toEqual([]);
  });

  it('drops unusable records instead of throwing', () => {
    const result = sanitizeTaskList([
      { id: 'a1', title: ' Alex QA groceries ', createdAt: PINNED },
      { id: 'b2', title: '   ', createdAt: PINNED },
      'nonsense',
      null,
    ]);
    expect(result?.map((task: Task) => task.title)).toEqual(['Alex QA groceries']);
  });

  it('keeps the first record for a duplicated id', () => {
    const result = sanitizeTaskList([
      { id: 'a1', title: 'Alex QA groceries', createdAt: PINNED },
      { id: 'a1', title: 'Priya Lunch prep', createdAt: PINNED },
    ]);
    expect(result).toHaveLength(1);
    expect(result?.[0]?.title).toBe('Alex QA groceries');
  });

  it('returns null only for a malformed body', () => {
    expect(sanitizeTaskList('nope')).toBeNull();
    expect(sanitizeTaskList({ tasks: 7 })).toBeNull();
  });
});

describe('isTaskList', () => {
  it('recognises a decoded list and refuses anything else', () => {
    expect(isTaskList(tasks)).toBe(true);
    expect(isTaskList([])).toBe(true);
    expect(isTaskList([{ id: 'a1', title: '', completed: false, createdAt: PINNED }])).toBe(false);
    expect(isTaskList({ tasks })).toBe(false);
  });
});

describe('envelope and filtering', () => {
  it('wraps a copied list in the tasks envelope', () => {
    const envelope = toTaskListEnvelope(tasks);
    expect(envelope.tasks).toHaveLength(3);
    envelope.tasks.pop();
    expect(tasks).toHaveLength(3);
  });

  it('selects by filter without mutating the input', () => {
    expect(selectByFilter(tasks, 'all').map((task: Task) => task.id)).toEqual(['c3', 'b2', 'a1']);
    expect(selectByFilter(tasks, 'active').map((task: Task) => task.id)).toEqual(['c3', 'a1']);
    expect(selectByFilter(tasks, 'completed').map((task: Task) => task.id)).toEqual(['b2']);
    expect(tasks).toHaveLength(3);
  });
});
