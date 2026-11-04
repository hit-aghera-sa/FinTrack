import type { ApiErrorBody } from '../models/common/index.js';
import { MESSAGES } from '../messages/index.js';

/**
 * THE ERROR SHAPE THE WHOLE WEB CLIENT WORKS WITH.
 *
 * Every `/api` call in this app fails in exactly one way: an `ApiError` carrying the HTTP status, the
 * machine code and the sentence from the shared message catalogue. A screen therefore never has to
 * know whether the failure came from the server's error body, from a gateway, or from a dropped
 * connection — it shows `error.message` and, where it cares, checks the code or `isOfflineError`.
 */

/** The code used for "the backend could not be reached", whatever the cause. */
export const OFFLINE_CODE = 'offline';

/** The status an error gets when no HTTP response ever arrived. */
export const OFFLINE_STATUS = 0;

/** The code used when a response arrived but was not the JSON this client expected. */
export const UNEXPECTED_CODE = 'unexpected_response';

/** What a traveller is told when the server answered with something unusable. */
export const UNEXPECTED_MESSAGE = 'Something went wrong. Please try again.';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** True for the one error type `apiFetch` rejects with. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** The error for "no HTTP response at all", with the catalogue's no-internet sentence. */
export function offlineError(): ApiError {
  return new ApiError(OFFLINE_STATUS, OFFLINE_CODE, MESSAGES.offline);
}

/** A request the caller itself abandoned (a superseded search, an unmounted screen). */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Browsers reject `fetch` with a TypeError when the request never reached a server, and the wording
 * differs per engine ("Failed to fetch", "NetworkError when attempting to fetch resource",
 * "Load failed"). Both tests are kept: the type for a real `fetch` rejection, the wording for an
 * error that has been re-wrapped on the way up.
 */
const NETWORK_MESSAGE =
  /failed to fetch|network\s?error|network request failed|load failed|connection refused|econnrefused|enotfound|internet disconnected/i;

/** True when the failure means "this browser could not reach the backend". */
export function isOfflineError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === OFFLINE_STATUS || error.code === OFFLINE_CODE;
  if (isAbortError(error)) return false;
  if (error instanceof TypeError) return true;
  if (error instanceof Error) return NETWORK_MESSAGE.test(error.message);
  return false;
}

/** A gateway or load balancer answering for a backend it could not reach. */
const UNREACHABLE_STATUSES: readonly number[] = [502, 503, 504];

/**
 * The shared error body, narrowed from whatever JSON arrived. The body SHAPE is the data layer's
 * `ApiErrorBody`; the narrowing happens here because the browser must survive a response that is not
 * that shape at all (an HTML error page from a proxy, an empty body from a gateway).
 */
export function readErrorBody(value: unknown): ApiErrorBody | null {
  if (typeof value !== 'object' || value === null) return null;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  if (typeof code !== 'string' || typeof message !== 'string') return null;
  if (code === '' || message === '') return null;
  return { error: { code, message } };
}

/** JSON when the text parses, otherwise null — a proxy's HTML page must never throw here. */
export function parseJsonOrNull(raw: string): unknown {
  if (raw.trim() === '') return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** The `ApiError` for a non-2xx response, preferring the server's own code and sentence. */
export function errorFromBody(status: number, raw: string): ApiError {
  const body = readErrorBody(parseJsonOrNull(raw));
  if (body !== null) return new ApiError(status, body.error.code, body.error.message);
  if (UNREACHABLE_STATUSES.includes(status)) return new ApiError(status, OFFLINE_CODE, MESSAGES.offline);
  return new ApiError(status, `http_${status}`, UNEXPECTED_MESSAGE);
}
