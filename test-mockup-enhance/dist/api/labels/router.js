/**
 * The label HTTP API.
 *
 * Mounted under `/api` by the server composition root, so the endpoints are:
 *   GET /api/labels                  → 200 [Label, …] ordered by name
 *   POST /api/labels                 → 201 Label
 *                                      400 when the name is blank or the colour
 *                                          is not one of LABEL_COLORS
 *                                      409 when that name already exists
 *   PUT /api/tasks/:taskId/labels    → 200 [Label, …] — the task's new set
 *                                      400 when the payload is not
 *                                          { labelIds: string[] }, or an id
 *                                          matches no label
 *                                      404 when the task does not exist
 *
 * Values come off the `express` DEFAULT import (safe under NodeNext for a
 * CommonJS package); types come through `import type`.
 */
import express from "express";
import { LABEL_COLORS, isLabelColor, normaliseLabelName, } from "../../models/label.js";
import { LABELS_SUBPATH, TASK_LABELS_SUBPATH } from "../../shared/api-paths.js";
import { DuplicateLabelNameError, UnknownLabelError, } from "./repository.js";
/** The label collection, relative to the `/api` mount. */
export const LABELS_ROUTE_PATH = LABELS_SUBPATH;
/** One task's label set, relative to the `/api` mount. */
export const TASK_LABELS_ROUTE_PATH = TASK_LABELS_SUBPATH;
/** Longest label name the API accepts, measured after normalising. */
export const MAX_LABEL_NAME_LENGTH = 40;
const COLOR_LIST = LABEL_COLORS.join(", ");
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** The items of an unknown value when it is an array, else null. */
function asItems(value) {
    return Array.isArray(value) ? value : null;
}
function sendProblem(res, status, error, message) {
    const body = { error, message };
    res.status(status).json(body);
}
function sendFailure(res, error) {
    const message = error instanceof Error ? error.message : String(error);
    sendProblem(res, 500, "internal_error", message);
}
/** A usable, non-empty route parameter. */
function readTaskId(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}
/** The ids of a `{ labelIds: string[] }` payload, or null when malformed. */
function readLabelIds(payload) {
    if (!isRecord(payload)) {
        return null;
    }
    const items = asItems(payload.labelIds);
    if (items === null) {
        return null;
    }
    const ids = [];
    for (const item of items) {
        if (typeof item !== "string") {
            return null;
        }
        const trimmed = item.trim();
        if (trimmed === "") {
            return null;
        }
        ids.push(trimmed);
    }
    return ids;
}
async function handleList(deps, res) {
    try {
        const labels = await deps.labels.list();
        res.status(200).json(labels);
    }
    catch (error) {
        sendFailure(res, error);
    }
}
async function handleCreate(deps, req, res) {
    const payload = req.body;
    if (!isRecord(payload)) {
        sendProblem(res, 400, "invalid_label", "A label needs a name and a colour.");
        return;
    }
    const rawName = payload.name;
    if (typeof rawName !== "string") {
        sendProblem(res, 400, "invalid_name", "A label name is required.");
        return;
    }
    const name = normaliseLabelName(rawName);
    if (name === "") {
        sendProblem(res, 400, "invalid_name", "A label name is required.");
        return;
    }
    if (name.length > MAX_LABEL_NAME_LENGTH) {
        sendProblem(res, 400, "invalid_name", `A label name can be at most ${String(MAX_LABEL_NAME_LENGTH)} characters long.`);
        return;
    }
    const color = payload.color;
    if (!isLabelColor(color)) {
        sendProblem(res, 400, "invalid_color", `The colour must be one of: ${COLOR_LIST}.`);
        return;
    }
    const input = { name, color };
    try {
        const created = await deps.labels.create(input);
        res.status(201).json(created);
    }
    catch (error) {
        if (error instanceof DuplicateLabelNameError) {
            sendProblem(res, 409, "duplicate_label_name", error.message);
            return;
        }
        sendFailure(res, error);
    }
}
async function handleReplaceTaskLabels(deps, req, res) {
    const taskId = readTaskId(req.params.taskId);
    if (taskId === null) {
        sendProblem(res, 400, "invalid_task_id", "A task id is required.");
        return;
    }
    const labelIds = readLabelIds(req.body);
    if (labelIds === null) {
        sendProblem(res, 400, "invalid_label_ids", "Send labelIds as an array of label ids.");
        return;
    }
    try {
        const task = await deps.tasks.findById(taskId);
        if (task === null) {
            sendProblem(res, 404, "task_not_found", "That task could not be found.");
            return;
        }
        const labels = await deps.labels.replaceTaskLabels(taskId, labelIds);
        res.status(200).json(labels);
    }
    catch (error) {
        if (error instanceof UnknownLabelError) {
            sendProblem(res, 400, "unknown_label", error.message);
            return;
        }
        sendFailure(res, error);
    }
}
/**
 * Builds the label router around the given store. The composition root mounts
 * it with `app.use("/api", createLabelRouter(deps))`.
 */
export function createLabelRouter(deps) {
    const router = express.Router();
    // Parses our own JSON bodies so the router works however it is mounted;
    // body-parser skips a request whose body another layer already read.
    router.use(express.json({ limit: "64kb" }));
    router.get(LABELS_ROUTE_PATH, (_req, res) => {
        void handleList(deps, res);
    });
    router.post(LABELS_ROUTE_PATH, (req, res) => {
        void handleCreate(deps, req, res);
    });
    router.put(TASK_LABELS_ROUTE_PATH, (req, res) => {
        void handleReplaceTaskLabels(deps, req, res);
    });
    return router;
}
