/** Path of the tasks collection. */
export const TASKS_PATH = '/api/tasks';
/** Path of a single task resource. */
export function taskPath(id) {
    return `${TASKS_PATH}/${encodeURIComponent(id)}`;
}
/** The route table. Never hardcode these paths elsewhere. */
export const API_ROUTES = {
    health: '/api/health',
    tasks: TASKS_PATH,
    task: taskPath,
};
/** HTTP status used for each error code. */
export const HTTP_STATUS_BY_ERROR_CODE = {
    title_required: 400,
    title_too_long: 400,
    bad_request: 400,
    not_found: 404,
    server_error: 500,
};
/** Build the canonical error payload. */
export function apiError(code, message) {
    return { error: { code, message } };
}
/** HTTP status for an error code. */
export function statusForErrorCode(code) {
    return HTTP_STATUS_BY_ERROR_CODE[code];
}
/** Runtime guard for {@link ApiErrorResponse}. */
export function isApiErrorResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const error = value.error;
    if (typeof error !== 'object' || error === null)
        return false;
    const body = error;
    return typeof body.code === 'string' && typeof body.message === 'string';
}
/** Append a filter as a query string, omitting it when it is the default. */
export function tasksQuery(filter) {
    if (!filter || filter === 'all')
        return TASKS_PATH;
    return `${TASKS_PATH}?filter=${filter}`;
}
