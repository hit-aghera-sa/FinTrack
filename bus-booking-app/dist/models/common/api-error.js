/** Build an {@link ApiErrorBody}. Routes use this instead of writing the literal by hand. */
export function apiErrorBody(code, message) {
    return { error: { code, message } };
}
/** True when `value` is a well-formed {@link ApiErrorBody} — used by the web client on a failed fetch. */
export function isApiErrorBody(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    if (!('error' in value))
        return false;
    const error = value.error;
    if (typeof error !== 'object' || error === null)
        return false;
    if (!('code' in error) || !('message' in error))
        return false;
    return typeof error.code === 'string' && typeof error.message === 'string';
}
