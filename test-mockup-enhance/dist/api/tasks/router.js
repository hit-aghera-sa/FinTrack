import express from "express";
import { UnknownLabelError } from "../labels/repository.js";
import { DEFAULT_TASK_PRIORITY, DEFAULT_TASK_STATUS, TASK_PRIORITIES, TASK_STATUSES, isTaskPriority, isTaskStatus, } from "../../models/task.js";
const STATUS_LIST = TASK_STATUSES.join(", ");
const PRIORITY_LIST = TASK_PRIORITIES.join(", ");
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** An expected failure with the HTTP status the client should see. */
class RequestError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.name = "RequestError";
        this.status = status;
    }
}
function sendProblem(res, status, message) {
    const body = { message };
    res.status(status).json(body);
}
function fail(res, error) {
    if (error instanceof RequestError) {
        sendProblem(res, error.status, error.message);
        return;
    }
    if (error instanceof UnknownLabelError) {
        sendProblem(res, 400, error.message);
        return;
    }
    const message = error instanceof Error ? error.message : String(error);
    sendProblem(res, 500, message);
}
function readBody(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new RequestError(400, "The request body must be a JSON object.");
    }
    return value;
}
function readId(value) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new RequestError(400, "A task id is required.");
    }
    return value;
}
function readTitle(value) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new RequestError(400, "A task title is required.");
    }
    return value.trim();
}
function readDescription(value) {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value !== "string") {
        throw new RequestError(400, "The description must be text.");
    }
    return value;
}
function readStatus(value) {
    if (!isTaskStatus(value)) {
        throw new RequestError(400, `The status must be one of: ${STATUS_LIST}.`);
    }
    return value;
}
/**
 * The priority a write carries. One of the three levels and nothing else — the
 * add-task form and the task detail screen both send this field, and the
 * repository stores it, so it is read here exactly like the status beside it.
 */
function readPriority(value) {
    if (!isTaskPriority(value)) {
        throw new RequestError(400, `The priority must be one of: ${PRIORITY_LIST}.`);
    }
    return value;
}
function readDueDate(value) {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== "string") {
        throw new RequestError(400, "The due date must be a date string.");
    }
    const trimmed = value.trim();
    if (trimmed === "") {
        return null;
    }
    if (!ISO_DATE_ONLY.test(trimmed) && Number.isNaN(Date.parse(trimmed))) {
        throw new RequestError(400, "The due date must be a valid date.");
    }
    return trimmed;
}
/**
 * The label ids a create or an edit carries: `undefined` when the field is
 * absent (the task's labels are left alone), otherwise the ids to attach.
 */
function readLabelIds(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw new RequestError(400, "The labels must be an array of label ids.");
    }
    const items = value;
    const ids = [];
    for (const item of items) {
        if (typeof item !== "string" || item.trim() === "") {
            throw new RequestError(400, "The labels must be an array of label ids.");
        }
        ids.push(item.trim());
    }
    return ids;
}
async function readAssigneeId(value, members) {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== "string") {
        throw new RequestError(400, "The assignee must be a team member id.");
    }
    const trimmed = value.trim();
    if (trimmed === "") {
        return null;
    }
    const member = await members.findById(trimmed);
    if (member === null) {
        throw new RequestError(400, "The assignee is not a member of the team.");
    }
    return trimmed;
}
/**
 * Refuses a write naming a label that does not exist — BEFORE the task itself
 * is written, so a bad id can never leave a half-applied record behind.
 */
async function ensureLabelsExist(deps, labelIds) {
    const store = deps.labels;
    if (store === undefined || labelIds === undefined || labelIds.length === 0) {
        return;
    }
    const known = await store.list();
    const missing = labelIds.filter((id) => !known.some((label) => label.id === id));
    if (missing.length > 0) {
        throw new RequestError(400, missing.length === 1
            ? "One of those labels does not exist."
            : "Some of those labels do not exist.");
    }
}
/** Replaces a task's label set, when a label store is wired in. */
async function applyLabels(deps, taskId, labelIds) {
    const labels = deps.labels;
    if (labels === undefined || labelIds === undefined) {
        return;
    }
    await labels.replaceTaskLabels(taskId, labelIds);
}
/**
 * The labels attached to one task.
 *
 * A label read must never cost a reader the task itself: if the label store
 * cannot answer, the labels the repository already supplied stand in for it, so
 * the board and the task page still render rather than seeing a 500.
 */
async function labelsOf(deps, task) {
    const store = deps.labels;
    if (store === undefined) {
        return task.labels ?? [];
    }
    try {
        return await store.listForTask(task.id);
    }
    catch {
        return task.labels ?? [];
    }
}
/** The task payload, always carrying its labels (an empty array when it has none). */
async function serialise(deps, task) {
    return { ...task, labels: await labelsOf(deps, task) };
}
/**
 * The task surface the board, the add-task form and the detail page use.
 * Mounted by the composition root under `/api`, so the routes below answer at
 * `/api/tasks` and `/api/tasks/:id`.
 */
export function createTaskRouter(deps) {
    const router = express.Router();
    // Parse our own JSON bodies so the router works however it is mounted.
    router.use(express.json());
    router.get("/tasks", async (_req, res) => {
        try {
            const tasks = await deps.tasks.list();
            const payload = [];
            for (const task of tasks) {
                payload.push({ ...task, labels: await labelsOf(deps, task) });
            }
            res.status(200).json(payload);
        }
        catch (error) {
            fail(res, error);
        }
    });
    router.get("/tasks/:id", async (req, res) => {
        try {
            const id = readId(req.params.id);
            const task = await deps.tasks.findById(id);
            if (task === null) {
                sendProblem(res, 404, "That task does not exist.");
                return;
            }
            res.status(200).json(await serialise(deps, task));
        }
        catch (error) {
            fail(res, error);
        }
    });
    router.post("/tasks", async (req, res) => {
        try {
            const body = readBody(req.body);
            const labelIds = readLabelIds(body.labelIds);
            const input = {
                title: readTitle(body.title),
                description: readDescription(body.description),
                assigneeId: await readAssigneeId(body.assigneeId, deps.members),
                dueDate: readDueDate(body.dueDate),
                status: body.status === undefined || body.status === null
                    ? DEFAULT_TASK_STATUS
                    : readStatus(body.status),
                priority: body.priority === undefined || body.priority === null
                    ? DEFAULT_TASK_PRIORITY
                    : readPriority(body.priority),
            };
            await ensureLabelsExist(deps, labelIds);
            const created = await deps.tasks.create(input);
            await applyLabels(deps, created.id, labelIds);
            res.status(201).json(await serialise(deps, created));
        }
        catch (error) {
            fail(res, error);
        }
    });
    router.patch("/tasks/:id", async (req, res) => {
        try {
            const id = readId(req.params.id);
            const existing = await deps.tasks.findById(id);
            if (existing === null) {
                sendProblem(res, 404, "That task does not exist.");
                return;
            }
            const body = readBody(req.body);
            const labelIds = readLabelIds(body.labelIds);
            const patch = {};
            if (Object.prototype.hasOwnProperty.call(body, "title")) {
                patch.title = readTitle(body.title);
            }
            if (Object.prototype.hasOwnProperty.call(body, "description")) {
                patch.description = readDescription(body.description);
            }
            if (Object.prototype.hasOwnProperty.call(body, "assigneeId")) {
                patch.assigneeId = await readAssigneeId(body.assigneeId, deps.members);
            }
            if (Object.prototype.hasOwnProperty.call(body, "dueDate")) {
                patch.dueDate = readDueDate(body.dueDate);
            }
            if (Object.prototype.hasOwnProperty.call(body, "status")) {
                patch.status = readStatus(body.status);
            }
            if (Object.prototype.hasOwnProperty.call(body, "priority")) {
                patch.priority = readPriority(body.priority);
            }
            await ensureLabelsExist(deps, labelIds);
            const updated = await deps.tasks.update(id, patch);
            await applyLabels(deps, updated.id, labelIds);
            res.status(200).json(await serialise(deps, updated));
        }
        catch (error) {
            fail(res, error);
        }
    });
    return router;
}
