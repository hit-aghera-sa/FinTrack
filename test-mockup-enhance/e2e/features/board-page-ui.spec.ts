import { expect, test, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import { createTask, getTask, uniqueLabel } from '../support/boardApi.js';
import { columnOfTask, expectNoReload, markNoReload, moveTaskViaUi } from '../support/ui.js';

const FEATURE = 'board-page-ui';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

test.describe('@feature:board-page-ui the board page', () => {
  test('shows the three columns with each task in its own column', async ({ page, request }) => {
    const todo = await createTask(request, { title: uniqueLabel('Alex QA waiting'), status: 'todo' });
    const done = await createTask(request, { title: uniqueLabel('Priya Lunch shipped'), status: 'done' });

    try {
      await open(page, '/');

      for (const heading of ['To do', 'Doing', 'Done']) {
        await expect(page.getByText(heading, { exact: false }).first()).toBeVisible();
      }

      await expect(page.getByText(todo.title, { exact: false }).first()).toBeVisible();
      await expect(page.getByText(done.title, { exact: false }).first()).toBeVisible();

      expect(await columnOfTask(page, todo.title)).toMatch(/to do/i);
      expect(await columnOfTask(page, done.title)).toMatch(/done/i);

      await captureRoute(page, FEATURE, '/');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('moves a task to another column and re-renders it there without a reload', async ({
    page,
    request,
  }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA moving'), status: 'todo' });

    await page.goto('/');
    await settle(page);
    await expect(page.getByText(task.title, { exact: false }).first()).toBeVisible();
    expect(await columnOfTask(page, task.title)).toMatch(/to do/i);

    await markNoReload(page);
    await moveTaskViaUi(page, task.title, 'doing');

    await expect
      .poll(async (): Promise<string> => (await columnOfTask(page, task.title)) ?? '', { timeout: 10000 })
      .toMatch(/doing/i);

    // The destination column re-rendered in place: the live document was never replaced.
    await expectNoReload(page);

    const stored = await getTask(request, task.id);
    expect(stored.status, 'the move must reach the backend').toBe('doing');
  });

  test('opening a card leads to that task', async ({ page, request }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA opened'), status: 'todo' });

    await page.goto('/');
    await settle(page);
    const link = page.locator(`a[href="/tasks/${task.id}"]`).first();
    const opener = page.getByRole('link', { name: /open|detail|view/i });

    if ((await link.count()) > 0) {
      await link.click();
    } else if ((await opener.count()) > 0) {
      await opener.first().click();
    } else {
      await page.getByText(task.title, { exact: false }).first().click();
    }

    await expect(page.getByText('Task detail', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(task.title, { exact: false }).first()).toBeVisible();
    await captureRoute(page, FEATURE, '/tasks/:id');
  });
});
