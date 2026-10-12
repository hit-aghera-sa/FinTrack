/**
 * THE CHECKLIST REPOSITORY.
 *
 * Reads and writes the `ChecklistItem` table through Prisma, and is written
 * against a small {@link ChecklistDataSource} seam so the same rules can be
 * exercised against an in-memory source in the unit tests.
 *
 * Nothing happens at import time: the Prisma client is only reached when a
 * data source (or a repository without an explicit source) is actually built.
 *
 * The shared checklist types live in src/models/checklist/index.ts and are
 * imported from there — this module never re-declares one.
 *
 * The behaviour the rest of the app relies on:
 *   • list by task, ordered by `position` (the creation order — nothing reorders
 *     a checklist);
 *   • create, with the title normalised, a blank title refused, `done` false
 *     and the next free `position` assigned once;
 *   • set `done` on ONE item OF ONE TASK (ticking an item never touches the
 *     task's own status), answering `null` when that task has no such item;
 *   • remove one item of one task, immediately — there is no confirmation step
 *     in the data layer — answering `false` when there is nothing to remove;
 *   • progress counts for a SET of task ids, one entry per requested id, `0/0`
 *     for a task with no items; with no ids, one entry per task that has items.
 *
 * Whether the task itself exists is the HTTP layer's business (it answers 404);
 * the repository only ever scopes a write to the task it was asked about.
 */

// The generated Prisma client of this project, whose client is emitted to a
// dedicated directory and re-exported from src/db/generated.ts — structurally
// the `PrismaClient` of `@prisma/client`.
import type { PrismaClient } from "../../db/generated.js";

import { prisma } from "../../db/client.js";
import {
  compareChecklistItems,
  countChecklistProgress,
  normaliseChecklistTitle,
  uniqueTaskIds,
  type ChecklistItem,
  type ChecklistItemInput,
  type ChecklistProgress,
} from "../../models/checklist/index.js";

/** One stored row, exactly as the datastore holds it. */
export interface ChecklistItemRow {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  position: number;
  createdAt: Date;
}

/** The fields a write supplies; the id and the stamp are the store's job. */
export interface ChecklistRowFields {
  taskId: string;
  title: string;
  done: boolean;
  position: number;
}

/** Raised when a checklist item is created with no title. The router answers 400. */
export class MissingChecklistTitleError extends Error {
  constructor() {
    super("A checklist item title is required.");
    this.name = "MissingChecklistTitleError";
  }
}

/**
 * Raised by a DATA SOURCE asked to write a row that is not there.
 *
 * The repository checks first and answers `null` / `false` instead, so this
 * only ever surfaces from a direct data-source call.
 */
export class UnknownChecklistItemError extends Error {
  /** The id that matched no checklist item. */
  readonly itemId: string;

  constructor(itemId: string) {
    super("That checklist item does not exist.");
    this.name = "UnknownChecklistItemError";
    this.itemId = itemId;
  }
}

/** A stored row as the shared domain model. */
export function toChecklistItem(row: ChecklistItemRow): ChecklistItem {
  return {
    id: row.id,
    taskId: row.taskId,
    title: row.title,
    done: row.done,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The datastore operations the checklist repository needs. */
export interface ChecklistDataSource {
  /** One task's rows, ordered by `position`. */
  listRowsByTask(taskId: string): Promise<ChecklistItemRow[]>;
  /** The rows of several tasks at once, for the progress counts. */
  listRowsByTasks(taskIds: readonly string[]): Promise<ChecklistItemRow[]>;
  /** Every stored row, ordered by task and then by `position`. */
  listAllRows(): Promise<ChecklistItemRow[]>;
  /** The row with this id BELONGING TO THIS TASK, or null. */
  findRow(taskId: string, itemId: string): Promise<ChecklistItemRow | null>;
  /** The position the next item of this task takes (1 for the first). */
  nextPosition(taskId: string): Promise<number>;
  /** Inserts a row and returns it. */
  insertRow(fields: ChecklistRowFields): Promise<ChecklistItemRow>;
  /** Sets a row's `done` flag and returns the row. The row is known to exist. */
  updateRowDone(itemId: string, done: boolean): Promise<ChecklistItemRow>;
  /** Deletes a row. The row is known to exist. */
  deleteRow(itemId: string): Promise<void>;
}

/** Everything the checklist feature asks of its store. */
export interface ChecklistRepository {
  /** One task's checklist, ordered by `position`. */
  listByTask(taskId: string): Promise<ChecklistItem[]>;
  /**
   * Adds an item to the end of a task's checklist.
   *
   * Rejects with {@link MissingChecklistTitleError} when no title was given.
   */
  create(input: ChecklistItemInput): Promise<ChecklistItem>;
  /**
   * Ticks or unticks one item of one task, and returns it as stored. The task's
   * own status is NEVER changed.
   *
   * Answers `null` when that task has no item with that id.
   */
  setDone(taskId: string, itemId: string, done: boolean): Promise<ChecklistItem | null>;
  /**
   * Removes one item of one task, immediately.
   *
   * Answers `true` when an item was removed and `false` when there was nothing
   * to remove.
   */
  remove(taskId: string, itemId: string): Promise<boolean>;
  /**
   * The progress counts of a set of task ids: one entry per requested id, in
   * the order asked for, with `0/0` for a task that has no items. Called with
   * no ids it reports every task that has a checklist, in task-id order.
   */
  progress(taskIds?: readonly string[]): Promise<ChecklistProgress[]>;
}

/** The order one task's rows are always read in. */
function compareRows(left: ChecklistItemRow, right: ChecklistItemRow): number {
  if (left.position !== right.position) {
    return left.position - right.position;
  }
  const leftTime = left.createdAt.getTime();
  const rightTime = right.createdAt.getTime();
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return left.id.localeCompare(right.id, "en");
}

/** The order a read of MANY tasks' rows comes back in: by task, then position. */
function compareRowsAcrossTasks(left: ChecklistItemRow, right: ChecklistItemRow): number {
  if (left.taskId !== right.taskId) {
    return left.taskId.localeCompare(right.taskId, "en");
  }
  return compareRows(left, right);
}

/** How an in-memory data source is built. */
export interface MemoryChecklistOptions {
  /** The clock the stamps come from. Defaults to the real one; tests pin it. */
  now?: () => Date;
}

/**
 * An in-memory checklist data source, optionally seeded. Used by the unit
 * tests; the production repository uses the Prisma source below.
 */
export function createMemoryChecklistDataSource(
  seed: readonly ChecklistRowFields[] = [],
  options: MemoryChecklistOptions = {},
): ChecklistDataSource {
  const rows: ChecklistItemRow[] = [];
  const clock: () => Date = options.now ?? ((): Date => new Date());
  let sequence = 0;

  function insert(fields: ChecklistRowFields): ChecklistItemRow {
    sequence += 1;
    const row: ChecklistItemRow = {
      id: `checklist-${String(sequence)}`,
      taskId: fields.taskId,
      title: fields.title,
      done: fields.done,
      position: fields.position,
      createdAt: clock(),
    };
    rows.push(row);
    return { ...row };
  }

  for (const entry of seed) {
    insert(entry);
  }

  return {
    async listRowsByTask(taskId: string): Promise<ChecklistItemRow[]> {
      return rows
        .filter((row: ChecklistItemRow): boolean => row.taskId === taskId)
        .sort(compareRows)
        .map((row: ChecklistItemRow): ChecklistItemRow => ({ ...row }));
    },

    async listRowsByTasks(taskIds: readonly string[]): Promise<ChecklistItemRow[]> {
      return rows
        .filter((row: ChecklistItemRow): boolean => taskIds.includes(row.taskId))
        .sort(compareRowsAcrossTasks)
        .map((row: ChecklistItemRow): ChecklistItemRow => ({ ...row }));
    },

    async listAllRows(): Promise<ChecklistItemRow[]> {
      return [...rows]
        .sort(compareRowsAcrossTasks)
        .map((row: ChecklistItemRow): ChecklistItemRow => ({ ...row }));
    },

    async findRow(taskId: string, itemId: string): Promise<ChecklistItemRow | null> {
      const found = rows.find(
        (row: ChecklistItemRow): boolean => row.id === itemId && row.taskId === taskId,
      );
      return found === undefined ? null : { ...found };
    },

    async nextPosition(taskId: string): Promise<number> {
      let highest = 0;
      for (const row of rows) {
        if (row.taskId === taskId && row.position > highest) {
          highest = row.position;
        }
      }
      return highest + 1;
    },

    async insertRow(fields: ChecklistRowFields): Promise<ChecklistItemRow> {
      return insert(fields);
    },

    async updateRowDone(itemId: string, done: boolean): Promise<ChecklistItemRow> {
      const index = rows.findIndex((row: ChecklistItemRow): boolean => row.id === itemId);
      const current = index === -1 ? undefined : rows[index];
      if (current === undefined) {
        throw new UnknownChecklistItemError(itemId);
      }
      const next: ChecklistItemRow = { ...current, done };
      rows[index] = next;
      return { ...next };
    },

    async deleteRow(itemId: string): Promise<void> {
      const index = rows.findIndex((row: ChecklistItemRow): boolean => row.id === itemId);
      if (index === -1) {
        throw new UnknownChecklistItemError(itemId);
      }
      rows.splice(index, 1);
    },
  };
}

/** The Prisma-backed data source. Built on call, never at import time. */
export function prismaChecklistDataSource(
  client: PrismaClient = prisma,
): ChecklistDataSource {
  return {
    async listRowsByTask(taskId: string): Promise<ChecklistItemRow[]> {
      return client.checklistItem.findMany({
        where: { taskId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      });
    },

    async listRowsByTasks(taskIds: readonly string[]): Promise<ChecklistItemRow[]> {
      if (taskIds.length === 0) {
        return [];
      }
      return client.checklistItem.findMany({
        where: { taskId: { in: [...taskIds] } },
        orderBy: [{ taskId: "asc" }, { position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      });
    },

    async listAllRows(): Promise<ChecklistItemRow[]> {
      return client.checklistItem.findMany({
        orderBy: [{ taskId: "asc" }, { position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      });
    },

    async findRow(taskId: string, itemId: string): Promise<ChecklistItemRow | null> {
      return client.checklistItem.findFirst({ where: { id: itemId, taskId } });
    },

    async nextPosition(taskId: string): Promise<number> {
      const last = await client.checklistItem.findFirst({
        where: { taskId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      return last === null ? 1 : last.position + 1;
    },

    async insertRow(fields: ChecklistRowFields): Promise<ChecklistItemRow> {
      return client.checklistItem.create({
        data: {
          taskId: fields.taskId,
          title: fields.title,
          done: fields.done,
          position: fields.position,
        },
      });
    },

    async updateRowDone(itemId: string, done: boolean): Promise<ChecklistItemRow> {
      return client.checklistItem.update({ where: { id: itemId }, data: { done } });
    },

    async deleteRow(itemId: string): Promise<void> {
      await client.checklistItem.delete({ where: { id: itemId } });
    },
  };
}

/**
 * Builds the checklist repository. With no argument it reads and writes the
 * real database through Prisma; the unit tests pass an in-memory data source.
 */
export function createChecklistRepository(source?: ChecklistDataSource): ChecklistRepository {
  const data: ChecklistDataSource = source ?? prismaChecklistDataSource();

  return {
    async listByTask(taskId: string): Promise<ChecklistItem[]> {
      const rows = await data.listRowsByTask(taskId);
      return rows
        .map((row: ChecklistItemRow): ChecklistItem => toChecklistItem(row))
        .sort(compareChecklistItems);
    },

    async create(input: ChecklistItemInput): Promise<ChecklistItem> {
      const title = normaliseChecklistTitle(input.title);
      if (title === "") {
        throw new MissingChecklistTitleError();
      }
      // The position is assigned ONCE, here — a checklist is never reordered.
      const position = await data.nextPosition(input.taskId);
      const row = await data.insertRow({
        taskId: input.taskId,
        title,
        done: false,
        position,
      });
      return toChecklistItem(row);
    },

    async setDone(taskId: string, itemId: string, done: boolean): Promise<ChecklistItem | null> {
      const existing = await data.findRow(taskId, itemId);
      if (existing === null) {
        return null;
      }
      // Only the item changes: the task's own status is never written here.
      const row = await data.updateRowDone(itemId, done);
      return toChecklistItem(row);
    },

    async remove(taskId: string, itemId: string): Promise<boolean> {
      const existing = await data.findRow(taskId, itemId);
      if (existing === null) {
        return false;
      }
      await data.deleteRow(itemId);
      return true;
    },

    async progress(taskIds?: readonly string[]): Promise<ChecklistProgress[]> {
      if (taskIds === undefined) {
        const everyRow = await data.listAllRows();
        const everyItem = everyRow.map((row: ChecklistItemRow): ChecklistItem =>
          toChecklistItem(row),
        );
        const seen: string[] = [];
        for (const item of everyItem) {
          if (!seen.includes(item.taskId)) {
            seen.push(item.taskId);
          }
        }
        return seen.map(
          (taskId: string): ChecklistProgress => countChecklistProgress(taskId, everyItem),
        );
      }

      const wanted = uniqueTaskIds(taskIds);
      if (wanted.length === 0) {
        return [];
      }
      const rows = await data.listRowsByTasks(wanted);
      const items = rows.map((row: ChecklistItemRow): ChecklistItem => toChecklistItem(row));
      return wanted.map(
        (taskId: string): ChecklistProgress => countChecklistProgress(taskId, items),
      );
    },
  };
}

/**
 * THE PRISMA-BACKED CHECKLIST REPOSITORY, as the composition root wires it in.
 *
 * The same repository as {@link createChecklistRepository}, bound to the real
 * database through {@link prismaChecklistDataSource}. Nothing connects until a
 * read or a write is made.
 */
export function createPrismaChecklistRepository(
  client: PrismaClient = prisma,
): ChecklistRepository {
  return createChecklistRepository(prismaChecklistDataSource(client));
}
