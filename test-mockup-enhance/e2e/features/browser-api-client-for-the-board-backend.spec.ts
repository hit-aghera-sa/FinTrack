import { expect, test, type Page, type Request } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import { createTask, uniqueLabel } from '../support/boardApi.js';

const FEATURE = 'browser-api-client-for-the-board-backend';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

test.describe('@feature:browser-api-client-for-the-board-backend the browser API client', () => {
  test('the board screen loads its data through the /api client', async ({ page, request }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA fetched'), status: 'todo' });

    const apiCalls: string[] = [];
    page.on('request', (outgoing: Request): void => {
      const type = outgoing.resourceType();
      if (type === 'fetch' || type === 'xhr') apiCalls.push(outgoing.url());
    });

    try {
      await open(page, '/');
      await expect(page.getByText(task.title, { exact: false }).first()).toBeVisible();
      expect(
        apiCalls.some((url: string): boolean => url.includes('/api/tasks')),
        'the board must read the real backend through /api/tasks',
      ).toBe(true);
      await captureRoute(page, FEATURE, '/');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('@clarification:CL-5 the app only ever talks to its own API', async ({ page, baseURL }) => {
    const dataCalls: string[] = [];
    page.on('request', (outgoing: Request): void => {
      const type = outgoing.resourceType();
      if (type === 'fetch' || type === 'xhr') dataCalls.push(outgoing.url());
    });

    await page.goto('/');
    await settle(page);
    await open(page, '/team');
    await captureRoute(page, FEATURE, '/team');
    await open(page, '/tasks/new');
    await captureRoute(page, FEATURE, '/tasks/new');

    expect(dataCalls.length, 'the screens must read their data from somewhere').toBeGreaterThan(0);
    const origin = new URL(baseURL ?? page.url()).origin;
    for (const url of dataCalls) {
      expect(new URL(url).origin, `${url} must be the app's own origin`).toBe(origin);
      expect(new URL(url).pathname).toMatch(/^\/api\//);
    }
  });

  test('a failed call carries the server status and message', async ({ request }) => {
    const missing = await request.get('/api/tasks/no-such-task-anywhere');
    expect(missing.status()).toBe(404);
    const body = (await missing.json()) as { message?: string; error?: string };
    const text = body.message ?? body.error ?? '';
    expect(typeof text).toBe('string');
    expect(text).not.toBe('');

    const unknownEndpoint = await request.get('/api/nothing-here');
    expect(unknownEndpoint.status()).toBe(404);
    const unknownBody = (await unknownEndpoint.json()) as { error?: string; message?: string };
    const unknownText = unknownBody.error ?? unknownBody.message ?? '';
    expect(unknownText).not.toBe('');
  });
});
