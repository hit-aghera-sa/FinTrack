/**
 * The task activity HTTP API.
 *
 * Mounted under `/api` by the server composition root, so the endpoint is:
 *   GET /api/tasks/:taskId/activity        → 200 TaskActivity[] (newest first)
 *                                            400 when ?limit is not a whole
 *                                                number of at least 1
 *                                            404 when the task does not exist
 *
 * Values come off the `express` DEFAULT import (safe under NodeNext for a
 * CommonJS package); types come through `import type`.
 */

import express from "express";
import type { Request, Response, Router } from "express";

import type { TaskRepository } from "../../db/taskRepository.js";
import { TASK_ACTIVITY_SUBPATH } from "../../shared/api-paths.js";
import type { TaskActivityReader } from "./service.js";
import { MAX_ACTIVITY_LIMIT, type TaskActivity } from "./types.js";

/** The one spelling of the feed path, relative to the `/api` mount. */
export const TASK_ACTIVITY_ROUTE_PATH = TASK_ACTIVITY_SUBPATH;

/**
 * The refusal a feed asked for an unknown task gets. Spelled the same way the
 * task router spells it, so every screen and every caller reads one wording
 * that says plainly that the task does not exist.
 */
export const TASK_NOT_FOUND_MESSAGE = "That task does not exist.";

/** What the activity router needs. */
export interface ActivityRouterDeps {
  /** The read surface of the recording service. */
  activity: TaskActivityReader;
  /** The task store, so an unknown task is a 404 rather than an empty feed. */
  tasks: TaskRepository;
}

/** The JSON body of every problem response this router sends. */
interface ProblemBody {
  error: string;
  message: string;
}

/** A `?limit` that was read successfully, or a refusal. */
type LimitResult = { ok: true; limit: number | undefined } | { ok: false };

const WHOLE_NUMBER = /^\d+$/;

function sendProblem(res: Response, status: number, error: string, message: string): void {
  const body: ProblemBody = { error, message };
  res.status(status).json(body);
}

/** Narrows a route parameter to a usable, non-empty id. */
function readTaskId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The `?limit` of the request. Absent or empty means "the whole feed"; a value
 * larger than the maximum is clamped rather than refused.
 */
function readLimit(raw: unknown): LimitResult {
  if (raw === undefined || raw === null) {
    return { ok: true, limit: undefined };
  }
  if (typeof raw !== "string") {
    return { ok: false };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, limit: undefined };
  }
  if (!WHOLE_NUMBER.test(trimmed)) {
    return { ok: false };
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return { ok: false };
  }
  return { ok: true, limit: Math.min(parsed, MAX_ACTIVITY_LIMIT) };
}

async function handleFeed(
  deps: ActivityRouterDeps,
  req: Request,
  res: Response,
): Promise<void> {
  const taskId = readTaskId(req.params.taskId);
  if (taskId === null) {
    sendProblem(res, 400, "invalid_task_id", "A task id is required.");
    return;
  }

  const limit = readLimit(req.query.limit);
  if (!limit.ok) {
    sendProblem(
      res,
      400,
      "invalid_limit",
      `The limit must be a whole number of at least 1 (at most ${String(MAX_ACTIVITY_LIMIT)}).`,
    );
    return;
  }

  try {
    const task = await deps.tasks.findById(taskId);
    if (task === null) {
      sendProblem(res, 404, "task_not_found", TASK_NOT_FOUND_MESSAGE);
      return;
    }
    const entries: TaskActivity[] = await deps.activity.listActivity(taskId, limit.limit);
    res.status(200).json(entries);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    sendProblem(res, 500, "internal_error", message);
  }
}

/**
 * Builds the activity router around the given service and task store. The
 * composition root mounts it with `app.use("/api", createActivityRouter(deps))`.
 */
export function createActivityRouter(deps: ActivityRouterDeps): Router {
  const router: Router = express.Router();

  router.get(TASK_ACTIVITY_ROUTE_PATH, (req: Request, res: Response): void => {
    void handleFeed(deps, req, res);
  });

  return router;
}
