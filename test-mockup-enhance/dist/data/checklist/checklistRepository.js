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
import { prisma } from "../../db/client.js";
import { compareChecklistItems, countChecklistProgress, normaliseChecklistTitle, uniqueTaskIds, } from "../../models/checklist/index.js";
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
    itemId;
    constructor(itemId) {
        super("That checklist item does not exist.");
        this.name = "UnknownChecklistItemError";
        this.itemId = itemId;
    }
}
/** A stored row as the shared domain model. */
export function toChecklistItem(row) {
    return {
        id: row.id,
        taskId: row.taskId,
        title: row.title,
        done: row.done,
        position: row.position,
        createdAt: row.createdAt.toISOString(),
    };
}
/** The order one task's rows are always read in. */
function compareRows(left, right) {
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
function compareRowsAcrossTasks(left, right) {
    if (left.taskId !== right.taskId) {
        return left.taskId.localeCompare(right.taskId, "en");
    }
    return compareRows(left, right);
}
/**
 * An in-memory checklist data source, optionally seeded. Used by the unit
 * tests; the production repository uses the Prisma source below.
 */
export function createMemoryChecklistDataSource(seed = [], options = {}) {
    const rows = [];
    const clock = options.now ?? (() => new Date());
    let sequence = 0;
    function insert(fields) {
        sequence += 1;
        const row = {
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
        async listRowsByTask(taskId) {
            return rows
                .filter((row) => row.taskId === taskId)
                .sort(compareRows)
                .map((row) => ({ ...row }));
        },
        async listRowsByTasks(taskIds) {
            return rows
                .filter((row) => taskIds.includes(row.taskId))
                .sort(compareRowsAcrossTasks)
                .map((row) => ({ ...row }));
        },
        async listAllRows() {
            return [...rows]
                .sort(compareRowsAcrossTasks)
                .map((row) => ({ ...row }));
        },
        async findRow(taskId, itemId) {
            const found = rows.find((row) => row.id === itemId && row.taskId === taskId);
            return found === undefined ? null : { ...found };
        },
        async nextPosition(taskId) {
            let highest = 0;
            for (const row of rows) {
                if (row.taskId === taskId && row.position > highest) {
                    highest = row.position;
                }
            }
            return highest + 1;
        },
        async insertRow(fields) {
            return insert(fields);
        },
        async updateRowDone(itemId, done) {
            const index = rows.findIndex((row) => row.id === itemId);
            const current = index === -1 ? undefined : rows[index];
            if (current === undefined) {
                throw new UnknownChecklistItemError(itemId);
            }
            const next = { ...current, done };
            rows[index] = next;
            return { ...next };
        },
        async deleteRow(itemId) {
            const index = rows.findIndex((row) => row.id === itemId);
            if (index === -1) {
                throw new UnknownChecklistItemError(itemId);
            }
            rows.splice(index, 1);
        },
    };
}
/** The Prisma-backed data source. Built on call, never at import time. */
export function prismaChecklistDataSource(client = prisma) {
    return {
        async listRowsByTask(taskId) {
            return client.checklistItem.findMany({
                where: { taskId },
                orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            });
        },
        async listRowsByTasks(taskIds) {
            if (taskIds.length === 0) {
                return [];
            }
            return client.checklistItem.findMany({
                where: { taskId: { in: [...taskIds] } },
                orderBy: [{ taskId: "asc" }, { position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            });
        },
        async listAllRows() {
            return client.checklistItem.findMany({
                orderBy: [{ taskId: "asc" }, { position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            });
        },
        async findRow(taskId, itemId) {
            return client.checklistItem.findFirst({ where: { id: itemId, taskId } });
        },
        async nextPosition(taskId) {
            const last = await client.checklistItem.findFirst({
                where: { taskId },
                orderBy: { position: "desc" },
                select: { position: true },
            });
            return last === null ? 1 : last.position + 1;
        },
        async insertRow(fields) {
            return client.checklistItem.create({
                data: {
                    taskId: fields.taskId,
                    title: fields.title,
                    done: fields.done,
                    position: fields.position,
                },
            });
        },
        async updateRowDone(itemId, done) {
            return client.checklistItem.update({ where: { id: itemId }, data: { done } });
        },
        async deleteRow(itemId) {
            await client.checklistItem.delete({ where: { id: itemId } });
        },
    };
}
/**
 * Builds the checklist repository. With no argument it reads and writes the
 * real database through Prisma; the unit tests pass an in-memory data source.
 */
export function createChecklistRepository(source) {
    const data = source ?? prismaChecklistDataSource();
    return {
        async listByTask(taskId) {
            const rows = await data.listRowsByTask(taskId);
            return rows
                .map((row) => toChecklistItem(row))
                .sort(compareChecklistItems);
        },
        async create(input) {
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
        async setDone(taskId, itemId, done) {
            const existing = await data.findRow(taskId, itemId);
            if (existing === null) {
                return null;
            }
            // Only the item changes: the task's own status is never written here.
            const row = await data.updateRowDone(itemId, done);
            return toChecklistItem(row);
        },
        async remove(taskId, itemId) {
            const existing = await data.findRow(taskId, itemId);
            if (existing === null) {
                return false;
            }
            await data.deleteRow(itemId);
            return true;
        },
        async progress(taskIds) {
            if (taskIds === undefined) {
                const everyRow = await data.listAllRows();
                const everyItem = everyRow.map((row) => toChecklistItem(row));
                const seen = [];
                for (const item of everyItem) {
                    if (!seen.includes(item.taskId)) {
                        seen.push(item.taskId);
                    }
                }
                return seen.map((taskId) => countChecklistProgress(taskId, everyItem));
            }
            const wanted = uniqueTaskIds(taskIds);
            if (wanted.length === 0) {
                return [];
            }
            const rows = await data.listRowsByTasks(wanted);
            const items = rows.map((row) => toChecklistItem(row));
            return wanted.map((taskId) => countChecklistProgress(taskId, items));
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
export function createPrismaChecklistRepository(client = prisma) {
    return createChecklistRepository(prismaChecklistDataSource(client));
}
