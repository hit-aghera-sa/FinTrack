/**
 * The tasks API router.
 *
 * Exposes EXACTLY one route pair:
 *
 *   GET  /api/tasks  -> the stored `Task[]` (an empty array is a 200 success)
 *   PUT  /api/tasks  -> accepts the COMPLETE list and echoes back the list as stored
 *
 * JSON in both directions, CORS enabled for the Vite dev origin. No health route,
 * no per-task endpoints, no auth. Storage is injected: this module never persists
 * anything itself, it delegates to the store the composition root hands it.
 *
 * Deliberately minimal: the router registers ONLY those two verbs on those two
 * paths and installs NO catch-all, so anything else under the mount point falls
 * through to the composition root (which owns `/api/health` and the JSON 404).
 *
 * SECRET SAFETY: every successful response goes through `redactTaskSecrets`, the
 * single choke point where stored text becomes rendered page content, so a
 * credential-shaped title surfaces as a secret-ref and never as a value.
 */
import express from 'express';
import { DEFAULT_ALLOWED_ORIGINS, createCorsMiddleware } from './cors.js';
import { extractTaskList, failureFromError, taskListBody } from './payload.js';
import { redactTaskSecrets } from './redactSecrets.js';
/**
 * Paths the router registers. Both spellings are mounted so the composition root
 * may `app.use(router)` or `app.use('/api', router)` — the public URL is
 * `/api/tasks` either way.
 *
 * Each path is registered individually below (never as an array literal handed to
 * `router.get`), which is the spelling every Express / path-to-regexp version
 * agrees on.
 */
export const TASKS_ROUTE_PATHS = ['/tasks', '/api/tasks'];
/** Render an {@link ApiFailure} onto the response. */
function sendFailure(res, result) {
    res.status(result.status).json(result.body);
}
/**
 * An empty list is a SUCCESS, never an error — so a store that resolves something
 * unexpected still yields a well-formed empty array rather than a 500.
 */
function asTaskArray(value) {
    return Array.isArray(value) ? value : [];
}
/** Read the stored list through the injected store. */
async function readStoredTasks(store) {
    return asTaskArray(await store.list());
}
/** Replace the whole list, then read back exactly what is stored. */
async function replaceStoredTasks(store, input) {
    if (typeof store.replaceAll !== 'function') {
        // A misconfigured composition root becomes a clean JSON 500, never a crash.
        throw new Error('Task store cannot replace the whole list.');
    }
    await store.replaceAll(input);
    return readStoredTasks(store);
}
/**
 * Build the tasks router around a store.
 *
 * @param store   persistence port supplied by the composition root
 * @param options CORS origins and JSON body limit overrides
 */
export function createTasksRouter(store, options = {}) {
    const router = express.Router();
    router.use(createCorsMiddleware(options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS));
    router.use(express.json({ limit: options.bodyLimit ?? '1mb' }));
    // GET /api/tasks — the stored list. Empty is a success, never an error.
    async function handleGet(req, res) {
        void req;
        try {
            const stored = await readStoredTasks(store);
            res.status(200).json(redactTaskSecrets(taskListBody(stored)));
        }
        catch (error) {
            sendFailure(res, failureFromError(error));
        }
    }
    // PUT /api/tasks — replace the whole list, then echo back what is stored.
    async function handlePut(req, res) {
        const extracted = extractTaskList(req.body);
        if (!extracted.ok) {
            sendFailure(res, extracted.failure);
            return;
        }
        try {
            const stored = await replaceStoredTasks(store, extracted.value);
            res.status(200).json(redactTaskSecrets(taskListBody(stored)));
        }
        catch (error) {
            sendFailure(res, failureFromError(error));
        }
    }
    for (const path of TASKS_ROUTE_PATHS) {
        router.get(path, (req, res) => {
            void handleGet(req, res);
        });
        router.put(path, (req, res) => {
            void handlePut(req, res);
        });
    }
    // Body-parser and handler errors become the canonical JSON error envelope.
    router.use((error, req, res, next) => {
        void req;
        if (res.headersSent) {
            next(error);
            return;
        }
        sendFailure(res, failureFromError(error));
    });
    return router;
}
