import { describe, it, expect } from 'vitest';
import { createSaveQueue } from './taskQueue.js';
import type { Task } from '../models/index.js';

const PINNED = '2024-05-01T10:00:00.000Z';

function task(id: string, title: string): Task {
  return { id, title, completed: false, createdAt: PINNED };
}

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolveFn: (() => void) | null = null;
  const promise = new Promise<void>((res) => {
    resolveFn = (): void => res();
  });
  return {
    promise,
    resolve(): void {
      if (resolveFn !== null) resolveFn();
    },
  };
}

/** Drain the microtask queue so chained saves get a chance to start. */
async function flush(times = 12): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}

describe('createSaveQueue', () => {
  it('starts the first save immediately', () => {
    const seen: number[] = [];
    const queue = createSaveQueue((tasks: readonly Task[]): Promise<unknown> => {
      seen.push(tasks.length);
      return Promise.resolve(undefined);
    });

    queue.enqueue([task('a1', 'Alex QA groceries')]);
    expect(seen).toEqual([1]);
  });

  it('never runs two saves at once and preserves enqueue order', async () => {
    const sizes: number[] = [];
    const gates: Deferred[] = [deferred(), deferred(), deferred()];
    const queue = createSaveQueue((tasks: readonly Task[]): Promise<unknown> => {
      sizes.push(tasks.length);
      return gates[sizes.length - 1]!.promise;
    });

    queue.enqueue([task('a1', 'Alex QA groceries')]);
    queue.enqueue([task('a1', 'Alex QA groceries'), task('b2', 'Priya Lunch prep')]);
    queue.enqueue([
      task('a1', 'Alex QA groceries'),
      task('b2', 'Priya Lunch prep'),
      task('c3', 'Book dentist run-b7'),
    ]);

    expect(sizes).toEqual([1]);
    expect(queue.pending).toBe(3);

    gates[0]!.resolve();
    await flush();
    expect(sizes).toEqual([1, 2]);

    gates[1]!.resolve();
    await flush();
    expect(sizes).toEqual([1, 2, 3]);

    gates[2]!.resolve();
    await queue.idle();
    expect(queue.pending).toBe(0);
  });

  it('sends a snapshot of the list, not a live reference', async () => {
    const sent: Task[][] = [];
    const queue = createSaveQueue((tasks: readonly Task[]): Promise<unknown> => {
      sent.push([...tasks]);
      return Promise.resolve(undefined);
    });

    const list: Task[] = [task('a1', 'Alex QA groceries')];
    queue.enqueue(list);
    list.push(task('b2', 'Priya Lunch prep'));

    await queue.idle();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(1);
  });

  it('reports a failure and still runs the saves queued behind it', async () => {
    const errors: unknown[] = [];
    const successes: number[] = [];
    let calls = 0;

    const queue = createSaveQueue(
      (): Promise<unknown> => {
        calls += 1;
        return calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(undefined);
      },
      {
        onSuccess: (): void => {
          successes.push(calls);
        },
        onError: (cause: unknown): void => {
          errors.push(cause);
        },
      },
    );

    queue.enqueue([task('a1', 'Alex QA groceries')]);
    queue.enqueue([task('a1', 'Alex QA groceries'), task('b2', 'Priya Lunch prep')]);

    await queue.idle();
    expect(errors).toHaveLength(1);
    expect(successes).toEqual([2]);
    expect(queue.pending).toBe(0);
  });

  it('treats a synchronous throw as a failed save', async () => {
    const errors: unknown[] = [];
    const queue = createSaveQueue(
      (): Promise<unknown> => {
        throw new Error('boom');
      },
      {
        onError: (cause: unknown): void => {
          errors.push(cause);
        },
      },
    );

    queue.enqueue([]);
    await queue.idle();

    expect(errors).toHaveLength(1);
    expect(queue.pending).toBe(0);
  });

  it('idles when there is nothing to do', async () => {
    const queue = createSaveQueue((): Promise<unknown> => Promise.resolve(undefined));
    expect(queue.pending).toBe(0);
    await expect(queue.idle()).resolves.toBeUndefined();
  });
});
