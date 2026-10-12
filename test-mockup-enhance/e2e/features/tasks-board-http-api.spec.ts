import { expect, test, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  createTask,
  getTask,
  listTasks,
  patchTask,
  uniqueLabel,
  type TaskPayload,
} from '../support/boardApi.js';

const FEATURE = 'tasks-board-http-api';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

test.describe('@feature:tasks-board-http-api the tasks and board HTTP API', () => {
  test('lists every task on the board', async ({ request }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA listed') });
    const tasks = await listTasks(request);
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.some((row: TaskPayload): boolean => row.id === task.id)).toBe(true);
  });

  test('refuses a task with no title', async ({ request }) => {
    const empty = await request.post('/api/tasks', { data: {} });
    expect(empty.status()).toBe(400);
    const emptyBody = (await empty.json()) as { message?: string };
    expect(typeof emptyBody.message).toBe('string');
    expect(emptyBody.message ?? '').toMatch(/title/i);

    const blank = await request.post('/api/tasks', { data: { title: '   ' } });
    expect(blank.status(), 'a whitespace-only title is no title').toBe(400);
  });

  test('puts a new task in the To do column by default', async ({ request }) => {
    const created = await createTask(request, { title: uniqueLabel('Alex QA default') });
    expect(created.status).toBe('todo');
    expect(created.assigneeId).toBeNull();
  });

  test('moves a task to another column through PATCH', async ({ request }) => {
    const created = await createTask(request, { title: uniqueLabel('Alex QA moving'), status: 'todo' });

    const moved = await patchTask(request, created.id, { status: 'done' });
    expect(moved.status).toBe('done');
    expect(moved.id).toBe(created.id);
    expect(moved.title).toBe(created.title);

    const reloaded = await getTask(request, created.id);
    expect(reloaded.status, 'the move must be persisted').toBe('done');
  });

  test('answers a task that does not exist with 404', async ({ request }) => {
    const missing = await request.get('/api/tasks/no-such-task-anywhere');
    expect(missing.status()).toBe(404);

    const patched = await request.patch('/api/tasks/no-such-task-anywhere', { data: { status: 'done' } });
    expect(patched.status()).toBe(404);
  });

  test('the board screen reads the task API', async ({ page, request }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA on board'), status: 'doing' });
    try {
      await open(page, '/');
      await expect(page.getByText(task.title, { exact: false }).first()).toBeVisible();
      await captureRoute(page, FEATURE, '/');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });
});
