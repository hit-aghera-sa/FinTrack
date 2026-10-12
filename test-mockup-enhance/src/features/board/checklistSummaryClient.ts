/**
 * THE BOARD'S CHECKLIST SUMMARY CLIENT.
 *
 * The board card badge needs one number pair per task, so it reads the shared
 * progress endpoint once alongside the task list:
 *
 *   GET /api/checklist/summary   →   ChecklistProgress[]
 *
 * The address comes from the SHARED checklist route table
 * (`CHECKLIST_API_PATHS.summary`, src/models/checklist/index.ts) — this module
 * never writes a URL of its own, and the call is same-origin `/api`.
 *
 * Failures are reported as the app's shared {@link ApiError}, carrying the
 * server's own status (status 0 when the backend could not be reached at all);
 * the board treats a failed summary as "no checklists yet" so the columns keep
 * working.
 */

import { ApiError } from "../../lib/api/index.js";
import { CHECKLIST_API_PATHS, type ChecklistProgress } from "../../models/checklist/index.js";

/** The transport the client talks through. The browser's `fetch` satisfies it. */
export type ChecklistSummaryFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Everything the board asks of the checklist summary endpoint. */
export interface ChecklistSummaryClient {
  /** The progress counts of every task that has a checklist. */
  listProgress(): Promise<ChecklistProgress[]>;
}

/** The transport used when none is supplied, safe even where `fetch` is absent. */
function defaultFetch(input: string, init?: RequestInit): Promise<Response> {
  const impl: unknown = globalThis.fetch;
  if (typeof impl !== "function") {
    return Promise.reject(new ApiError(0, "The checklist summary could not be reached."));
  }
  return globalThis.fetch(input, init);
}

/** One payload row as the shared model, or null when it is not a progress row. */
function toProgress(value: unknown): ChecklistProgress | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const taskId: unknown = row.taskId;
  if (typeof taskId !== "string" || taskId === "") {
    return null;
  }
  const done: unknown = row.done;
  const total: unknown = row.total;
  return {
    taskId,
    done: typeof done === "number" && Number.isFinite(done) ? done : 0,
    total: typeof total === "number" && Number.isFinite(total) ? total : 0,
  };
}

/** Every readable progress row of a list payload. */
function toProgressList(value: unknown): ChecklistProgress[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: readonly unknown[] = value;
  const counts: ChecklistProgress[] = [];
  for (const row of rows) {
    const parsed = toProgress(row);
    if (parsed !== null) {
      counts.push(parsed);
    }
  }
  return counts;
}

/** Builds a summary client over a transport. Defaults to the browser's fetch. */
export function createChecklistSummaryClient(
  fetchImpl: ChecklistSummaryFetch = defaultFetch,
): ChecklistSummaryClient {
  return {
    async listProgress(): Promise<ChecklistProgress[]> {
      let response: Response;
      try {
        response = await fetchImpl(CHECKLIST_API_PATHS.summary);
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          throw error;
        }
        const reason = error instanceof Error ? error.message : String(error);
        throw new ApiError(0, `The checklist summary could not be reached. ${reason}`);
      }

      if (!response.ok) {
        throw new ApiError(
          response.status,
          `The checklist summary request failed (${String(response.status)}).`,
        );
      }

      const body: unknown = await response.json();
      return toProgressList(body);
    },
  };
}

/** The client the shipped board uses: the real same-origin backend. */
export const checklistSummaryClient: ChecklistSummaryClient = createChecklistSummaryClient();
