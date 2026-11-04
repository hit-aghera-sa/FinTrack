import {
  ApiError,
  UNEXPECTED_CODE,
  UNEXPECTED_MESSAGE,
  errorFromBody,
  isAbortError,
  offlineError,
} from './errors.js';

/**
 * THE ONE WAY THIS WEB CLIENT TALKS TO THE BACKEND.
 *
 * JSON over the same origin, under the `/api` prefix, with the session cookie always attached, and
 * exactly one failure type (`ApiError`). No screen builds a `fetch` of its own, so "authenticated
 * call", "shared error body" and "no internet" are handled in a single place.
 */

export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface ApiRequestInit {
  method?: ApiMethod;
  /** Serialised as JSON. Ignored for GET, which carries no body. */
  body?: unknown;
  signal?: AbortSignal;
}

/** Every endpoint of this app lives under this prefix, served by the same host as the client. */
export const API_BASE_PATH = '/api';

/** `'/auth/me'` and `'/api/auth/me'` both address the same endpoint. */
export function apiPath(path: string): string {
  const rooted = path.startsWith('/') ? path : `/${path}`;
  if (rooted === API_BASE_PATH || rooted.startsWith(`${API_BASE_PATH}/`)) return rooted;
  return `${API_BASE_PATH}${rooted}`;
}

/**
 * Call the app's own API and return the parsed JSON.
 *
 * - the session credential travels as the server's http-only cookie (`credentials: 'same-origin'`),
 *   never as a token this code could read or copy into device storage;
 * - a non-2xx response becomes an `ApiError` built from the shared `{ error: { code, message } }`
 *   body, so the sentence a traveller reads is the catalogue's own wording;
 * - a request that never reached the backend becomes an `ApiError` carrying the no-internet message
 *   (`isOfflineError` is true for it);
 * - a request the caller aborted rejects with the abort error itself, so a superseded call is not
 *   mistaken for a connection problem;
 * - `204 No Content` (and an empty body) resolve to `undefined`.
 */
export async function apiFetch<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const method: ApiMethod = init?.method ?? 'GET';
  const sendsBody = method !== 'GET' && init?.body !== undefined;

  const headers: Record<string, string> = { accept: 'application/json' };
  if (sendsBody) headers['content-type'] = 'application/json';

  const request: RequestInit = {
    method,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  };
  if (sendsBody) request.body = JSON.stringify(init?.body);
  if (init?.signal !== undefined) request.signal = init.signal;

  let response: Response;
  try {
    response = await fetch(apiPath(path), request);
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    throw offlineError();
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch (error: unknown) {
    // The headers arrived but the body did not — a connection dropped mid-response.
    if (isAbortError(error)) throw error;
    throw offlineError();
  }

  if (!response.ok) throw errorFromBody(response.status, raw);

  if (response.status === 204 || raw.trim() === '') {
    // A no-content success: callers declare `apiFetch<void>` for these.
    return undefined as unknown as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError(response.status, UNEXPECTED_CODE, UNEXPECTED_MESSAGE);
  }
}
