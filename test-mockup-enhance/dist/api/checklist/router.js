/**
 * THE CHECKLIST HTTP API.
 *
 * Mounted under `/api` by the server composition root, so the endpoints are:
 *   GET    /api/tasks/:taskId/checklist           → 200 ChecklistItem[] (by position)
 *                                                   404 when the task does not exist
 *   POST   /api/tasks/:taskId/checklist           → 201 ChecklistItem
 *                                                   400 when the title is blank
 *                                                   404 when the task does not exist
 *   PATCH  /api/tasks/:taskId/checklist/:itemId   → 200 ChecklistItem (done toggled)
 *                                                   404 when the item does not exist
 *   DELETE /api/tasks/:taskId/checklist/:itemId   → 204 (no body)
 *                                                   404 when the item does not exist
 *   GET    /api/checklist/summary                 → 200 ChecklistProgress[]
 *
 * Every route string comes from the SHARED checklist route table
 * (`CHECKLIST_API_PATHS`, src/models/checklist/index.ts); the `/api` scope is
 * stripped here because the composition root supplies it at the mount point,
 * so the path is still written down in exactly one place.
 *
 * All storage goes through the {@link ChecklistRepository} interface the data
 * lane owns — this module never touches Prisma, and never re-declares a shared
 * type.
 *
 * Behaviour the client asked for:
 *   • ticking an item NEVER changes the task's own status (CL-17);
 *   • `position` is assigned at creation time and nothing here reorders a
 *     checklist (CL-18);
 *   • an item's title cannot be edited — PATCH only moves `done` (CL-19);
 *   • DELETE removes the item immediately, with no confirmation step (CL-20).
 *
 * Values come off the `express` DEFAULT import (safe under NodeNext for a
 * CommonJS package); types come through `import type`.
 */
import express from "express";
import { MissingChecklistTitleError, } from "../../data/checklist/checklistRepository.js";
import { CHECKLIST_API_PATHS, CHECKLIST_SUMMARY_QUERY_PARAM, normaliseChecklistTitle, parseChecklistTaskIds, } from "../../models/checklist/index.js";
import { API_PREFIX } from "../../shared/api-paths.js";
/** The same path, relative to the `/api` scope the routers are mounted on. */
function mountRelative(path) {
    return path.startsWith(API_PREFIX) ? path.slice(API_PREFIX.length) : path;
}
/** One task's checklist collection, relative to the `/api` mount. */
export const CHECKLIST_ITEMS_ROUTE_PATH = mountRelative(CHECKLIST_API_PATHS.items(":taskId"));
/** One item of one task's checklist, relative to the `/api` mount. */
export const CHECKLIST_ITEM_ROUTE_PATH = mountRelative(CHECKLIST_API_PATHS.item(":taskId", ":itemId"));
/** The progress-counts endpoint, relative to the `/api` mount. */
export const CHECKLIST_SUMMARY_ROUTE_PATH = mountRelative(CHECKLIST_API_PATHS.summary);
/**
 * The refusal a request about an unknown task gets. Spelled the same way the
 * task and activity routers spell it, so every screen reads one wording.
 */
export const TASK_NOT_FOUND_MESSAGE = "That task does not exist.";
/** The refusal a request about an unknown checklist item gets. */
export const ITEM_NOT_FOUND_MESSAGE = "That checklist item does not exist.";
/** The refusal a create with no title gets. */
export const MISSING_TITLE_MESSAGE = "A checklist item title is required.";
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sendProblem(res, status, error, message) {
    const body = { error, message };
    res.status(status).json(body);
}
function sendFailure(res, error) {
    const message = error instanceof Error ? error.message : String(error);
    sendProblem(res, 500, "internal_error", message);
}
/** Narrows a route parameter to a usable, non-empty id. */
function readId(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}
/** The title a create carries, normalised; `""` when none was given. */
function readTitle(payload) {
    if (!isRecord(payload)) {
        return "";
    }
    const raw = payload.title;
    return typeof raw === "string" ? normaliseChecklistTitle(raw) : "";
}
/**
 * The `done` flag a PATCH asks for, or null when the request did not say —
 * in which case the stored flag is simply toggled.
 */
function readDoneFlag(payload) {
    if (!isRecord(payload)) {
        return null;
    }
    const raw = payload.done;
    return typeof raw === "boolean" ? raw : null;
}
/** Whether the task exists. With no task lookup wired in, assumed to. */
async function taskExists(deps, taskId) {
    const tasks = deps.tasks;
    if (tasks === undefined) {
        return true;
    }
    const found = await tasks.findById(taskId);
    return found !== null;
}
async function handleList(deps, req, res) {
    const taskId = readId(req.params.taskId);
    if (taskId === null) {
        sendProblem(res, 400, "invalid_task_id", "A task id is required.");
        return;
    }
    try {
        if (!(await taskExists(deps, taskId))) {
            sendProblem(res, 404, "task_not_found", TASK_NOT_FOUND_MESSAGE);
            return;
        }
        const items = await deps.repo.listByTask(taskId);
        res.status(200).json(items);
    }
    catch (error) {
        sendFailure(res, error);
    }
}
async function handleCreate(deps, req, res) {
    const taskId = readId(req.params.taskId);
    if (taskId === null) {
        sendProblem(res, 400, "invalid_task_id", "A task id is required.");
        return;
    }
    try {
        // An unknown task is reported first, so a stale screen never gets a
        // validation message about a checklist that no longer exists.
        if (!(await taskExists(deps, taskId))) {
            sendProblem(res, 404, "task_not_found", TASK_NOT_FOUND_MESSAGE);
            return;
        }
        const title = readTitle(req.body);
        if (title === "") {
            sendProblem(res, 400, "invalid_title", MISSING_TITLE_MESSAGE);
            return;
        }
        const input = { taskId, title };
        const created = await deps.repo.create(input);
        res.status(201).json(created);
    }
    catch (error) {
        if (error instanceof MissingChecklistTitleError) {
            sendProblem(res, 400, "invalid_title", error.message);
            return;
        }
        sendFailure(res, error);
    }
}
async function handleSetDone(deps, req, res) {
    const taskId = readId(req.params.taskId);
    const itemId = readId(req.params.itemId);
    if (taskId === null) {
        sendProblem(res, 400, "invalid_task_id", "A task id is required.");
        return;
    }
    if (itemId === null) {
        sendProblem(res, 400, "invalid_item_id", "A checklist item id is required.");
        return;
    }
    try {
        if (!(await taskExists(deps, taskId))) {
            sendProblem(res, 404, "task_not_found", TASK_NOT_FOUND_MESSAGE);
            return;
        }
        const asked = readDoneFlag(req.body);
        let next;
        if (asked === null) {
            const items = await deps.repo.listByTask(taskId);
            const current = items.find((item) => item.id === itemId);
            if (current === undefined) {
                sendProblem(res, 404, "checklist_item_not_found", ITEM_NOT_FOUND_MESSAGE);
                return;
            }
            next = !current.done;
        }
        else {
            next = asked;
        }
        // Only the item moves: the task's own status is never written here.
        const updated = await deps.repo.setDone(taskId, itemId, next);
        if (updated === null) {
            sendProblem(res, 404, "checklist_item_not_found", ITEM_NOT_FOUND_MESSAGE);
            return;
        }
        res.status(200).json(updated);
    }
    catch (error) {
        sendFailure(res, error);
    }
}
async function handleRemove(deps, req, res) {
    const taskId = readId(req.params.taskId);
    const itemId = readId(req.params.itemId);
    if (taskId === null) {
        sendProblem(res, 400, "invalid_task_id", "A task id is required.");
        return;
    }
    if (itemId === null) {
        sendProblem(res, 400, "invalid_item_id", "A checklist item id is required.");
        return;
    }
    try {
        // Removed immediately — there is no confirmation step in the API.
        const removed = await deps.repo.remove(taskId, itemId);
        if (!removed) {
            sendProblem(res, 404, "checklist_item_not_found", ITEM_NOT_FOUND_MESSAGE);
            return;
        }
        res.status(204).end();
    }
    catch (error) {
        sendFailure(res, error);
    }
}
async function handleSummary(deps, req, res) {
    try {
        const raw = req.query[CHECKLIST_SUMMARY_QUERY_PARAM];
        const taskIds = parseChecklistTaskIds(raw);
        const progress = taskIds.length === 0 ? await deps.repo.progress() : await deps.repo.progress(taskIds);
        res.status(200).json(progress);
    }
    catch (error) {
        sendFailure(res, error);
    }
}
/**
 * Builds the checklist router around a checklist store.
 *
 * The composition root mounts it with
 * `app.use("/api", createChecklistRouter(repo, { tasks }))`; the unit tests
 * pass a fake repository.
 */
export function createChecklistRouter(repo, options = {}) {
    const deps = { repo, tasks: options.tasks };
    const router = express.Router();
    // Parses our own JSON bodies so the router works however it is mounted;
    // body-parser skips a request whose body another layer already read.
    router.use(express.json({ limit: "64kb" }));
    router.get(CHECKLIST_SUMMARY_ROUTE_PATH, (req, res) => {
        void handleSummary(deps, req, res);
    });
    router.get(CHECKLIST_ITEMS_ROUTE_PATH, (req, res) => {
        void handleList(deps, req, res);
    });
    router.post(CHECKLIST_ITEMS_ROUTE_PATH, (req, res) => {
        void handleCreate(deps, req, res);
    });
    router.patch(CHECKLIST_ITEM_ROUTE_PATH, (req, res) => {
        void handleSetDone(deps, req, res);
    });
    router.delete(CHECKLIST_ITEM_ROUTE_PATH, (req, res) => {
        void handleRemove(deps, req, res);
    });
    return router;
}
