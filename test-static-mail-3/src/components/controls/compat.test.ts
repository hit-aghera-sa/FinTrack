import { describe, it, expect } from 'vitest';
import { resolveFooterSummary, resolveSubmitHandler, type SubmitHandler } from './compat.js';
import type { Task } from '../../models/index.js';

const tasks: Task[] = [
  { id: 'a1', title: 'Alex QA groceries', completed: false, createdAt: '2024-05-01T10:00:00.000Z' },
  { id: 'b2', title: 'Priya Lunch prep', completed: true, createdAt: '2024-05-02T10:00:00.000Z' },
  { id: 'c3', title: 'Book dentist run-b7', completed: false, createdAt: '2024-05-03T10:00:00.000Z' },
];

function collect(into: string[]): SubmitHandler {
  return (title: string): void => {
    into.push(title);
  };
}

describe('resolveSubmitHandler', () => {
  it('uses onSubmit when it is the only callback given', () => {
    const submitted: string[] = [];
    resolveSubmitHandler(collect(submitted), undefined)('Alex QA run-b7');
    expect(submitted).toEqual(['Alex QA run-b7']);
  });

  it('falls back to the onAdd alias when onSubmit is absent', () => {
    const added: string[] = [];
    resolveSubmitHandler(undefined, collect(added))('Priya Lunch prep');
    expect(added).toEqual(['Priya Lunch prep']);
  });

  it('prefers onSubmit when both callbacks are supplied', () => {
    const submitted: string[] = [];
    const added: string[] = [];
    resolveSubmitHandler(collect(submitted), collect(added))('Book dentist run-b7');
    expect(submitted).toEqual(['Book dentist run-b7']);
    expect(added).toEqual([]);
  });

  it('is a harmless no-op when neither callback is supplied', () => {
    expect(resolveSubmitHandler(undefined, undefined)('Alex QA groceries')).toBeUndefined();
  });
});

describe('resolveFooterSummary', () => {
  it('counts over the full task list when one is given', () => {
    expect(resolveFooterSummary(tasks)).toEqual({ done: 1, total: 3, text: '1 of 3 tasks done' });
  });

  it('reports an empty list as 0 of 0', () => {
    expect(resolveFooterSummary([])).toEqual({ done: 0, total: 0, text: '0 of 0 tasks done' });
  });

  it('adds the active and completed counts when no list is given', () => {
    expect(resolveFooterSummary(undefined, 2, 1)).toEqual({
      done: 1,
      total: 3,
      text: '1 of 3 tasks done',
    });
  });

  it('treats a missing count as zero', () => {
    expect(resolveFooterSummary(undefined, undefined, 2).text).toBe('2 of 2 tasks done');
    expect(resolveFooterSummary(undefined, 4, undefined).text).toBe('0 of 4 tasks done');
    expect(resolveFooterSummary().text).toBe('0 of 0 tasks done');
  });

  it('prefers the task list over the supplied counts', () => {
    expect(resolveFooterSummary(tasks, 99, 99).text).toBe('1 of 3 tasks done');
  });
});
