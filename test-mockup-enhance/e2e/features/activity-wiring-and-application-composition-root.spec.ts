import { expect, test, type APIRequestContext, type Page, type Request } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import { addComment, createTask, patchTask, uniqueLabel } from '../support/boardApi.js';
import { pathOf } from '../support/ui.js';

const FEATURE = 'activity-wiring-and-application-composition-root';

/**
 * One entry of a task's activity feed, read defensively: the suite asserts that entries are
 * RECORDED and SERVED, never the exact field names of a payload another lane owns.
 */
interface ActivityEntryPayload {
  id?: string;
  taskId?: string;
  createdAt?: string;
}

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

/** The entries of an activity payload: a bare array, or an array inside the envelope it came in. */
function entriesOf(body: unknown): ActivityEntryPayload[] {
  if (Array.isArray(body)) {
    return body as ActivityEntryPayload[];
  }
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    for (const key of ['entries', 'activity', 'activities', 'items', 'events']) {
      const value: unknown = record[key];
      if (Array.isArray(value)) {
        return value as ActivityEntryPayload[];
      }
    }
  }
  return [];
}

/** The activity feed the mounted router serves for one task. */
async function readActivity(
  request: APIRequestContext,
  taskId: string,
): Promise<ActivityEntryPayload[]> {
  const response = await request.get(`/api/tasks/${taskId}/activity`);
  expect(
    response.status(),
    'the mounted activity router must answer GET /api/tasks/:id/activity',
  ).toBe(200);
  expect(response.headers()['content-type'] ?? '').toContain('application/json');
  return entriesOf(await response.json());
}

/** How many activity entries a task carries right now. */
async function activityCount(request: APIRequestContext, taskId: string): Promise<number> {
  return (await readActivity(request, taskId)).length;
}

test.describe('@feature:activity-wiring-and-application-composition-root activity wiring and the composition root', () => {
  test('the task screen links to its Activity timeline, and the timeline route renders it', async ({
    page,
    request,
  }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA activity'),
      status: 'todo',
    });

    try {
      // THE TASK SCREEN — /tasks/:id, which gains the Activity link.
      await open(page, `/tasks/${task.id}`);
      await expect(page.getByText('Task detail', { exact: false }).first()).toBeVisible();
      await expect(
        page.getByText('Activity', { exact: false }).first(),
        'the task screen must offer an Activity entry',
      ).toBeVisible();

      const link = page.getByRole('link', { name: /^\s*activity\s*$/i }).first();
      await expect(link, 'the Activity entry must be a real link').toBeVisible();
      const href = (await link.getAttribute('href')) ?? '';
      expect(href, 'the Activity link must address this task\u2019s timeline').toBe(
        `/tasks/${task.id}/activity`,
      );

      await captureRoute(page, FEATURE, '/tasks/:id');

      // …and following it lands on the timeline, in the same shell.
      await link.click();
      await settle(page);
      expect(pathOf(page), 'the Activity link must lead to the task\u2019s timeline').toBe(
        `/tasks/${task.id}/activity`,
      );
      await expect(
        page.getByText('Activity', { exact: false }).first(),
        'the timeline route must render its Activity screen',
      ).toBeVisible();
      await expect(page.locator('header').first()).toBeVisible();

      await captureRoute(page, FEATURE, '/tasks/:id/activity');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('the timeline screen reads the mounted activity API on this app\u2019s own origin', async ({
    page,
    request,
  }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Priya Lunch activity feed'),
      status: 'todo',
    });
    await patchTask(request, task.id, { status: 'doing' });

    const dataCalls: string[] = [];
    page.on('request', (outgoing: Request): void => {
      const type = outgoing.resourceType();
      if (type === 'fetch' || type === 'xhr') {
        dataCalls.push(outgoing.url());
      }
    });

    await open(page, `/tasks/${task.id}/activity`);
    await expect(page.getByText('Activity', { exact: false }).first()).toBeVisible();

    expect(
      dataCalls.some((url: string): boolean => url.includes('/activity')),
      'the timeline must read its entries from the backend over /api/tasks/:id/activity',
    ).toBe(true);

    const origin = new URL(page.url()).origin;
    for (const url of dataCalls) {
      expect(new URL(url).origin, `${url} must be the app\u2019s own origin`).toBe(origin);
      expect(new URL(url).pathname).toMatch(/^\/api\//);
    }

    await captureRoute(page, FEATURE, '/tasks/:id/activity');
  });

  test('a create, an edit and a comment each leave activity behind, and the mutation still wins', async ({
    request,
  }) => {
    const title = uniqueLabel('Alex QA recorded');
    const created = await createTask(request, { title, status: 'todo' });
    expect(created.title, 'the create\u2019s own result is authoritative').toBe(title);

    await expect
      .poll(async (): Promise<number> => activityCount(request, created.id), { timeout: 10000 })
      .toBeGreaterThanOrEqual(1);

    const afterCreate = await activityCount(request, created.id);

    const moved = await patchTask(request, created.id, { status: 'doing', priority: 'High' });
    expect(moved.status, 'the edit\u2019s own result is authoritative').toBe('doing');
    expect(moved.priority).toBe('High');

    await expect
      .poll(async (): Promise<number> => activityCount(request, created.id), { timeout: 10000 })
      .toBeGreaterThan(afterCreate);

    const afterPatch = await activityCount(request, created.id);

    const comment = await addComment(request, created.id, 'Recorded on the activity feed.');
    expect(comment.body, 'the comment\u2019s own result is authoritative').toBe(
      'Recorded on the activity feed.',
    );

    await expect
      .poll(async (): Promise<number> => activityCount(request, created.id), { timeout: 10000 })
      .toBeGreaterThan(afterPatch);

    for (const entry of await readActivity(request, created.id)) {
      if (entry.taskId !== undefined) {
        expect(entry.taskId, 'every entry belongs to the task it was recorded against').toBe(
          created.id,
        );
      }
      if (entry.createdAt !== undefined) {
        expect(Number.isNaN(Date.parse(entry.createdAt))).toBe(false);
      }
    }
  });

  test('a failed mutation records nothing', async ({ request }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA refused'), status: 'todo' });

    await expect
      .poll(async (): Promise<number> => activityCount(request, task.id), { timeout: 10000 })
      .toBeGreaterThanOrEqual(1);

    const before = await activityCount(request, task.id);

    const refused = await request.patch(`/api/tasks/${task.id}`, { data: { status: 'archived' } });
    expect(refused.status(), 'an unknown status must be refused').toBe(400);

    // The refusal changed nothing, so it recorded nothing either.
    expect(await activityCount(request, task.id)).toBe(before);
  });

  test('the composition root answers the API before it serves the client shell', async ({
    request,
  }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA mounted'), status: 'todo' });

    const feed = await request.get(`/api/tasks/${task.id}/activity`);
    expect(feed.status(), 'the activity router must be mounted under /api').toBe(200);
    expect(feed.headers()['content-type'] ?? '').toContain('application/json');

    const unknown = await request.get('/api/not-a-real-activity-endpoint');
    expect(unknown.status(), 'an unknown /api address must be a JSON 404').toBe(404);
    expect(unknown.headers()['content-type'] ?? '').toContain('application/json');

    for (const route of ['/', '/tasks/new', `/tasks/${task.id}`, `/tasks/${task.id}/activity`]) {
      const served = await request.get(route);
      expect(served.status(), `${route} must be served by the client shell`).toBe(200);
      expect(served.headers()['content-type'] ?? '').toContain('text/html');
    }
  });
});
