/**
 * A strictly SERIAL write queue for the full-list `PUT /api/tasks` call.
 *
 * `useTasks` updates the screen optimistically and fires the save WITHOUT awaiting
 * it. Firing several of those concurrently is what makes a last-write-wins endpoint
 * non-deterministic: two overlapping PUTs can arrive in the opposite order, leaving
 * the server holding an older list than the one on screen.
 *
 * This queue keeps AT MOST ONE save in flight and runs the remaining saves in the
 * exact order they were enqueued, so the final stored list always equals the final
 * rendered list. From the caller's point of view nothing changed: `enqueue` returns
 * immediately and never throws or rejects.
 *
 * Pure module: no React, no fetch, nothing touched at import time.
 */
import type { Task } from '../models/index.js';

/** The persistence call the queue drives (the hook passes the API client's save). */
export type SaveFn = (tasks: readonly Task[]) => Promise<unknown>;

/** Callbacks invoked once per completed save, in completion (= enqueue) order. */
export interface SaveQueueHandlers {
  /** A save resolved. The hook clears the error line here. */
  readonly onSuccess?: () => void;
  /** A save rejected. The hook renders ONE message here and keeps the list as-is. */
  readonly onError?: (cause: unknown) => void;
}

/** The queue handed to the hook. */
export interface SaveQueue {
  /** Saves not yet settled (in flight plus waiting). */
  readonly pending: number;
  /** Schedule a save of `tasks`. Returns immediately; never throws. */
  enqueue(tasks: readonly Task[]): void;
  /** Resolves when everything enqueued so far has settled. */
  idle(): Promise<void>;
}

/**
 * Create a serial save queue.
 *
 * The FIRST enqueue while the queue is idle calls `save` synchronously, matching the
 * previous fire-and-forget timing; any further enqueue waits for the running save to
 * settle before starting.
 */
export function createSaveQueue(save: SaveFn, handlers: SaveQueueHandlers = {}): SaveQueue {
  let tail: Promise<void> | null = null;
  let pending = 0;

  function runOne(snapshot: readonly Task[]): Promise<void> {
    let started: Promise<unknown>;
    try {
      started = Promise.resolve(save(snapshot));
    } catch (cause: unknown) {
      started = Promise.reject(cause);
    }
    return started.then(
      (): void => {
        pending -= 1;
        if (handlers.onSuccess !== undefined) handlers.onSuccess();
      },
      (cause: unknown): void => {
        pending -= 1;
        if (handlers.onError !== undefined) handlers.onError(cause);
      },
    );
  }

  const queue: SaveQueue = {
    get pending(): number {
      return pending;
    },
    enqueue(tasks: readonly Task[]): void {
      const snapshot: Task[] = [...tasks];
      pending += 1;
      const next: Promise<void> =
        tail === null ? runOne(snapshot) : tail.then((): Promise<void> => runOne(snapshot));
      const guarded: Promise<void> = next.then((): void => {
        if (tail === guarded) tail = null;
      });
      tail = guarded;
    },
    idle(): Promise<void> {
      const current = tail;
      if (current === null) return Promise.resolve();
      return current.then((): void => undefined);
    },
  };

  return queue;
}
