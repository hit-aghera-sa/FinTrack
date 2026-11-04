/**
 * Public surface of the tasks API lane.
 *
 * The composition root mounts it with a STATIC import:
 *
 *   import { createTasksRouter } from './api/index.js';
 *   import { getTaskStore } from './store/index.js';
 *   app.use(createTasksRouter(getTaskStore()));
 *
 * Importing this module has NO side effects: no server is started, no store is
 * created, nothing is read from the environment.
 */
export { createTasksRouter, TASKS_ROUTE_PATHS } from './tasksRouter.js';
export { ALLOWED_HEADERS, ALLOWED_METHODS, DEFAULT_ALLOWED_ORIGINS, MAX_AGE_SECONDS, VITE_DEV_ORIGINS, corsHeaders, createCorsMiddleware, originsFromEnv, resolveAllowedOrigin, } from './cors.js';
export { extractTaskList, failure, failureFromError, isJsonSyntaxError, taskListBody, } from './payload.js';
