/**
 * The SINGLE client-side HTTP module for the tasks backend.
 *
 * Two calls only:
 *
 *   getTasks()        -> GET  /api/tasks   (the stored `Task[]`)
 *   saveTasks(list)   -> PUT  /api/tasks   (the COMPLETE list; echoes back what is stored)
 *
 * JSON in both directions, no auth header, no cookies (`credentials: 'omit'`), base
 * path `/api` (proxied by Vite in dev, same-origin in production). Every failure —
 * a non-OK status, an unreadable body, or a network error — is raised as an
 * {@link ApiError} carrying ONE user-facing message so the `useTasks` hook can render
 * the single error line.
 *
 * Consumed ONLY by the useTasks hook. Importing this module has no side effects: no
 * request is issued and `fetch` is not touched until a call is made.
 */
import { API_ROUTES, COPY, isApiErrorResponse } from '../models/index.js';
import type { ApiErrorCode, Task } from '../models/index.js';

/** Base path of the API. Everything below is built from the shared route table. */
export const API_BASE_PATH = '/api';

/** The one endpoint this client talks to. */
export const TASKS_ENDPOINT: string = API_ROUTES.tasks;

/** Headers sent with every request: JSON in, JSON out. No auth header. */
export const JSON_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

/**
 * Minimal structural shape of a fetch response.
 *
 * Declared locally (rather than using the DOM `Response`) so this module compiles
 * identically in every TypeScript project configuration used by the build.
 */
export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

/** Minimal structural shape of the fetch init object this client needs. */
export interface HttpRequestInit {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
  readonly credentials?: 'omit' | 'same-origin' | 'include';
}

/** The injectable fetch signature (the global `fetch` satisfies it). */
export type FetchLike = (url: string, init?: HttpRequestInit) => Promise<HttpResponse>;

/** Error raised for every failed API interaction. */
export class ApiError extends Error {
  /** HTTP status when the server answered, `null` for a network failure. */
  readonly status: number | null;
  /** Machine-readable code from the server envelope, when it supplied one. */
  readonly code: ApiErrorCode | null;
  /** The underlying thrown value, when the failure came from the transport. */
  readonly cause: unknown;

  constructor(
    message: string,
    status: number | null = null,
    code: ApiErrorCode | null = null,
    cause: unknown = undefined,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.cause = cause;
  }
}

/** Runtime guard for {@link ApiError}. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** Resolve the ambient `fetch`, failing loudly (as an ApiError) when there is none. */
function resolveFetch(): FetchLike {
  const candidate: unknown = (globalThis as { fetch?: unknown }).fetch;
  if (typeof candidate !== 'function') {
    throw new ApiError(COPY.errors.unexpected);
  }
  const bound: FetchLike = (candidate as FetchLike).bind(globalThis);
  return bound;
}

/** Read a JSON body, tolerating an empty or malformed one. */
async function readJson(response: HttpResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** The user-facing message for a failure body, falling back to the shared copy. */
function messageFromBody(body: unknown, fallback: string): string {
  if (isApiErrorResponse(body)) {
    const message = body.error.message.trim();
    if (message.length > 0) return message;
  }
  return fallback;
}

/** The machine-readable code for a failure body, when the server supplied one. */
function codeFromBody(body: unknown): ApiErrorCode | null {
  return isApiErrorResponse(body) ? body.error.code : null;
}

/** True when `value` looks like a wire task. Kept light: the server owns validation. */
function looksLikeTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.completed === 'boolean' &&
    typeof record.createdAt === 'string'
  );
}

/**
 * Read the task list out of a success body.
 *
 * Accepts the canonical bare array and the `{ tasks: [...] }` envelope; returns
 * `null` for anything else so the caller can raise the single error line.
 */
export function extractTasks(body: unknown): Task[] | null {
  const list: unknown = Array.isArray(body)
    ? body
    : typeof body === 'object' && body !== null
      ? (body as { tasks?: unknown }).tasks
      : undefined;
  if (!Array.isArray(list)) return null;
  if (!list.every((entry: unknown) => looksLikeTask(entry))) return null;
  return list.map((entry: unknown) => ({ ...(entry as Task) }));
}

/** The body sent by {@link saveTasks}: the COMPLETE list as a bare JSON array. */
export function serializeTaskList(tasks: readonly Task[]): string {
  return JSON.stringify(
    tasks.map((task: Task) => ({
      id: task.id,
      title: task.title,
      completed: task.completed,
      createdAt: task.createdAt,
    })),
  );
}

/** Options controlling how one request's outcome is normalised. */
interface RequestOptions {
  /** The single user-facing message used for every failure of this call. */
  readonly fallbackMessage: string;
  /**
   * List to resolve with when the server ACKNOWLEDGES the call (2xx) but does not
   * echo a task list back — a `204 No Content`, an empty body, or an `{ ok: true }`
   * acknowledgement. Only the write path supplies this: the caller already knows
   * exactly what was persisted, so treating the acknowledgement as a failure would
   * show a spurious error line for a change that actually succeeded.
   *
   * When it is `undefined` (the read path) an unparseable 2xx body is an error.
   */
  readonly acknowledged?: readonly Task[];
  /** Fetch override (tests inject a stub). */
  readonly fetchImpl?: FetchLike;
}

/** Issue one request and normalise its outcome to a task list or an {@link ApiError}. */
async function requestTaskList(init: HttpRequestInit, options: RequestOptions): Promise<Task[]> {
  const { fallbackMessage, acknowledged, fetchImpl } = options;
  const doFetch = fetchImpl ?? resolveFetch();

  let response: HttpResponse;
  try {
    response = await doFetch(TASKS_ENDPOINT, init);
  } catch (error: unknown) {
    // Network failure / DNS / offline: never leak the transport detail to the UI.
    throw new ApiError(fallbackMessage, null, null, error);
  }

  const body = await readJson(response);

  if (!response.ok) {
    throw new ApiError(messageFromBody(body, fallbackMessage), response.status, codeFromBody(body));
  }

  const tasks = extractTasks(body);
  if (tasks !== null) return tasks;

  // 2xx with a body we cannot read as a list.
  if (acknowledged !== undefined) {
    // The write succeeded; resolve with what we persisted rather than reporting an error.
    return acknowledged.map((task: Task) => ({ ...task }));
  }

  throw new ApiError(fallbackMessage, response.status, null);
}

/**
 * `GET /api/tasks` — the complete stored list, newest first.
 *
 * @param fetchImpl optional fetch override (tests inject a stub)
 * @throws {ApiError} on any non-OK response, an unreadable list, or a network failure
 */
export async function getTasks(fetchImpl?: FetchLike): Promise<Task[]> {
  return requestTaskList(
    {
      method: 'GET',
      headers: { ...JSON_HEADERS },
      credentials: 'omit',
    },
    { fallbackMessage: COPY.errors.loadFailed, fetchImpl },
  );
}

/**
 * `PUT /api/tasks` — replace the whole list with `tasks` and return what is stored.
 *
 * The COMPLETE list is always sent as a bare JSON array (an empty array clears the
 * list); the endpoint is last-write-wins, so the caller is responsible for ordering
 * its writes (the `useTasks` hook does that with a serial queue).
 *
 * @param tasks     the complete list to persist
 * @param fetchImpl optional fetch override (tests inject a stub)
 * @throws {ApiError} on any non-OK response or a network failure
 */
export async function saveTasks(tasks: readonly Task[], fetchImpl?: FetchLike): Promise<Task[]> {
  return requestTaskList(
    {
      method: 'PUT',
      headers: { ...JSON_HEADERS },
      body: serializeTaskList(tasks),
      credentials: 'omit',
    },
    { fallbackMessage: COPY.errors.saveFailed, acknowledged: tasks, fetchImpl },
  );
}
