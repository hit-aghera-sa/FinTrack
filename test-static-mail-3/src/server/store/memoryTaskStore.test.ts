import { describe, it, expect } from 'vitest';
import { COPY } from '../../models/index.js';
import type { Task } from '../../models/index.js';
import { createMemoryTaskStore, type MemoryTaskStore } from './memoryTaskStore.js';
import { TaskStoreValidationError } from './taskShape.js';

function makeStore(): MemoryTaskStore {
  let counter = 0;
  let tick = 0;
  return createMemoryTaskStore({
    idFactory: (): string => `id-${(counter += 1)}`,
    now: (): Date => new Date(Date.UTC(2024, 4, 1, 10, 0, (tick += 1))),
  });
}

const seed: Task[] = [
  { id: 'a1', title: 'Alex QA groceries', completed: false, createdAt: '2024-05-01T10:00:00.000Z' },
  { id: 'b2', title: 'Priya Lunch prep', completed: true, createdAt: '2024-05-02T10:00:00.000Z' },
];

describe('createMemoryTaskStore', () => {
  it('starts empty', async () => {
    const store = makeStore();
    expect(store.size()).toBe(0);
    expect(await store.list()).toEqual([]);
    expect(store.snapshot()).toEqual([]);
  });

  it('creates normalised tasks and lists them newest first', async () => {
    const store = makeStore();
    const first = await store.create({ title: '  Alex QA groceries ' });
    const second = await store.create({ title: 'Priya Lunch prep' });

    expect(first.title).toBe('Alex QA groceries');
    expect(first.completed).toBe(false);
    expect(first.id).toBe('id-1');

    const listed = await store.list();
    expect(listed.map((task: Task) => task.id)).toEqual([second.id, first.id]);
    expect(store.size()).toBe(2);
  });

  it('rejects an invalid title on create', async () => {
    const store = makeStore();
    await expect(store.create({ title: '   ' })).rejects.toBeInstanceOf(TaskStoreValidationError);
    await expect(store.create({ title: 'x'.repeat(101) })).rejects.toThrow(COPY.errors.titleTooLong);
    expect(store.size()).toBe(0);
  });

  it('filters the list', async () => {
    const store = createMemoryTaskStore({ initial: seed });
    expect((await store.list({ filter: 'all' })).map((task: Task) => task.id)).toEqual(['b2', 'a1']);
    expect((await store.list({ filter: 'active' })).map((task: Task) => task.id)).toEqual(['a1']);
    expect((await store.list({ filter: 'completed' })).map((task: Task) => task.id)).toEqual(['b2']);
  });

  it('never hands out the backing array', async () => {
    const store = createMemoryTaskStore({ initial: seed });
    const listed = await store.list();
    listed.pop();
    expect(store.size()).toBe(2);
    expect((await store.list()).map((task: Task) => task.title)).toEqual([
      'Priya Lunch prep',
      'Alex QA groceries',
    ]);
  });

  it('gets a single task or null', async () => {
    const store = createMemoryTaskStore({ initial: seed });
    expect(await store.get('a1')).toEqual(seed[0]);
    expect(await store.get('missing')).toBeNull();
  });

  it('patches title and completed', async () => {
    const store = createMemoryTaskStore({ initial: seed });
    const updated = await store.update('a1', { completed: true });
    expect(updated?.completed).toBe(true);
    expect(updated?.title).toBe('Alex QA groceries');

    const renamed = await store.update('a1', { title: '  Alex QA run-b7 ' });
    expect(renamed?.title).toBe('Alex QA run-b7');
    expect(renamed?.completed).toBe(true);

    expect(await store.update('missing', { completed: false })).toBeNull();
  });

  it('rejects an invalid patch without changing the task', async () => {
    const store = createMemoryTaskStore({ initial: seed });
    await expect(store.update('a1', { title: '' })).rejects.toBeInstanceOf(TaskStoreValidationError);
    expect((await store.get('a1'))?.title).toBe('Alex QA groceries');
  });

  it('removes tasks and reports whether anything was removed', async () => {
    const store = createMemoryTaskStore({ initial: seed });
    expect(await store.remove('a1')).toBe(true);
    expect(await store.remove('a1')).toBe(false);
    expect(store.size()).toBe(1);
  });

  it('replaceAll swaps the whole list', async () => {
    const store = createMemoryTaskStore({ initial: seed });
    const next = await store.replaceAll([
      { id: 'c3', title: 'Book dentist', completed: false, createdAt: '2024-05-03T10:00:00.000Z' },
    ]);
    expect(next.map((task: Task) => task.id)).toEqual(['c3']);
    expect(store.size()).toBe(1);
    expect(await store.get('a1')).toBeNull();
  });

  it('replaceAll accepts an envelope and an empty list', async () => {
    const store = createMemoryTaskStore({ initial: seed });
    await store.replaceAll({ tasks: [{ id: 'c3', title: 'Book dentist' }] });
    expect(store.size()).toBe(1);
    await store.replaceAll([]);
    expect(store.snapshot()).toEqual([]);
  });

  it('replaceAll leaves the list untouched when the body is malformed', async () => {
    const store = createMemoryTaskStore({ initial: seed });
    const malformed: unknown[] = [
      null,
      'Alex QA',
      42,
      { items: [] },
      [{ title: '' }],
      [
        { id: 'x', title: 'Alex QA groceries' },
        { id: 'x', title: 'Priya Lunch prep' },
      ],
    ];

    for (const bad of malformed) {
      await expect(store.replaceAll(bad)).rejects.toBeInstanceOf(TaskStoreValidationError);
    }

    expect(store.size()).toBe(2);
    expect(store.snapshot().map((task: Task) => task.id)).toEqual(['b2', 'a1']);
  });

  it('replaceAll strips unknown properties', async () => {
    const store = makeStore();
    const next = await store.replaceAll([{ title: 'Alex QA run-b7', sneaky: true }]);
    expect(Object.keys(next[0] as Task).sort()).toEqual(['completed', 'createdAt', 'id', 'title']);
  });

  it('clear empties the list', async () => {
    const store = createMemoryTaskStore({ initial: seed });
    store.clear();
    expect(store.size()).toBe(0);
    expect(await store.list()).toEqual([]);
  });

  it('throws when seeded with malformed entries', () => {
    expect(() => createMemoryTaskStore({ initial: [{ title: '' }] })).toThrow(TaskStoreValidationError);
  });

  it('keeps separate instances isolated', async () => {
    const a = makeStore();
    const b = makeStore();
    await a.create({ title: 'Alex QA groceries' });
    expect(b.size()).toBe(0);
  });
});
