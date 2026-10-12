/**
 * The activity store the feed reads and the recording service writes through.
 *
 * `ActivityRepository` is the INTERFACE the service and the HTTP layer are
 * written against, so the storage behind it can change without touching a rule
 * or a route: a Prisma-backed implementation of this same interface drops
 * straight into the composition root.
 *
 * `createMemoryActivityRepository` is the implementation this build ships with.
 * It keeps the entries of every task in memory, hands them back NEWEST FIRST,
 * and applies the same limit clamp the HTTP layer uses.
 */

import {
  MAX_ACTIVITY_LIMIT,
  type NewTaskActivity,
  type TaskActivity,
} from "./types.js";

/** Everything the activity feature asks of its store. */
export interface ActivityRepository {
  /**
   * One task's entries, NEWEST FIRST. `limit` caps how many are returned; it is
   * clamped to {@link MAX_ACTIVITY_LIMIT}.
   */
  listByTask(taskId: string, limit?: number): Promise<TaskActivity[]>;
  /** Records one entry and returns it as stored. */
  create(entry: NewTaskActivity): Promise<TaskActivity>;
}

/** How an in-memory store is built. */
export interface MemoryActivityRepositoryOptions {
  /** The clock the stamps come from. Defaults to the real one; tests pin it. */
  now?: () => Date;
}

/** The number of entries a read may really return. */
export function clampActivityLimit(limit: number): number {
  const whole = Math.trunc(limit);
  if (!Number.isFinite(whole) || whole < 1) {
    return 1;
  }
  return Math.min(whole, MAX_ACTIVITY_LIMIT);
}

/**
 * Builds an in-memory activity store. The composition root creates one for the
 * lifetime of the process, so every request sees the same feed.
 */
export function createMemoryActivityRepository(
  options: MemoryActivityRepositoryOptions = {},
): ActivityRepository {
  const rows: TaskActivity[] = [];
  const clock: () => Date = options.now ?? ((): Date => new Date());
  let sequence = 0;

  return {
    async listByTask(taskId: string, limit?: number): Promise<TaskActivity[]> {
      const mine = rows.filter((row: TaskActivity): boolean => row.taskId === taskId);
      const newestFirst = mine.reverse();
      if (limit === undefined) {
        return newestFirst;
      }
      return newestFirst.slice(0, clampActivityLimit(limit));
    },

    async create(entry: NewTaskActivity): Promise<TaskActivity> {
      sequence += 1;
      const stored: TaskActivity = {
        id: `activity-${String(sequence)}`,
        taskId: entry.taskId,
        kind: entry.kind,
        field: entry.field ?? null,
        fromValue: entry.fromValue ?? null,
        toValue: entry.toValue ?? null,
        // The name the timeline shows. Stored exactly as the service resolved it.
        actor: entry.actor ?? null,
        message: entry.message,
        createdAt: clock().toISOString(),
      };
      rows.push(stored);
      return stored;
    },
  };
}
