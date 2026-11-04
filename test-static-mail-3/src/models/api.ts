/**
 * The HTTP contract shared by the server route lane and the browser API client.
 * Route paths, request/response payloads and error codes live here ONCE.
 */
import type { Filter, Task, TitleErrorCode } from './task.js';

/** Path of the tasks collection. */
export const TASKS_PATH = '/api/tasks';

/** Path of a single task resource. */
export function taskPath(id: string): string {
  return `${TASKS_PATH}/${encodeURIComponent(id)}`;
}

export interface ApiRoutes {
  readonly health: string;
  readonly tasks: string;
  readonly task: (id: string) => string;
}

/** The route table. Never hardcode these paths elsewhere. */
export const API_ROUTES: ApiRoutes = {
  health: '/api/health',
  tasks: TASKS_PATH,
  task: taskPath,
};

/** Body of `POST /api/tasks`. */
export interface CreateTaskRequest {
  readonly title: string;
}

/** Body of `PATCH /api/tasks/:id`. */
export interface UpdateTaskRequest {
  readonly title?: string;
  readonly completed?: boolean;
}

/** Body of `GET /api/tasks`. */
export interface TaskListResponse {
  readonly tasks: Task[];
}

/** Body of `POST /api/tasks` and `PATCH /api/tasks/:id`. */
export interface TaskResponse {
  readonly task: Task;
}

/** Machine-readable API failure codes. */
export type ApiErrorCode = TitleErrorCode | 'not_found' | 'bad_request' | 'server_error';

export interface ApiErrorBody {
  readonly code: ApiErrorCode;
  /** User-facing message, taken from the copy contract. */
  readonly message: string;
}

/** Body returned for any non-2xx API response. */
export interface ApiErrorResponse {
  readonly error: ApiErrorBody;
}

/** HTTP status used for each error code. */
export const HTTP_STATUS_BY_ERROR_CODE: Readonly<Record<ApiErrorCode, number>> = {
  title_required: 400,
  title_too_long: 400,
  bad_request: 400,
  not_found: 404,
  server_error: 500,
};

/** Build the canonical error payload. */
export function apiError(code: ApiErrorCode, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

/** HTTP status for an error code. */
export function statusForErrorCode(code: ApiErrorCode): number {
  return HTTP_STATUS_BY_ERROR_CODE[code];
}

/** Runtime guard for {@link ApiErrorResponse}. */
export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return false;
  const body = error as Record<string, unknown>;
  return typeof body.code === 'string' && typeof body.message === 'string';
}

/** Append a filter as a query string, omitting it when it is the default. */
export function tasksQuery(filter?: Filter): string {
  if (!filter || filter === 'all') return TASKS_PATH;
  return `${TASKS_PATH}?filter=${filter}`;
}
