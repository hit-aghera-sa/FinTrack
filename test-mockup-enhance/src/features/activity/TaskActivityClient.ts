/**
 * THE BROWSER CLIENT FOR ONE TASK'S ACTIVITY.
 *
 * Reads `GET /api/tasks/:taskId/activity` over same-origin `/api`, honours the
 * endpoint's `?limit`, and hands back the decoded entries newest first. Every
 * failure is reported as the app's shared `ApiError`, so screens can tell a
 * missing task (404) from an unreachable server (0).
 */

import { ApiError } from '../../lib/api/index.js';
import { decodeTaskActivityList, sortNewestFirst, type TaskActivity } from './activityModel.js';

/** The transport this client calls. The browser's own `fetch` satisfies it. */
export type ActivityFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** What a read may narrow. */
export interface TaskActivityListOptions {
  /** At most this many entries, newest first. */
  limit?: number;
}

/** The activity reads this feature makes. */
export interface TaskActivityClient {
  listActivity(taskId: string, options?: TaskActivityListOptions): Promise<TaskActivity[]>;
}

/** The task scope every activity address hangs off. */
export const TASK_ACTIVITY_ENDPOINT = '/api/tasks';

/** The address of one task's activity, with its optional limit. */
export function taskActivityPath(taskId: string, limit?: number): string {
  const base = `${TASK_ACTIVITY_ENDPOINT}/${encodeURIComponent(taskId)}/activity`;
  if (limit === undefined) {
    return base;
  }
  return `${base}?limit=${encodeURIComponent(String(limit))}`;
}

/** The message a failed response should be shown as. */
async function failureMessage(response: Response): Promise<string> {
  if (response.status === 404) {
    return 'That task could not be found.';
  }
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
      const record: Record<string, unknown> = body as Record<string, unknown>;
      for (const key of ['message', 'error']) {
        const said: unknown = record[key];
        if (typeof said === 'string' && said.trim() !== '') {
          return said;
        }
      }
    }
  } catch {
    // A body that cannot be read says nothing; the status below still does.
  }
  return `The activity could not be loaded (HTTP ${String(response.status)}).`;
}

/**
 * An activity client over the given transport. With none, the browser's own
 * `fetch` is used; the unit tests pass a stub instead.
 */
export function createTaskActivityClient(fetchImpl?: ActivityFetch): TaskActivityClient {
  const call: ActivityFetch =
    fetchImpl ?? ((input: string, init?: RequestInit): Promise<Response> => globalThis.fetch(input, init));

  return {
    async listActivity(taskId: string, options?: TaskActivityListOptions): Promise<TaskActivity[]> {
      if (taskId.trim() === '') {
        throw new ApiError(400, 'No task was named, so its activity cannot be loaded.');
      }

      let response: Response;
      try {
        response = await call(taskActivityPath(taskId, options?.limit), {
          headers: { accept: 'application/json' },
        });
      } catch {
        throw new ApiError(0, 'The server could not be reached. Check your connection and try again.');
      }

      if (!response.ok) {
        throw new ApiError(response.status, await failureMessage(response));
      }

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        throw new ApiError(response.status, 'The activity could not be read from the server.');
      }

      return sortNewestFirst(decodeTaskActivityList(payload));
    },
  };
}

/** The client the activity screen uses, bound to the real same-origin API. */
export const taskActivityClient: TaskActivityClient = createTaskActivityClient();
