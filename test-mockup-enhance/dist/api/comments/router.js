/**
 * The comment-thread HTTP API.
 *
 * Mounted under `/api` by the server composition root, so the endpoints are:
 *   GET  /api/tasks/:taskId/comments  → 200 [TaskComment, …] in creation order
 *   POST /api/tasks/:taskId/comments  → 201 TaskComment
 *                                       400 when the body is empty/invalid
 *                                       404 when the task does not exist
 *
 * Values come off the `express` DEFAULT import (safe under NodeNext for a
 * CommonJS package); types come through `import type`.
 */
import express from "express";
import { createCommentForTask, listCommentsForTask } from "./service.js";
/** The one spelling of the comment-thread path, relative to the `/api` mount. */
export const COMMENT_THREAD_PATH = "/tasks/:taskId/comments";
/** Narrows a route parameter to a usable, non-empty id. */
function readTaskId(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}
function sendInvalidTaskId(res) {
    res.status(400).json({
        error: "invalid_task_id",
        message: "A task id is required.",
    });
}
function sendFailure(res, error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "internal_error", message });
}
async function handleList(deps, req, res) {
    const taskId = readTaskId(req.params.taskId);
    if (taskId === null) {
        sendInvalidTaskId(res);
        return;
    }
    try {
        const result = await listCommentsForTask(deps, taskId);
        if (!result.ok) {
            res.status(result.problem.status).json(result.problem.body);
            return;
        }
        res.status(200).json(result.value);
    }
    catch (error) {
        sendFailure(res, error);
    }
}
async function handleCreate(deps, req, res) {
    const taskId = readTaskId(req.params.taskId);
    if (taskId === null) {
        sendInvalidTaskId(res);
        return;
    }
    try {
        const payload = req.body;
        const result = await createCommentForTask(deps, taskId, payload);
        if (!result.ok) {
            res.status(result.problem.status).json(result.problem.body);
            return;
        }
        res.status(201).json(result.value);
    }
    catch (error) {
        sendFailure(res, error);
    }
}
/**
 * Builds the comment router around the given repositories. The composition
 * root mounts it with `app.use("/api", createCommentRouter(deps))`.
 */
export function createCommentRouter(deps) {
    const router = express.Router();
    // Parses the JSON body for these routes whether or not the composition root
    // installed a parser; body-parser skips a request it has already read.
    router.use(express.json({ limit: "64kb" }));
    router.get(COMMENT_THREAD_PATH, (req, res) => {
        void handleList(deps, req, res);
    });
    router.post(COMMENT_THREAD_PATH, (req, res) => {
        void handleCreate(deps, req, res);
    });
    return router;
}
