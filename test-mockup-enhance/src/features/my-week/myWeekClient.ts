/**
 * THE MY WEEK READER.
 *
 * The page reads the EXISTING endpoints and does all of its filtering and
 * grouping in the browser — no new endpoint, no new query parameter, no change
 * to any response shape:
 *
 *   GET /api/tasks     every task on the board
 *   GET /api/members   the roster, for the assignee name on a row
 *
 * Both addresses are built from the project's single `/api` scope. Failures
 * are reported as the app's shared {@link ApiError}, carrying the server's own
 * status and message (status 0 when the backend could not be reached), so the
 * screen can say what went wrong.
 */

import { ApiError } from '../../lib/api/index.js';
import { API_PREFIX } from '../../shared/api-paths.js';
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  isTaskPriority,
  isTaskStatus,
  type Task,
  type TeamMemberWithWorkload,
} from '../../models/index.js';

/** The transport the reader talks through. The browser's `fetch` satisfies it. */
export type MyWeekFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Everything the My week screen asks of the backend. */
export interface MyWeekTasksClient {
  /** Every task on the board. */
  listTasks(): Promise<Task[]>;
  /** The team roster, so a row can name its assignee. */
  listMembers(): Promise<TeamMemberWithWorkload[]>;
}

/** The addresses this screen reads. */
export const MY_WEEK_TASKS_ENDPOINT = `${API_PREFIX}/tasks`;
export const MY_WEEK_MEMBERS_ENDPOINT = `${API_PREFIX}/members`;

/** The transport used when none is supplied, safe even where `fetch` is absent. */
function defaultFetch(input: string, init?: RequestInit): Promise<Response> {
  const impl: unknown = globalThis.fetch;
  if (typeof impl !== 'function') {
    return Promise.reject(new ApiError(0, 'The board could not be reached.'));
  }
  return globalThis.fetch(input, init);
}

/** The refusal a failed response carries, with the server's own wording. */
async function failureOf(response: Response): Promise<ApiError> {
  let message = `The request failed (${String(response.status)}).`;
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
      const record = body as Record<string, unknown>;
      const said: unknown = record.message ?? record.error;
      if (typeof said === 'string' && said.trim() !== '') {
        message = said;
      }
    }
  } catch {
    // No JSON body: the status line is all the server said.
  }
  return new ApiError(response.status, message);
}

/** A request that answers JSON, or throws an {@link ApiError}. */
async function send(fetchImpl: MyWeekFetch, input: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(input);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new ApiError(0, `The board could not be reached. ${reason}`);
  }
  if (!response.ok) {
    throw await failureOf(response);
  }
  return (await response.json()) as unknown;
}

/** One payload row as the shared task model, or null when it is unreadable. */
function toTask(value: unknown): Task | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id: unknown = row.id;
  const title: unknown = row.title;
  if (typeof id !== 'string' || typeof title !== 'string') {
    return null;
  }
  const description: unknown = row.description;
  const assigneeId: unknown = row.assigneeId;
  const dueDate: unknown = row.dueDate;
  const createdAt: unknown = row.createdAt;
  return {
    id,
    title,
    description: typeof description === 'string' ? description : '',
    assigneeId: typeof assigneeId === 'string' && assigneeId !== '' ? assigneeId : null,
    dueDate: typeof dueDate === 'string' && dueDate !== '' ? dueDate : null,
    status: isTaskStatus(row.status) ? row.status : DEFAULT_TASK_STATUS,
    priority: isTaskPriority(row.priority) ? row.priority : DEFAULT_TASK_PRIORITY,
    createdAt: typeof createdAt === 'string' ? createdAt : '',
  };
}

/** One payload row as a roster member, or null when it is unreadable. */
function toMember(value: unknown): TeamMemberWithWorkload | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id: unknown = row.id;
  const name: unknown = row.name;
  if (typeof id !== 'string' || typeof name !== 'string') {
    return null;
  }
  const role: unknown = row.role;
  const openTaskCount: unknown = row.openTaskCount;
  return {
    id,
    name,
    role: typeof role === 'string' ? role : '',
    openTaskCount: typeof openTaskCount === 'number' ? openTaskCount : 0,
  };
}

/** Builds a reader over a transport. Defaults to the browser's fetch. */
export function createMyWeekClient(fetchImpl: MyWeekFetch = defaultFetch): MyWeekTasksClient {
  return {
    async listTasks(): Promise<Task[]> {
      const body: unknown = await send(fetchImpl, MY_WEEK_TASKS_ENDPOINT);
      if (!Array.isArray(body)) {
        return [];
      }
      const rows: readonly unknown[] = body;
      const tasks: Task[] = [];
      for (const row of rows) {
        const task = toTask(row);
        if (task !== null) {
          tasks.push(task);
        }
      }
      return tasks;
    },

    async listMembers(): Promise<TeamMemberWithWorkload[]> {
      const body: unknown = await send(fetchImpl, MY_WEEK_MEMBERS_ENDPOINT);
      if (!Array.isArray(body)) {
        return [];
      }
      const rows: readonly unknown[] = body;
      const members: TeamMemberWithWorkload[] = [];
      for (const row of rows) {
        const member = toMember(row);
        if (member !== null) {
          members.push(member);
        }
      }
      return members;
    },
  };
}

/** The reader the shipped page uses: the real same-origin backend. */
export const myWeekClient: MyWeekTasksClient = createMyWeekClient();
