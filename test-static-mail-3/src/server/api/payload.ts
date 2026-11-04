/**
 * Request/response payload handling for the tasks API.
 *
 * Everything here is pure and framework-free so the wire contract can be unit
 * tested without booting a server. The route module composes these helpers; it
 * never invents its own status codes or error wording.
 *
 * NOTE ON STORE ERRORS: this module deliberately does NOT import an error class
 * from the store lane. The store lane owns its own error type and may rename or
 * reshape it; the API only needs to recognise "this failure describes a bad task
 * list" and reuse the code/message it carries. The check below is therefore
 * STRUCTURAL, which also means a thrown value that is not an object can never
 * blow up an `instanceof` inside the error path (that failure mode used to leave
 * requests hanging with no response at all).
 */
import { COPY, apiError, statusForErrorCode } from '../../models/index.js';
import type { ApiErrorCode, ApiErrorResponse, Task } from '../../models/index.js';

/** A rendered API failure: the HTTP status and the canonical error body. */
export interface ApiFailure {
  readonly status: number;
  readonly body: ApiErrorResponse;
}

/** Build a failure from a shared error code plus its user-facing message. */
export function failure(code: ApiErrorCode, message: string): ApiFailure {
  return { status: statusForErrorCode(code), body: apiError(code, message) };
}

/** Result of reading the full task list out of an untrusted request body. */
export type ExtractResult =
  | { readonly ok: true; readonly value: unknown[] }
  | { readonly ok: false; readonly failure: ApiFailure };

/**
 * Read the COMPLETE task list from a PUT body.
 *
 * Accepts either a bare JSON array (the canonical shape) or an object wrapping the
 * array under `tasks`, so a client using the shared `TaskListResponse` envelope
 * round-trips too. Anything else is rejected wholesale — a partial update is never
 * possible. Note that an EMPTY array is valid input, not an error.
 */
export function extractTaskList(body: unknown): ExtractResult {
  if (Array.isArray(body)) {
    return { ok: true, value: [...body] };
  }
  if (typeof body === 'object' && body !== null) {
    const wrapped = (body as { tasks?: unknown }).tasks;
    if (Array.isArray(wrapped)) {
      return { ok: true, value: [...wrapped] };
    }
  }
  return { ok: false, failure: failure('bad_request', COPY.errors.unexpected) };
}

/** True when the error came from a malformed JSON request body. */
export function isJsonSyntaxError(error: unknown): boolean {
  if (error instanceof SyntaxError) return true;
  if (typeof error !== 'object' || error === null) return false;
  const record = error as { type?: unknown; status?: unknown };
  return record.type === 'entity.parse.failed' || record.status === 400;
}

/** The shared error codes a store may raise while validating a task list. */
const VALIDATION_CODES: readonly ApiErrorCode[] = [
  'bad_request',
  'title_required',
  'title_too_long',
];

/** The message an error carries, falling back to the shared "unexpected" copy. */
function messageOf(record: { message?: unknown }): string {
  return typeof record.message === 'string' && record.message.trim().length > 0
    ? record.message
    : COPY.errors.unexpected;
}

/**
 * Recognise a store validation failure without depending on the store lane's error
 * class, and render it with its OWN code and message.
 *
 * Returns `null` when the error is not a validation failure, so the caller can go on
 * to the malformed-JSON and 500 cases.
 */
function validationFailure(error: unknown): ApiFailure | null {
  if (typeof error !== 'object' || error === null) return null;
  const record = error as { name?: unknown; code?: unknown; message?: unknown };

  if (typeof record.code === 'string') {
    const code = record.code;
    const known = VALIDATION_CODES.find((candidate: ApiErrorCode) => candidate === code);
    if (known !== undefined) {
      return failure(known, messageOf(record));
    }
  }

  if (typeof record.name === 'string' && record.name.endsWith('ValidationError')) {
    return failure('bad_request', messageOf(record));
  }

  return null;
}

/**
 * Map any thrown value onto an {@link ApiFailure}.
 *
 * Store validation errors keep their own code/message (400 for a bad title), a
 * malformed JSON body is a 400 bad_request, and anything unexpected degrades to a
 * 500 with the shared "something went wrong" copy — the raw error never leaks.
 */
export function failureFromError(error: unknown): ApiFailure {
  const validation = validationFailure(error);
  if (validation !== null) {
    return validation;
  }
  if (isJsonSyntaxError(error)) {
    return failure('bad_request', COPY.errors.unexpected);
  }
  return failure('server_error', COPY.errors.unexpected);
}

/**
 * The body sent for a successful GET/PUT: the plain `Task[]`, copied so the store's
 * own array is never handed to the serialiser. An empty list serialises to `[]`.
 */
export function taskListBody(tasks: readonly Task[]): Task[] {
  return tasks.map((task: Task) => ({ ...task }));
}
