import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import { uniqueLabel } from '../support/boardApi.js';
import { clickButton } from '../support/ui.js';

const FEATURE = 'priority-selection-in-add-task-form-and-task-detail';

/** The task payload as the API returns it, including the stored priority. */
interface StoredTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
}

/** What a create sends. */
interface NewStoredTask {
  title: string;
  status?: string;
  priority?: string;
}

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

async function createStoredTask(
  request: APIRequestContext,
  payload: NewStoredTask,
): Promise<StoredTask> {
  const response = await request.post('/api/tasks', { data: payload });
  expect([200, 201], 'POST /api/tasks must create the task').toContain(response.status());
  return (await response.json()) as StoredTask;
}

async function readStoredTask(request: APIRequestContext, id: string): Promise<StoredTask> {
  const response = await request.get(`/api/tasks/${id}`);
  expect(response.status(), 'GET /api/tasks/:id must answer 200').toBe(200);
  return (await response.json()) as StoredTask;
}

async function priorityOfTitle(request: APIRequestContext, title: string): Promise<string> {
  const response = await request.get('/api/tasks');
  expect(response.status(), 'GET /api/tasks must answer 200').toBe(200);
  const tasks = (await response.json()) as StoredTask[];
  const found = tasks.find((task: StoredTask): boolean => task.title === title);
  return found === undefined ? '' : (found.priority ?? '');
}

test.describe('@feature:priority-selection-in-add-task-form-and-task-detail priority selection', () => {
  test('the add task form offers Priority with Medium chosen by default', async ({ page }) => {
    try {
      await open(page, '/tasks/new');

      await expect(page.getByText('Priority', { exact: false }).first()).toBeVisible();
      const priority = page.getByLabel(/^priority$/i).first();
      await expect(priority, 'the add task form must offer a priority field').toBeVisible();
      await expect(priority, 'a new task starts on Medium').toHaveValue('Medium');

      const options = (await priority.locator('option').allTextContents()).map(
        (option: string): string => option.trim(),
      );
      expect(options).toEqual(['Low', 'Medium', 'High']);

      await captureRoute(page, FEATURE, '/tasks/new');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('saving the form unchanged stores the default Medium priority', async ({ page, request }) => {
    const title = uniqueLabel('Alex QA default priority');

    await open(page, '/tasks/new');
    await page.getByLabel(/title/i).first().fill(title);
    await clickButton(page, /save task|create task|add task|save/i);

    await expect
      .poll(async (): Promise<string> => priorityOfTitle(request, title), { timeout: 10000 })
      .toBe('Medium');
  });

  test('a chosen priority is sent with the create', async ({ page, request }) => {
    const title = uniqueLabel('Priya Lunch urgent');

    await open(page, '/tasks/new');
    await page.getByLabel(/title/i).first().fill(title);
    await page.getByLabel(/^priority$/i).first().selectOption({ label: 'High' });
    await clickButton(page, /save task|create task|add task|save/i);

    await expect
      .poll(async (): Promise<string> => priorityOfTitle(request, title), { timeout: 10000 })
      .toBe('High');
  });

  test('the task detail screen shows the stored priority and saves a change to it', async ({
    page,
    request,
  }) => {
    const created = await createStoredTask(request, {
      title: uniqueLabel('Alex QA priority edit'),
      priority: 'High',
    });

    try {
      await open(page, `/tasks/${created.id}`);

      await expect(page.getByText('Priority', { exact: false }).first()).toBeVisible();
      const priority = page.getByLabel(/^priority$/i).first();
      await expect(priority, 'the detail screen must show the stored priority').toHaveValue('High');

      await priority.selectOption({ label: 'Low' });
      await clickButton(page, /save/i);

      await expect
        .poll(
          async (): Promise<string> => {
            const stored = await readStoredTask(request, created.id);
            return stored.priority ?? '';
          },
          { timeout: 10000 },
        )
        .toBe('Low');

      await captureRoute(page, FEATURE, '/tasks/:id');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });
});
