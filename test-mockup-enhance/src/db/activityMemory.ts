/**
 * The in-memory task activity store.
 *
 * The very same `TaskActivityRepository` interface as the Prisma-backed one, so
 * the app can boot its test-mode datastore (`APP_DB=memory`) and backend unit
 * tests can exercise the activity endpoints without a database. No Prisma
 * import, so importing this module costs nothing.
 */

import {
  normaliseActivityLimit,
  toActivityWriteData,
  type TaskActivityWriteData,
} from "./activityMappers.js";
import type {
  NewTaskActivity,
  TaskActivity,
  TaskActivityRepository,
} from "../models/activity.js";

/** One stored entry, with the insertion order used to break timestamp ties. */
interface StoredActivity {
  id: string;
  sequence: number;
  createdAt: string;
  data: TaskActivityWriteData;
}

function toPayload(stored: StoredActivity): TaskActivity {
  return {
    id: stored.id,
    taskId: stored.data.taskId,
    kind: stored.data.kind,
    field: stored.data.field,
    fromValue: stored.data.fromValue,
    toValue: stored.data.toValue,
    actor: stored.data.actor,
    message: stored.data.message,
    createdAt: stored.createdAt,
  };
}

/** Newest first: by timestamp, then by insertion order. */
function newestFirst(left: StoredActivity, right: StoredActivity): number {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt < right.createdAt ? 1 : -1;
  }
  return right.sequence - left.sequence;
}

/** A fresh, empty activity store. */
export function createMemoryTaskActivityRepository(): TaskActivityRepository {
  const rows: StoredActivity[] = [];
  let sequence = 0;

  const write = (input: NewTaskActivity): StoredActivity => {
    sequence += 1;
    const stored: StoredActivity = {
      id: `activity-m${String(sequence)}`,
      sequence,
      createdAt: new Date().toISOString(),
      data: toActivityWriteData(input),
    };
    rows.push(stored);
    return stored;
  };

  return {
    record(input: NewTaskActivity): Promise<TaskActivity> {
      return Promise.resolve(toPayload(write(input)));
    },

    recordMany(inputs: readonly NewTaskActivity[]): Promise<TaskActivity[]> {
      const written: TaskActivity[] = [];
      for (const input of inputs) {
        written.push(toPayload(write(input)));
      }
      return Promise.resolve(written);
    },

    listByTask(taskId: string, limit?: number): Promise<TaskActivity[]> {
      const take = normaliseActivityLimit(limit);
      if (take === 0) {
        return Promise.resolve([]);
      }
      const feed = rows
        .filter((stored: StoredActivity): boolean => stored.data.taskId === taskId)
        .sort(newestFirst)
        .map(toPayload);
      return Promise.resolve(take === undefined ? feed : feed.slice(0, take));
    },
  };
}
