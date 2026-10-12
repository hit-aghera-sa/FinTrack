import { expect, test, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import { createTask, isoDay, uniqueLabel, type TaskPayload } from '../support/boardApi.js';
import { pathOf } from '../support/ui.js';

const FEATURE = 'app-shell-navigation-and-server-composition-root';

/** Every address the shell's top navigation links, in the order it lists them. */
const NAV_HREFS: readonly string[] = ['/', '/my-week', '/tasks/new', '/team', '/reports'];

/** Opens a route of the running app in the browser and waits for the screen to settle. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

test.describe('@feature:app-shell-navigation-and-server-composition-root the app shell navigation and the server composition root', () => {
  test('offers My week in the top navigation beside the existing links, and it opens the page', async ({
    page,
  }) => {
    try {
      await open(page, '/');

      // The board is still the home screen, exactly as it was.
      for (const heading of ['To do', 'Doing', 'Done']) {
        await expect(page.getByText(heading, { exact: false }).first()).toBeVisible();
      }

      const header = page.locator('header').first();
      await expect(header, 'the shell must draw its top navigation').toBeVisible();
      for (const href of NAV_HREFS) {
        await expect(
          header.locator(`a[href="${href}"]`).first(),
          `the top navigation must link ${href}`,
        ).toBeVisible();
      }
      await expect(
        header.getByRole('link', { name: /^\s*board\s*$/i }).first(),
        'the Board entry must still be there',
      ).toBeVisible();
      await expect(
        header.getByRole('link', { name: /^\s*my week\s*$/i }).first(),
        'the top navigation must offer a My week entry',
      ).toBeVisible();

      await captureRoute(page, FEATURE, '/');

      // …and following it lands on the new page, inside the same shell.
      await header.locator('a[href="/my-week"]').first().click();
      await settle(page);

      expect(pathOf(page), 'the My week entry must lead to /my-week').toBe('/my-week');
      await expect(page.getByText('My week', { exact: false }).first()).toBeVisible();
      await expect(
        page.getByRole('link', { name: /^\s*board\s*$/i }).first(),
        'the My week screen must offer a way back to the board',
      ).toBeVisible();
      await expect(page.locator('header').first()).toBeVisible();

      await captureRoute(page, FEATURE, '/my-week');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('a task clicked on My week opens that task\u2019s detail page', async ({ page, request }) => {
    const title = uniqueLabel('Alex QA week row');
    const task: TaskPayload = await createTask(request, {
      title,
      status: 'todo',
      priority: 'High',
      dueDate: isoDay(1),
    });

    await open(page, '/my-week');

    const row = page
      .locator(`[data-testid="my-week-row"][data-task-id="${task.id}"]`)
      .first();
    await expect(row, 'a task due inside the week must be listed').toBeVisible();
    await expect(row).toContainText(title);
    await captureRoute(page, FEATURE, '/my-week');

    await row.click();
    await settle(page);

    expect(pathOf(page), 'a clicked task must open its own detail page').toBe(`/tasks/${task.id}`);
    await expect(page.getByText('Task detail', { exact: false }).first()).toBeVisible();
    await expect(
      page.locator('header a[href="/my-week"]').first(),
      'the My week entry must be in the navigation on the task page too',
    ).toBeVisible();

    await captureRoute(page, FEATURE, '/tasks/:id');
  });

  test('leaves every other screen and its wiring untouched', async ({ page, request }) => {
    const task: TaskPayload = await createTask(request, {
      title: uniqueLabel('Alex QA shell regression'),
      status: 'todo',
      dueDate: isoDay(1),
    });

    // The add task form.
    await open(page, '/tasks/new');
    for (const text of ['Add task', 'Title', 'Status', 'Priority', 'Labels']) {
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    }
    await expect(page.locator('header a[href="/my-week"]').first()).toBeVisible();
    await captureRoute(page, FEATURE, '/tasks/new');

    // The team roster.
    await open(page, '/team');
    for (const text of ['Team', 'Name', 'Role']) {
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    }
    await expect(page.locator('header a[href="/my-week"]').first()).toBeVisible();
    await captureRoute(page, FEATURE, '/team');

    // One task's activity timeline.
    await open(page, `/tasks/${task.id}/activity`);
    await expect(page.getByText('Activity', { exact: false }).first()).toBeVisible();
    await captureRoute(page, FEATURE, '/tasks/:id/activity');
  });

  test('the composition root answers the API before it serves the client shell', async ({
    request,
  }) => {
    const task: TaskPayload = await createTask(request, {
      title: uniqueLabel('Alex QA mounted week'),
      status: 'todo',
      dueDate: isoDay(1),
    });

    const tasks = await request.get('/api/tasks');
    expect(tasks.status(), 'the task router must be mounted under /api').toBe(200);
    expect(tasks.headers()['content-type'] ?? '').toContain('application/json');

    const members = await request.get('/api/members');
    expect(members.status(), 'the team router must be mounted under /api').toBe(200);
    expect(members.headers()['content-type'] ?? '').toContain('application/json');

    const unknown = await request.get('/api/not-a-real-shell-endpoint');
    expect(unknown.status(), 'an unknown /api address must be a JSON 404').toBe(404);
    expect(unknown.headers()['content-type'] ?? '').toContain('application/json');

    for (const route of [
      '/',
      '/my-week',
      '/tasks/new',
      `/tasks/${task.id}`,
      `/tasks/${task.id}/activity`,
      '/team',
      '/reports',
    ]) {
      const served = await request.get(route);
      expect(served.status(), `${route} must be served by the client shell`).toBe(200);
      expect(served.headers()['content-type'] ?? '').toContain('text/html');
    }
  });
});
