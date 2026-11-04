import { describe, it, expect } from 'vitest';
import { COPY } from '../../models/index.js';
import type { Task } from '../../models/index.js';
import {
  MAX_TASKS,
  TaskStoreValidationError,
  defaultTaskId,
  isIsoTimestamp,
  parseTask,
  parseTaskList,
} from './taskShape.js';
import type { ParseTaskOptions } from './taskShape.js';

/** Pinned timestamp so nothing in this suite depends on the wall clock. */
const PINNED = '2024-05-01T10:00:00.000Z';

/** Deterministic id/clock overrides, mirroring how the store injects them. */
function options(prefix = 'id'): ParseTaskOptions {
  let counter = 0;
  return {
    idFactory: (): string => `${prefix}-${(counter += 1)}`,
    now: (): string => PINNED,
  };
}

describe('isIsoTimestamp', () => {
  it('accepts parseable date strings', () => {
    expect(isIsoTimestamp(PINNED)).toBe(true);
    expect(isIsoTimestamp('2024-05-01')).toBe(true);
  });

  it('rejects blanks, non-strings and unparseable text', () => {
    expect(isIsoTimestamp('')).toBe(false);
    expect(isIsoTimestamp('   ')).toBe(false);
    expect(isIsoTimestamp('not a date')).toBe(false);
    expect(isIsoTimestamp(null)).toBe(false);
    expect(isIsoTimestamp(1717236000000)).toBe(false);
  });
});

describe('defaultTaskId', () => {
  it('produces opaque, prefixed, unique ids', () => {
    const first = defaultTaskId();
    const second = defaultTaskId();
    expect(first.startsWith('t-')).toBe(true);
    expect(first).not.toBe(second);
  });
});

describe('parseTask', () => {
  it('normalises a well-formed entry', () => {
    const result = parseTask(
      { id: '  a1  ', title: '  Alex QA groceries ', completed: true, createdAt: PINNED },
      options(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        id: 'a1',
        title: 'Alex QA groceries',
        completed: true,
        createdAt: PINNED,
      });
    }
  });

  it('fills in the id and the timestamp from the injected factories', () => {
    const result = parseTask({ title: 'Priya Lunch prep' }, options('seed'));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('seed-1');
      expect(result.value.createdAt).toBe(PINNED);
      expect(result.value.completed).toBe(false);
    }
  });

  it('treats an explicit null id, completed or createdAt as absent', () => {
    const result = parseTask(
      { id: null, title: 'Book dentist', completed: null, createdAt: null },
      options(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('id-1');
      expect(result.value.completed).toBe(false);
      expect(result.value.createdAt).toBe(PINNED);
    }
  });

  it('normalises a non-canonical timestamp to ISO-8601', () => {
    const result = parseTask({ title: 'Alex QA run-b7', createdAt: '2024-05-01' }, options());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.createdAt).toBe('2024-05-01T00:00:00.000Z');
    }
  });

  it('drops unknown properties so a payload cannot smuggle state in', () => {
    const result = parseTask(
      { title: 'Alex QA groceries', sneaky: true, __proto__: { evil: true } },
      options(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value).sort()).toEqual(['completed', 'createdAt', 'id', 'title']);
    }
  });

  it('rejects anything that is not a plain object', () => {
    for (const bad of [null, undefined, 'Alex QA', 42, true, [], [{ title: 'x' }]]) {
      const result = parseTask(bad, options());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('bad_request');
        expect(result.message).toBe(COPY.errors.unexpected);
      }
    }
  });

  it('reports the shared title validation codes', () => {
    const missing = parseTask({ title: '   ' }, options());
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe('title_required');
      expect(missing.message).toBe(COPY.errors.titleRequired);
    }

    const long = parseTask({ title: 'x'.repeat(101) }, options());
    expect(long.ok).toBe(false);
    if (!long.ok) {
      expect(long.code).toBe('title_too_long');
      expect(long.message).toBe(COPY.errors.titleTooLong);
    }

    const exact = parseTask({ title: 'x'.repeat(100) }, options());
    expect(exact.ok).toBe(true);
  });

  it('rejects a malformed id, completed flag or timestamp', () => {
    const malformed: unknown[] = [
      { id: '', title: 'Alex QA groceries' },
      { id: '   ', title: 'Alex QA groceries' },
      { id: 7, title: 'Alex QA groceries' },
      { title: 'Alex QA groceries', completed: 'yes' },
      { title: 'Alex QA groceries', completed: 1 },
      { title: 'Alex QA groceries', createdAt: 'not a date' },
      { title: 'Alex QA groceries', createdAt: 17 },
    ];

    for (const bad of malformed) {
      const result = parseTask(bad, options());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('bad_request');
      }
    }
  });
});

describe('parseTaskList', () => {
  it('accepts a bare array and preserves the incoming order', () => {
    const result = parseTaskList(
      [
        { id: 'c3', title: 'Book dentist run-b7', createdAt: '2024-05-03T10:00:00.000Z' },
        { id: 'b2', title: 'Priya Lunch prep', completed: true, createdAt: '2024-05-02T10:00:00.000Z' },
        { id: 'a1', title: 'Alex QA groceries', createdAt: PINNED },
      ],
      options(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((task: Task) => task.id)).toEqual(['c3', 'b2', 'a1']);
    }
  });

  it('accepts the { tasks } envelope', () => {
    const result = parseTaskList({ tasks: [{ title: 'Alex QA run-b7' }] }, options());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.title).toBe('Alex QA run-b7');
    }
  });

  it('accepts an empty list (a full-list PUT may clear everything)', () => {
    expect(parseTaskList([], options())).toEqual({ ok: true, value: [] });
    expect(parseTaskList({ tasks: [] }, options())).toEqual({ ok: true, value: [] });
  });

  it('rejects a body that is not a list', () => {
    for (const bad of [undefined, null, 'Alex QA', 42, true, {}, { items: [] }, { tasks: 'nope' }]) {
      const result = parseTaskList(bad, options());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('bad_request');
        expect(result.message).toBe(COPY.errors.unexpected);
      }
    }
  });

  it('rejects the whole body when a single entry is malformed', () => {
    const result = parseTaskList(
      [{ id: 'a1', title: 'Alex QA groceries', createdAt: PINNED }, { title: '' }],
      options(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('title_required');
    }
  });

  it('rejects duplicate ids', () => {
    const result = parseTaskList(
      [
        { id: 'x', title: 'Alex QA groceries' },
        { id: 'x', title: 'Priya Lunch prep' },
      ],
      options(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('bad_request');
    }
  });

  it('accepts exactly MAX_TASKS entries and rejects one more', () => {
    const entry = (index: number): unknown => ({
      id: `t-${index}`,
      title: 'Alex QA groceries',
      createdAt: PINNED,
    });

    const atLimit = parseTaskList(
      Array.from({ length: MAX_TASKS }, (_unused: unknown, index: number) => entry(index)),
      options(),
    );
    expect(atLimit.ok).toBe(true);

    const overLimit = parseTaskList(
      Array.from({ length: MAX_TASKS + 1 }, (_unused: unknown, index: number) => entry(index)),
      options(),
    );
    expect(overLimit.ok).toBe(false);
    if (!overLimit.ok) {
      expect(overLimit.code).toBe('bad_request');
    }
  });

  it('never aliases the incoming array', () => {
    const incoming: unknown[] = [{ id: 'a1', title: 'Alex QA groceries', createdAt: PINNED }];
    const result = parseTaskList(incoming, options());
    expect(result.ok).toBe(true);
    if (result.ok) {
      result.value.pop();
      expect(incoming).toHaveLength(1);
    }
  });

  it('works without any options, generating ids and timestamps itself', () => {
    const result = parseTaskList([{ title: 'Priya Lunch prep' }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const task = result.value[0] as Task;
      expect(task.id.startsWith('t-')).toBe(true);
      expect(isIsoTimestamp(task.createdAt)).toBe(true);
    }
  });
});

describe('TaskStoreValidationError', () => {
  it('carries the machine-readable code alongside the message', () => {
    const error = new TaskStoreValidationError('title_required', COPY.errors.titleRequired);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TaskStoreValidationError');
    expect(error.code).toBe('title_required');
    expect(error.message).toBe(COPY.errors.titleRequired);
  });
});
