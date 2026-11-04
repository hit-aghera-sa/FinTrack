/**
 * Shared helpers for the QuickList acceptance suite.
 *
 * NOTHING HERE IMPORTS FROM `src/`. Playwright loads spec files (and these helpers)
 * with its own transform, so the app is reached ONLY through the browser (`page`) and
 * its HTTP API (`request`). Any constant the specs need is a COPY kept here.
 *
 * SELECTORS ARE STRUCTURAL ON PURPOSE.
 * The rows expose stable contract hooks — `li[data-task-id]`, `data-completed`, and the
 * `data-testid` values for the list, empty state, error line and footer — so the suite
 * does not depend on the lane's internal CSS class names. That matters twice over:
 *   1. a class rename in the component lane cannot silently break acceptance;
 *   2. the strikethrough criterion is proven from the COMPUTED `text-decoration-line`,
 *      i.e. from what the user actually sees, not from a class string.
 *
 * Contract hooks used here (all rendered by the real app):
 *   composer input  -> #new-task-title
 *   submit          -> .controls-add__submit  (the only submit button in the composer)
 *   rows            -> li[data-task-id]  (+ data-completed="true|false")
 *   row title       -> the row's single <span>
 *   row checkbox    -> the row's input[type="checkbox"]
 *   row remove      -> the row's single <button>
 *   filters         -> button[data-filter="all|active|completed"]
 *   footer          -> [data-testid="task-footer"]
 *   error line      -> [data-testid="error-line"]
 *   empty state     -> [data-testid="task-list-empty"] OR [data-testid="controls-empty"]
 */
import { expect } from '@playwright/test';
import type { APIRequestContext, Locator, Page, Response } from '@playwright/test';

/** Feature slug used by the spec tag and the capture artifacts. */
export const FEATURE_SLUG = 'acceptance-regression-test-suite';

/** The one endpoint the client talks to. */
export const TASKS_ENDPOINT = '/api/tasks';

/** Liveness endpoint (also the runner's webServer readiness probe). */
export const HEALTH_ENDPOINT = '/api/health';

/** The filter control labels the screen renders. */
export const FILTER_LABELS = {
  all: 'All',
  active: 'Active',
  completed: 'Completed',
} as const;

/** A filter key, exactly as the `data-filter` attribute spells it. */
export type FilterKey = keyof typeof FILTER_LABELS;

/** A task as it travels over the wire. */
export interface WireTask {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly createdAt: string;
}

/** Browser storage usage, used to prove the list is not client-persisted. */
export interface StorageUsage {
  readonly local: number;
  readonly session: number;
  readonly entries: string[];
}

/**
 * A well-formed two-task list for the API-level specs: RFC-4122 v4 ids, ISO
 * timestamps, newest first, readable titles (never a bare number, which would be
 * indistinguishable from a leaked raw id if it ever reached the screen).
 */
export const SAMPLE_TASKS: readonly WireTask[] = [
  {
    id: 'f1a2b3c4-d5e6-4f70-8a91-b2c3d4e5f601',
    title: 'Priya Lunch prep',
    completed: true,
    createdAt: '2024-05-02T10:00:00.000Z',
  },
  {
    id: 'a9b8c7d6-e5f4-4321-8abc-0123456789ab',
    title: 'Alex QA groceries',
    completed: false,
    createdAt: '2024-05-01T10:00:00.000Z',
  },
];

/** The footer sentence the app renders: exactly `N of M tasks done`. */
export function footerSummary(done: number, total: number): string {
  return `${done} of ${total} tasks done`;
}

/** The composer input. */
export function titleInput(page: Page): Locator {
  return page.locator('#new-task-title');
}

/** The composer submit button. */
export function submitButton(page: Page): Locator {
  return page.locator('.controls-add__submit');
}

/** Every rendered task row, in DOM order. */
export function rows(page: Page): Locator {
  return page.locator('li[data-task-id]');
}

/** A single row addressed by its visible title. */
export function rowByTitle(page: Page, title: string): Locator {
  return rows(page).filter({ hasText: title });
}

/** The title element of the row with this title. */
export function titleOf(page: Page, title: string): Locator {
  return rowByTitle(page, title).locator('span').first();
}

/** The checkbox of the row with this title. */
export function checkboxFor(page: Page, title: string): Locator {
  return rowByTitle(page, title).locator('input[type="checkbox"]').first();
}

/** The Remove button of the row with this title. */
export function removeButtonFor(page: Page, title: string): Locator {
  return rowByTitle(page, title).locator('button').first();
}

/** The single footer summary line. */
export function footer(page: Page): Locator {
  return page.locator('[data-testid="task-footer"]');
}

/** The error line (zero or one element). */
export function errorLines(page: Page): Locator {
  return page.locator('[data-testid="error-line"]');
}

/** The empty-state paragraph, whichever lane rendered it (zero or one element). */
export function emptyState(page: Page): Locator {
  return page.locator('[data-testid="task-list-empty"], [data-testid="controls-empty"]');
}

/** A filter control. */
export function filterButton(page: Page, filter: FilterKey): Locator {
  return page.locator(`button[data-filter="${filter}"]`);
}

/** Every rendered task title, in DOM order. */
export async function visibleTitles(page: Page): Promise<string[]> {
  const texts = await page.locator('li[data-task-id] span').allTextContents();
  return texts.map((text: string): string => text.trim());
}

/** The single error message currently on screen, or `null` when there is none. */
export async function currentErrorText(page: Page): Promise<string | null> {
  const lines = errorLines(page);
  if ((await lines.count()) === 0) {
    return null;
  }
  const text = await lines.first().textContent();
  return text === null ? null : text.trim();
}

/** Whether the row's title is really struck through, read from the computed style. */
export async function isStruckThrough(page: Page, title: string): Promise<boolean> {
  const decoration: string = await titleOf(page, title).evaluate(
    (element: Element): string => window.getComputedStyle(element).textDecorationLine,
  );
  return decoration.includes('line-through');
}

/**
 * Read a task list out of an API payload.
 *
 * Accepts the bare array and the `{ tasks: [...] }` envelope, because both are valid
 * shapes for this endpoint; anything else is a contract violation and throws.
 */
export function unwrapTasks(payload: unknown): WireTask[] {
  if (Array.isArray(payload)) {
    return payload as WireTask[];
  }
  if (payload !== null && typeof payload === 'object') {
    const inner: unknown = (payload as { tasks?: unknown }).tasks;
    if (Array.isArray(inner)) {
      return inner as WireTask[];
    }
  }
  throw new Error(
    `Expected a task list from ${TASKS_ENDPOINT}, received: ${JSON.stringify(payload)}`,
  );
}

/** Read the stored list straight from the API. */
export async function readServerTasks(request: APIRequestContext): Promise<WireTask[]> {
  const response = await request.get(TASKS_ENDPOINT);
  expect(response.status(), `GET ${TASKS_ENDPOINT} must answer 200`).toBe(200);
  return unwrapTasks(await response.json());
}

/**
 * Replace the whole server-side list over HTTP and return what the server echoed.
 *
 * The bare array is sent first (the shape the client uses); if the endpoint prefers
 * the `{ tasks }` envelope that shape is sent instead. Exactly one of them must be
 * accepted with a 200 — a rejection of both is a real contract failure.
 */
export async function putServerTasks(
  request: APIRequestContext,
  tasks: readonly WireTask[],
): Promise<WireTask[]> {
  const bare = await request.put(TASKS_ENDPOINT, { data: tasks });
  if (bare.status() === 200) {
    return unwrapTasks(await bare.json());
  }
  const wrapped = await request.put(TASKS_ENDPOINT, { data: { tasks } });
  expect(
    wrapped.status(),
    `PUT ${TASKS_ENDPOINT} must accept the complete list (bare array answered ${bare.status()})`,
  ).toBe(200);
  return unwrapTasks(await wrapped.json());
}

/** Empty the server-side list so a test starts from a known state. */
export async function resetServerTasks(request: APIRequestContext): Promise<void> {
  await putServerTasks(request, []);
  await expect(async () => {
    expect(await readServerTasks(request)).toEqual([]);
  }).toPass({ timeout: 15_000 });
}

/**
 * Wait until the server holds exactly these titles.
 *
 * Compared as sorted sets so a store that re-orders an otherwise-correct list cannot
 * make a persistence assertion flake.
 */
export async function expectServerTitles(
  request: APIRequestContext,
  expected: readonly string[],
): Promise<void> {
  await expect(async () => {
    const stored = await readServerTasks(request);
    const actual = stored.map((task: WireTask): string => task.title).sort();
    expect(actual).toEqual([...expected].sort());
  }).toPass({ timeout: 20_000 });
}

/** Wait until the server records this title with the given completed flag. */
export async function expectServerCompleted(
  request: APIRequestContext,
  title: string,
  completed: boolean,
): Promise<void> {
  await expect(async () => {
    const stored = await readServerTasks(request);
    const match = stored.find((task: WireTask): boolean => task.title === title);
    expect(match, `the server must hold a task titled "${title}"`).toBeDefined();
    expect(match?.completed).toBe(completed);
  }).toPass({ timeout: 20_000 });
}

/** Wait for the load-on-mount `GET /api/tasks` to settle. Never throws. */
function waitForTasksLoad(page: Page): Promise<Response | null> {
  return page
    .waitForResponse(
      (response: Response): boolean =>
        response.url().includes(TASKS_ENDPOINT) && response.request().method() === 'GET',
      { timeout: 25_000 },
    )
    .catch((): null => null);
}

/** Load the app (optionally at an absolute URL) and wait until the load resolved. */
export async function openApp(page: Page, url: string = '/'): Promise<void> {
  const loaded = waitForTasksLoad(page);
  await page.goto(url);
  await loaded;
  await expect(titleInput(page)).toBeVisible();
  await expect(titleInput(page)).toBeEnabled();
}

/** Reload the app and wait until the initial load has resolved. */
export async function reloadApp(page: Page): Promise<void> {
  const loaded = waitForTasksLoad(page);
  await page.reload();
  await loaded;
  await expect(titleInput(page)).toBeVisible();
  await expect(titleInput(page)).toBeEnabled();
}

/**
 * The origin the page is currently served from.
 *
 * Needed for a second browser context: `browser.newContext()` does NOT inherit the
 * config's `baseURL`, so a bare `'/'` would fail to navigate there.
 */
export function originOf(page: Page): string {
  return new URL(page.url()).origin;
}

/**
 * Add a task by typing the title and pressing Enter, then wait until the row is on
 * screen and the composer has been cleared. A short settle keeps `createdAt` stamps
 * distinct so newest-first ordering is deterministic across a reload.
 */
export async function addTask(page: Page, title: string): Promise<void> {
  const input = titleInput(page);
  await input.click();
  await input.fill(title);
  await input.press('Enter');
  await expect(rowByTitle(page, title)).toHaveCount(1);
  await expect(input).toHaveValue('');
  await page.waitForTimeout(80);
}

/** Every key=value pair the page has written into local/session storage. */
export async function storageUsage(page: Page): Promise<StorageUsage> {
  return page.evaluate((): StorageUsage => {
    const readAll = (storage: Storage): string[] => {
      const out: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key === null) continue;
        out.push(`${key}=${storage.getItem(key) ?? ''}`);
      }
      return out;
    };
    const local = readAll(window.localStorage);
    const session = readAll(window.sessionStorage);
    return { local: local.length, session: session.length, entries: [...local, ...session] };
  });
}
