/**
 * The ONE error body every API route in this app answers with, and every client parses.
 *
 * Shape is fixed: `{ error: { code, message } }` — `code` is a stable machine token
 * (`invalid_credentials`, `seat_taken`, …) and `message` is the human sentence shown in the UI.
 */
export interface ApiErrorBody {
  error: { code: string; message: string };
}

/** Build an {@link ApiErrorBody}. Routes use this instead of writing the literal by hand. */
export function apiErrorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

/** True when `value` is a well-formed {@link ApiErrorBody} — used by the web client on a failed fetch. */
export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  if (!('error' in value)) return false;
  const error: unknown = value.error;
  if (typeof error !== 'object' || error === null) return false;
  if (!('code' in error) || !('message' in error)) return false;
  return typeof error.code === 'string' && typeof error.message === 'string';
}
