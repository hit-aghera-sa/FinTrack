/**
 * THE browser API client for the board backend.
 *
 * Every screen talks to the server through this module and never calls `fetch`
 * itself. There is no in-memory substitute store: each read is a GET against
 * the real backend and each create / update / delete is a write, so data
 * survives a page reload.
 *
 * Request and response payloads are the shared domain models owned by the data
 * lane (`src/models/**`) — nothing is re-declared here.
 *
 * Endpoints (mounted by the server composition root under `/api`):
 *   GET    /api/tasks                      → Task[]
 *   GET    /api/tasks/:id                  → Task
 *   POST   /api/tasks                      → Task
 *   PATCH  /api/tasks/:id                  → Task      (also the status move)
 *   GET    /api/tasks/:taskId/comments     → TaskComment[]
 *   POST   /api/tasks/:taskId/comments     → TaskComment
 *   GET    /api/members                    → TeamMemberWithWorkload[]
 *   POST   /api/members                    → TeamMember
 *   DELETE /api/members/:id                → 204
 */

import { DEFAULT_TASK_PRIORITY, isTaskPriority, isTaskStatus } from "../../models/task.js";
import type { NewTask, Task, TaskUpdate } from "../../models/task.js";
import { DEFAULT_LABEL_COLOR, isLabelColor } from "../../models/label.js";
import type { Label } from "../../models/label.js";
import type { NewComment, TaskComment } from "../../models/comment.js";
import type {
  NewTeamMember,
  TeamMember,
  TeamMemberWithWorkload,
} from "../../models/member.js";

/**
 * A failed request. Carries the HTTP status and the message the server sent, so
 * a screen can tell a validation problem (400) from a missing record (404) from
 * an outage, and can show the server's own wording.
 *
 * `status` is 0 when the request never produced an HTTP response (the backend
 * could not be reached, or it answered with something that is not the expected
 * payload).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** The typed surface every screen uses. */
export interface BoardApi {
  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task>;
  createTask(input: NewTask): Promise<Task>;
  updateTask(id: string, patch: TaskUpdate): Promise<Task>;
  listComments(taskId: string): Promise<TaskComment[]>;
  addComment(taskId: string, body: string): Promise<TaskComment>;
  listMembers(): Promise<TeamMemberWithWorkload[]>;
  addMember(input: NewTeamMember): Promise<TeamMember>;
  removeMember(id: string): Promise<void>;
}

/** The shape of `fetch` this client needs. Tests pass a double of this type. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** How a client instance is configured. Both parts are optional. */
export interface BoardApiOptions {
  /** Where the API lives. Defaults to the same-origin `/api` mount. */
  baseUrl?: string;
  /** The transport. Defaults to the browser's own `fetch`. */
  fetch?: FetchLike;
}

/** Same-origin API mount: the dev server proxies it, production serves it. */
const DEFAULT_BASE_URL = "/api";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unexpectedPayload(): ApiError {
  return new ApiError(0, "The board backend returned an unexpected response.");
}

/** Resolves the transport at call time, so importing this module never throws. */
function resolveFetch(custom: FetchLike | undefined): FetchLike {
  if (custom !== undefined) {
    return custom;
  }
  const candidate: unknown = globalThis.fetch;
  if (typeof candidate !== "function") {
    throw new ApiError(0, "This environment cannot make network requests.");
  }
  return globalThis.fetch.bind(globalThis);
}

/** Reads a response body as JSON, tolerating an empty body (204) or plain text. */
async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === "") {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * The message to show for a failed request.
 *
 * The three routers spell their problem bodies slightly differently — the task
 * router sends `{ message }`, the comment router `{ error, message }` and the
 * team router `{ error }` — so both keys are understood here.
 */
function messageFromBody(body: unknown, status: number, statusText: string): string {
  if (isRecord(body)) {
    const message: unknown = body.message;
    if (typeof message === "string" && message.trim() !== "") {
      return message;
    }
    const error: unknown = body.error;
    if (typeof error === "string" && error.trim() !== "") {
      return error;
    }
  }
  if (typeof body === "string" && body.trim() !== "") {
    return body;
  }
  if (statusText.trim() !== "") {
    return statusText;
  }
  return `The request failed with status ${String(status)}.`;
}

async function request(
  fetchImpl: FetchLike,
  baseUrl: string,
  method: HttpMethod,
  path: string,
  payload?: unknown,
): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const init: RequestInit = { method, headers };
  if (payload !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(payload);
  }

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, init);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ApiError(0, `The board backend could not be reached: ${detail}`);
  }

  const body = await readBody(response);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      messageFromBody(body, response.status, response.statusText),
    );
  }
  return body;
}

/**
 * One label out of an untrusted payload, or null when it is not one.
 *
 * A label's colour is the NAME of a design token: an unknown name reads as the
 * shared default rather than failing the whole task.
 */
function decodeLabel(value: unknown): Label | null {
  if (!isRecord(value)) {
    return null;
  }
  const id: unknown = value.id;
  const name: unknown = value.name;
  const color: unknown = value.color;
  if (typeof id !== "string" || id === "" || typeof name !== "string") {
    return null;
  }
  return { id, name, color: isLabelColor(color) ? color : DEFAULT_LABEL_COLOR };
}

/**
 * The labels a task payload carries, or `undefined` when it carries no `labels`
 * array at all — a payload written before labels existed simply has none, and
 * the property is then left off the decoded task.
 */
function decodeLabels(value: unknown): Label[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const entries: unknown[] = value;
  const labels: Label[] = [];
  for (const entry of entries) {
    const label = decodeLabel(entry);
    if (label !== null) {
      labels.push(label);
    }
  }
  return labels;
}

function decodeTask(value: unknown): Task {
  if (!isRecord(value)) {
    throw unexpectedPayload();
  }
  const id: unknown = value.id;
  const title: unknown = value.title;
  const description: unknown = value.description;
  const assigneeId: unknown = value.assigneeId;
  const dueDate: unknown = value.dueDate;
  const status: unknown = value.status;
  const priority: unknown = value.priority;
  const createdAt: unknown = value.createdAt;

  if (typeof id !== "string" || typeof title !== "string" || !isTaskStatus(status)) {
    throw unexpectedPayload();
  }

  const task: Task = {
    id,
    title,
    description: typeof description === "string" ? description : "",
    assigneeId: typeof assigneeId === "string" && assigneeId !== "" ? assigneeId : null,
    dueDate: typeof dueDate === "string" && dueDate !== "" ? dueDate : null,
    status,
    // An older payload without a priority reads as the shared default, which is
    // exactly what the backend stores when a create omits it.
    priority: isTaskPriority(priority) ? priority : DEFAULT_TASK_PRIORITY,
    createdAt: typeof createdAt === "string" ? createdAt : "",
  };

  // THE LABELS THE TASK CARRIES. Kept rather than dropped: the task screen
  // shows a chip for each of them and saves the whole set back as `labelIds`,
  // so a decoder that discarded them silently emptied every task's labels.
  const labels = decodeLabels(value.labels);
  if (labels !== undefined) {
    task.labels = labels;
  }

  return task;
}

function decodeComment(value: unknown): TaskComment {
  if (!isRecord(value)) {
    throw unexpectedPayload();
  }
  const id: unknown = value.id;
  const taskId: unknown = value.taskId;
  const body: unknown = value.body;
  const createdAt: unknown = value.createdAt;

  if (typeof id !== "string" || typeof taskId !== "string" || typeof body !== "string") {
    throw unexpectedPayload();
  }

  return {
    id,
    taskId,
    body,
    createdAt: typeof createdAt === "string" ? createdAt : "",
  };
}

function decodeMember(value: unknown): TeamMember {
  if (!isRecord(value)) {
    throw unexpectedPayload();
  }
  const id: unknown = value.id;
  const name: unknown = value.name;
  const role: unknown = value.role;

  if (typeof id !== "string" || typeof name !== "string") {
    throw unexpectedPayload();
  }

  return { id, name, role: typeof role === "string" ? role : "" };
}

function decodeMemberWithWorkload(value: unknown): TeamMemberWithWorkload {
  const member = decodeMember(value);
  const openTaskCount: unknown = isRecord(value) ? value.openTaskCount : undefined;
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    openTaskCount: typeof openTaskCount === "number" && Number.isFinite(openTaskCount)
      ? openTaskCount
      : 0,
  };
}

function decodeList<T>(value: unknown, decode: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    throw unexpectedPayload();
  }
  return value.map((item: unknown): T => decode(item));
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Builds a client. Screens use the shared {@link api} instance; their tests
 * build one with a fetch double (`createBoardApi({ fetch })`).
 */
export function createBoardApi(options: BoardApiOptions = {}): BoardApi {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  const call = async (
    method: HttpMethod,
    path: string,
    payload?: unknown,
  ): Promise<unknown> => request(resolveFetch(options.fetch), baseUrl, method, path, payload);

  return {
    async listTasks(): Promise<Task[]> {
      return decodeList(await call("GET", "/tasks"), decodeTask);
    },

    async getTask(id: string): Promise<Task> {
      return decodeTask(await call("GET", `/tasks/${segment(id)}`));
    },

    async createTask(input: NewTask): Promise<Task> {
      return decodeTask(await call("POST", "/tasks", input));
    },

    async updateTask(id: string, patch: TaskUpdate): Promise<Task> {
      return decodeTask(await call("PATCH", `/tasks/${segment(id)}`, patch));
    },

    async listComments(taskId: string): Promise<TaskComment[]> {
      return decodeList(
        await call("GET", `/tasks/${segment(taskId)}/comments`),
        decodeComment,
      );
    },

    async addComment(taskId: string, body: string): Promise<TaskComment> {
      const payload: NewComment = { body };
      return decodeComment(
        await call("POST", `/tasks/${segment(taskId)}/comments`, payload),
      );
    },

    async listMembers(): Promise<TeamMemberWithWorkload[]> {
      return decodeList(await call("GET", "/members"), decodeMemberWithWorkload);
    },

    async addMember(input: NewTeamMember): Promise<TeamMember> {
      return decodeMember(await call("POST", "/members", input));
    },

    async removeMember(id: string): Promise<void> {
      await call("DELETE", `/members/${segment(id)}`);
    },
  };
}

/** The one client the application uses, pointed at the same-origin `/api`. */
export const api: BoardApi = createBoardApi();
