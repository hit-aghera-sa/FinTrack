import { describe, it, expect, beforeEach } from 'vitest';
import type { Task } from '../../models/index.js';
import { getTaskStore, resetTaskStore, taskStoreFactory } from './sharedTaskStore.js';

beforeEach(() => {
  resetTaskStore();
});

describe('sharedTaskStore', () => {
  it('returns the same instance on repeated access', () => {
    const first = getTaskStore();
    const second = getTaskStore();
    expect(second).toBe(first);
    expect(taskStoreFactory()).toBe(first);
  });

  it('starts empty', async () => {
    expect(await getTaskStore().list()).toEqual([]);
  });

  it('shares state between callers', async () => {
    await getTaskStore().create({ title: 'Alex QA run-b7' });
    const listed = await taskStoreFactory().list();
    expect(listed.map((task: Task) => task.title)).toEqual(['Alex QA run-b7']);
  });

  it('reset swaps in a fresh store', async () => {
    const before = getTaskStore();
    await before.create({ title: 'Priya Lunch prep' });

    const after = resetTaskStore();
    expect(after).not.toBe(before);
    expect(await after.list()).toEqual([]);
    expect(getTaskStore()).toBe(after);
  });

  it('reset can seed the shared list', async () => {
    const store = resetTaskStore({
      initial: [{ id: 'a1', title: 'Book dentist', completed: false, createdAt: '2024-05-01T10:00:00.000Z' }],
    });
    expect((await store.list()).map((task: Task) => task.id)).toEqual(['a1']);
  });

  it('supports full-list replacement through the shared instance', async () => {
    await getTaskStore().replaceAll([{ id: 'c3', title: 'Alex QA groceries' }]);
    expect(getTaskStore().size()).toBe(1);
    await getTaskStore().replaceAll([]);
    expect(getTaskStore().size()).toBe(0);
  });
});
