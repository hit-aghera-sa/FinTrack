// e2e/support/activityApi.ts
//
// The TASK ACTIVITY endpoints of the app's own HTTP API, as the acceptance suite drives them.
//
// Nothing here imports from src/: Playwright loads spec files and their helpers with its own
// transform, so an application module pulled in here could take the whole suite down before a
// single test runs. The readers below are deliberately tolerant about the exact spelling of the
// payload (a bare array or an envelope, `createdAt` or `occurredAt`) and strict about what the
// feed must actually contain — the facts a timeline is useless without.
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

/** One entry of a task's activity feed, read as the plain JSON object the API sent. */
export type ActivityEntry = Record<string, unknown>;

/** The browser address of one task's activity timeline. */
export function taskActivityPath(taskId: string): string {
  return `/tasks/${taskId}/activity`;
}

/** The HTTP address of one task's activity feed. */
export function taskActivityEndpoint(taskId: string): string {
  return `/api/tasks/${taskId}/activity`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The keys an envelope may hold its entries under. */
const ENVELOPE_KEYS: readonly string[] = [
  'entries',
  'activity',
  'activities',
  'items',
  'events',
  'results',
  'data',
];

/** The entries of a feed body, whether it is a bare array or an envelope carrying one. */
export function readEntries(body: unknown): ActivityEntry[] {
  if (Array.isArray(body)) {
    return body.filter(isRecord);
  }
  if (isRecord(body)) {
    for (const key of ENVELOPE_KEYS) {
      const held: unknown = body[key];
      if (Array.isArray(held)) {
        return held.filter(isRecord);
      }
    }
  }
  return [];
}

/** Everything one entry says, lowercased — so a spec can assert on it without pinning field names. */
export function entryText(entry: ActivityEntry): string {
  return JSON.stringify(entry).toLowerCase();
}

/** The keys an entry may carry its own identifier under. */
const ID_KEYS: readonly string[] = ['id', 'entryId', 'activityId'];

/** The entry's own identifier, or an empty string when it carries none. */
export function entryId(entry: ActivityEntry): string {
  for (const key of ID_KEYS) {
    const held: unknown = entry[key];
    if (typeof held === 'string' && held !== '') {
      return held;
    }
  }
  return '';
}

/** The keys an entry may carry its moment under. */
const TIME_KEYS: readonly string[] = [
  'createdAt',
  'occurredAt',
  'recordedAt',
  'changedAt',
  'timestamp',
  'time',
  'at',
];

/** The moment an entry was recorded, in milliseconds, or NaN when it carries none. */
export function entryTime(entry: ActivityEntry): number {
  for (const key of TIME_KEYS) {
    const held: unknown = entry[key];
    if (typeof held === 'string') {
      const parsed = Date.parse(held);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    if (typeof held === 'number' && Number.isFinite(held)) {
      return held;
    }
  }
  return Number.NaN;
}

/** The raw answer of the activity feed — for the specs about a refusal. */
export function getActivityResponse(
  request: APIRequestContext,
  taskId: string,
): Promise<APIResponse> {
  return request.get(taskActivityEndpoint(taskId));
}

/** One task's activity feed, failing the spec when the endpoint does not answer 200. */
export async function fetchActivity(
  request: APIRequestContext,
  taskId: string,
): Promise<ActivityEntry[]> {
  const response = await getActivityResponse(request, taskId);
  expect(
    response.status(),
    'GET /api/tasks/:taskId/activity must answer 200 for a real task',
  ).toBe(200);
  return readEntries(await response.json());
}

/** The entries whose text matches every one of these patterns. */
export function entriesMentioning(
  entries: readonly ActivityEntry[],
  ...patterns: readonly RegExp[]
): ActivityEntry[] {
  return entries.filter((entry: ActivityEntry): boolean => {
    const text = entryText(entry);
    return patterns.every((pattern: RegExp): boolean => pattern.test(text));
  });
}

/**
 * A short wait between two recorded actions, so the feed's newest-first order is decided by the
 * order the actions really happened in rather than by a tie on the same millisecond.
 */
export async function pause(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
