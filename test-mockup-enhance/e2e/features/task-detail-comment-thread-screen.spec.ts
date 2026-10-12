import { expect, test, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  createMember,
  createTask,
  getTask,
  listComments,
  uniqueLabel,
  type CommentPayload,
} from '../support/boardApi.js';
import { clickButton, columnOfTask, pathOf } from '../support/ui.js';

const FEATURE = 'task-detail-comment-thread-screen';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

test.describe('@feature:task-detail-comment-thread-screen the task detail and comment thread', () => {
  test('edits all five fields on the task screen', async ({ page, request }) => {
    const memberName = uniqueLabel('Priya Lunch');
    const member = await createMember(request, { name: memberName, role: 'Product Designer' });
    const task = await createTask(request, { title: uniqueLabel('Alex QA detail'), status: 'todo' });
    const newTitle = uniqueLabel('Alex QA rewritten');

    try {
      await open(page, `/tasks/${task.id}`);
      await expect(page.getByText('Task detail', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Back to board', { exact: false }).first()).toBeVisible();

      await page.getByLabel(/title/i).first().fill(newTitle);
      await page.getByLabel(/description/i).first().fill('Edited on the task screen.');
      await page.getByLabel(/assignee/i).first().selectOption({ label: memberName });
      await page.getByLabel(/due/i).first().fill('2026-04-09');
      await page.getByLabel(/^status$/i).first().selectOption({ label: 'Done' });

      await clickButton(page, /save/i);

      await expect
        .poll(
          async (): Promise<string> => {
            const stored = await getTask(request, task.id);
            return stored.title;
          },
          { timeout: 10000 },
        )
        .toBe(newTitle);

      const saved = await getTask(request, task.id);
      expect(saved.title).toBe(newTitle);
      expect(saved.description).toBe('Edited on the task screen.');
      expect(saved.assigneeId).toBe(member.id);
      expect(saved.dueDate ?? '').toContain('2026-04-09');
      expect(saved.status).toBe('done');
    } finally {
      // The feature's primary screen is the task detail screen, which is where this test stays.
      await captureRoute(page, FEATURE, '/tasks/:id');
      await captureFeature(page, FEATURE);
    }
  });

  test('goes back to the board with the status change reflected', async ({ page, request }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA returning'), status: 'todo' });

    await page.goto(`/tasks/${task.id}`);
    await settle(page);
    await page.getByLabel(/^status$/i).first().selectOption({ label: 'Done' });
    await clickButton(page, /save/i);

    await expect
      .poll(async (): Promise<string> => (await getTask(request, task.id)).status, { timeout: 10000 })
      .toBe('done');

    await clickButton(page, /back to board/i);
    await settle(page);
    expect(pathOf(page)).toBe('/');
    await expect(page.getByText(task.title, { exact: false }).first()).toBeVisible();
    expect(await columnOfTask(page, task.title)).toMatch(/done/i);
    await captureRoute(page, FEATURE, '/');
  });

  test('adds a comment to the thread', async ({ page, request }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA discussed') });

    await page.goto(`/tasks/${task.id}`);
    await settle(page);

    const labelled = page.getByLabel(/comment/i);
    const box = (await labelled.count()) > 0 ? labelled.first() : page.locator('textarea').last();
    await expect(box, 'the task screen must offer a comment box').toBeVisible();
    await box.fill('Checked with the designer, ready to go.');

    await clickButton(page, /post|add comment|send|comment/i);

    await expect(
      page.getByText('Checked with the designer, ready to go.', { exact: false }).first(),
    ).toBeVisible();

    // The thread is read back from the API; the page shows the comment the moment the POST answers, so
    // the read is retried briefly rather than raced against the write.
    await expect
      .poll(async () => (await listComments(request, task.id)).map((comment: CommentPayload): string => comment.body), {
        timeout: 10_000,
      })
      .toContain('Checked with the designer, ready to go.');
  });

  test('says so when the task does not exist', async ({ page }) => {
    await page.goto('/tasks/no-such-task-anywhere');
    await settle(page);
    await expect(
      page.getByText(/not found|could not be found|no such task|does not exist/i).first(),
      'an unknown task must render a clear not-found state',
    ).toBeVisible();
    await captureRoute(page, FEATURE, '/tasks/no-such-task-anywhere');
  });
});
