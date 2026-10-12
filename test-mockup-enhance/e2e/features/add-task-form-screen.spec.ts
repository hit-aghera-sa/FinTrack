import { expect, test, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import { listTasks, uniqueLabel, type TaskPayload } from '../support/boardApi.js';
import { clickButton, columnOfTask, pathOf } from '../support/ui.js';

const FEATURE = 'add-task-form-screen';
const SUBMIT = /save task|create task|add task|save|create/i;

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

test.describe('@feature:add-task-form-screen the add task form', () => {
  test('shows the add-task form with its title and status fields', async ({ page }) => {
    try {
      await open(page, '/tasks/new');
      await expect(page.getByText('Add task', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Title', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Status', { exact: false }).first()).toBeVisible();
      await expect(page.getByLabel(/title/i).first()).toBeVisible();
      await expect(page.getByLabel(/^status$/i).first()).toBeVisible();
      await captureRoute(page, FEATURE, '/tasks/new');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('refuses to create a task with no title and says so on the field', async ({ page }) => {
    await page.goto('/tasks/new');
    await settle(page);

    await clickButton(page, SUBMIT);

    // The form stayed put: nothing was created.
    expect(pathOf(page), 'an invalid form must not navigate away').toBe('/tasks/new');

    const titleField = page.getByLabel(/title/i).first();
    const flagged = await titleField.evaluate((element: HTMLElement): boolean => {
      const input = element as HTMLInputElement;
      if (input.getAttribute('aria-invalid') === 'true') return true;
      return typeof input.checkValidity === 'function' && !input.checkValidity();
    });
    const messages = await page.locator('[role="alert"], .field-error, .notice').count();

    expect(
      flagged || messages > 0,
      'the form must flag the missing title instead of silently doing nothing',
    ).toBe(true);
  });

  test('creates a task straight into the chosen column', async ({ page, request }) => {
    const title = uniqueLabel('Alex QA created');

    await page.goto('/tasks/new');
    await settle(page);
    await page.getByLabel(/title/i).first().fill(title);
    await page.getByLabel(/^status$/i).first().selectOption({ label: 'Doing' });
    await clickButton(page, SUBMIT);

    await expect
      .poll(
        async (): Promise<string> => {
          const tasks: TaskPayload[] = await listTasks(request);
          const created = tasks.find((task: TaskPayload): boolean => task.title === title);
          return created === undefined ? '' : created.status;
        },
        { timeout: 10000 },
      )
      .toBe('doing');

    await open(page, '/');
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
    expect(await columnOfTask(page, title)).toMatch(/doing/i);
    await captureRoute(page, FEATURE, '/');
  });
});
