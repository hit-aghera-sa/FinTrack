import { prisma } from "./client.js";
import { parseDueDate, toTask } from "./mappers.js";
import { toLabels } from "./labelMappers.js";
import { labelConnectWrite, labelReplaceWrite } from "./labelWrites.js";
import { DEFAULT_TASK_PRIORITY, DEFAULT_TASK_STATUS, } from "../models/task.js";
function normaliseAssigneeId(value) {
    return value === null || value === undefined || value.trim() === ""
        ? null
        : value.trim();
}
/**
 * Prisma-backed task repository. All task reads and writes go through this.
 *
 * Every read includes the task's labels in name order, and every write accepts
 * `labelIds`: a create CONNECTS those labels, and an update REPLACES the task's
 * whole label set with them (an empty list clears it, an absent list leaves the
 * labels alone). The task is always returned with its labels.
 */
export function createTaskRepository(client = prisma) {
    return {
        async list() {
            const rows = await client.task.findMany({
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                include: { labels: { orderBy: { name: "asc" } } },
            });
            return rows.map((row) => ({ ...toTask(row), labels: toLabels(row.labels) }));
        },
        async findById(id) {
            const row = await client.task.findUnique({
                where: { id },
                include: { labels: { orderBy: { name: "asc" } } },
            });
            return row === null ? null : { ...toTask(row), labels: toLabels(row.labels) };
        },
        async create(input) {
            const row = await client.task.create({
                data: {
                    title: input.title.trim(),
                    description: input.description?.trim() ?? "",
                    assigneeId: normaliseAssigneeId(input.assigneeId),
                    dueDate: parseDueDate(input.dueDate),
                    status: input.status ?? DEFAULT_TASK_STATUS,
                    priority: input.priority ?? DEFAULT_TASK_PRIORITY,
                    labels: labelConnectWrite(input.labelIds),
                },
                include: { labels: { orderBy: { name: "asc" } } },
            });
            return { ...toTask(row), labels: toLabels(row.labels) };
        },
        async update(id, patch) {
            const data = {};
            if (patch.title !== undefined) {
                data.title = patch.title.trim();
            }
            if (patch.description !== undefined) {
                data.description = patch.description.trim();
            }
            if (patch.assigneeId !== undefined) {
                data.assigneeId = normaliseAssigneeId(patch.assigneeId);
            }
            if (patch.dueDate !== undefined) {
                data.dueDate = parseDueDate(patch.dueDate);
            }
            if (patch.status !== undefined) {
                data.status = patch.status;
            }
            if (patch.priority !== undefined) {
                data.priority = patch.priority;
            }
            const row = await client.task.update({
                where: { id },
                // `set` replaces the whole label set, so a label left out of the patch
                // is disconnected and one that is new is connected, in a single write.
                data: patch.labelIds === undefined
                    ? data
                    : { ...data, labels: labelReplaceWrite(patch.labelIds) },
                include: { labels: { orderBy: { name: "asc" } } },
            });
            return { ...toTask(row), labels: toLabels(row.labels) };
        },
    };
}
