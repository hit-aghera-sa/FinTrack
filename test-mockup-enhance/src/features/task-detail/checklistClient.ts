/**
 * THE TASK DETAIL SCREEN'S CHECKLIST FETCH CLIENT.
 *
 * Every address comes from the SHARED checklist route table
 * (`CHECKLIST_API_PATHS`, src/models/checklist/index.ts), so this module never
 * writes a URL of its own, and every call is same-origin `/api`:
 *
 *   GET    /api/tasks/:taskId/checklist           one task's items, by position
 *   POST   /api/tasks/:taskId/checklist           add an item
 *   PATCH  /api/tasks/:taskId/checklist/:itemId   tick or untick one item
 *   DELETE /api/tasks/:taskId/checklist/:itemId   remove one item
 *
 * Failures are reported as the app's shared {@link ApiError}, carrying the
 * server's own status and message (status 0 when the backend could not be
 * reached at all) so the panel can say what went wrong.
 */

import { ApiError } from '../../lib/api/index.js';
import { CHECKLIST_API_PATHS, type ChecklistItem } from '../../models/checklist/index.js';

/** The transport the client talks through. The browser's `fetch` satisfies it. */
export type ChecklistFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Everything the checklist panel asks of the backend. */
export interface ChecklistClient {
  /** One task's checklist, in stored order. */
  listItems(taskId: string): Promise<ChecklistItem[]>;
  /** Adds an item to the end of a task's checklist. */
  addItem(taskId: string, title: string): Promise<ChecklistItem>;
  /** Ticks or unticks one item and returns it as stored. */
  setDone(taskId: string, itemId: string, done: boolean): Promise<ChecklistItem>;
  /** Removes one item, immediately. */
  removeItem(taskId: string, itemId: string): Promise<void>;
}

/** The transport used when none is supplied, safe even where `fetch` is absent. */
function defaultFetch(input: string, init?: RequestInit): Promise<Response> {
  const impl: unknown = globalThis.fetch;
  if (typeof impl !== 'function') {
    return Promise.reject(new ApiError(0, 'The checklist could not be reached.'));
  }
  return globalThis.fetch(input, init);
}

/** One payload row as the shared model, or null when it is not a checklist item. */
function toItem(value: unknown): ChecklistItem | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id: unknown = row.id;
  const taskId: unknown = row.taskId;
  const title: unknown = row.title;
  if (typeof id !== 'string' || typeof taskId !== 'string' || typeof title !== 'string') {
    return null;
  }
  const position: unknown = row.position;
  const createdAt: unknown = row.createdAt;
  return {
    id,
    taskId,
    title,
    done: row.done === true,
    position: typeof position === 'number' ? position : 0,
    createdAt: typeof createdAt === 'string' ? createdAt : '',
  };
}

/** Every checklist item in a list payload, skipping anything unreadable. */
function toItems(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: readonly unknown[] = value;
  const items: ChecklistItem[] = [];
  for (const row of rows) {
    const item = toItem(row);
    if (item !== null) {
      items.push(item);
    }
  }
  return items;
}

/** The refusal a failed response carries, with the server's own wording. */
async function failureOf(response: Response): Promise<ApiError> {
  let message = `The checklist request failed (${String(response.status)}).`;
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
async function send(
  fetchImpl: ChecklistFetch,
  input: string,
  init?: RequestInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(input, init);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new ApiError(0, `The checklist could not be reached. ${reason}`);
  }
  if (!response.ok) {
    throw await failureOf(response);
  }
  return response;
}

/** The checklist item a write answered with. */
async function readItem(response: Response): Promise<ChecklistItem> {
  const body: unknown = await response.json();
  const item = toItem(body);
  if (item === null) {
    throw new ApiError(response.status, 'The server returned an unreadable checklist item.');
  }
  return item;
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

/** Builds a checklist client over a transport. Defaults to the browser's fetch. */
export function createChecklistClient(fetchImpl: ChecklistFetch = defaultFetch): ChecklistClient {
  return {
    async listItems(taskId: string): Promise<ChecklistItem[]> {
      const response = await send(fetchImpl, CHECKLIST_API_PATHS.items(taskId));
      const body: unknown = await response.json();
      return toItems(body);
    },

    async addItem(taskId: string, title: string): Promise<ChecklistItem> {
      const response = await send(
        fetchImpl,
        CHECKLIST_API_PATHS.items(taskId),
        jsonInit('POST', { title }),
      );
      return readItem(response);
    },

    async setDone(taskId: string, itemId: string, done: boolean): Promise<ChecklistItem> {
      const response = await send(
        fetchImpl,
        CHECKLIST_API_PATHS.item(taskId, itemId),
        jsonInit('PATCH', { done }),
      );
      return readItem(response);
    },

    async removeItem(taskId: string, itemId: string): Promise<void> {
      await send(fetchImpl, CHECKLIST_API_PATHS.item(taskId, itemId), { method: 'DELETE' });
    },
  };
}

/** The client the shipped panel uses: the real same-origin backend. */
export const checklistClient: ChecklistClient = createChecklistClient();
