import { expect, test, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  addComment,
  createTask,
  listComments,
  uniqueLabel,
  type CommentPayload,
} from '../support/boardApi.js';

const FEATURE = 'task-comments-http-api';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

test.describe('@feature:task-comments-http-api the task comments HTTP API', () => {
  test('keeps a thread in creation order', async ({ request }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA thread') });

    await addComment(request, task.id, 'First: picked this up.');
    await addComment(request, task.id, 'Second: waiting on copy.');

    const thread: CommentPayload[] = await listComments(request, task.id);
    const bodies = thread.map((comment: CommentPayload): string => comment.body);
    expect(bodies).toEqual(['First: picked this up.', 'Second: waiting on copy.']);
    for (const comment of thread) {
      expect(comment.taskId).toBe(task.id);
      expect(Number.isNaN(Date.parse(comment.createdAt))).toBe(false);
    }
  });

  test('refuses an empty comment', async ({ request }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA empty comment') });

    const blank = await request.post(`/api/tasks/${task.id}/comments`, { data: { body: '   ' } });
    expect(blank.status()).toBe(400);
    const body = (await blank.json()) as { error?: string; message?: string };
    expect(body.error).toBe('invalid_body');
    expect(typeof body.message).toBe('string');

    const missingField = await request.post(`/api/tasks/${task.id}/comments`, { data: {} });
    expect(missingField.status()).toBe(400);

    expect((await listComments(request, task.id)).length).toBe(0);
  });

  test('answers a comment on a task that does not exist with 404', async ({ request }) => {
    const listed = await request.get('/api/tasks/no-such-task-anywhere/comments');
    expect(listed.status()).toBe(404);
    const listedBody = (await listed.json()) as { error?: string };
    expect(listedBody.error).toBe('task_not_found');

    const posted = await request.post('/api/tasks/no-such-task-anywhere/comments', {
      data: { body: 'Nowhere to put this.' },
    });
    expect(posted.status()).toBe(404);
  });

  test('the task screen shows the thread the API holds', async ({ page, request }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA commented') });
    await addComment(request, task.id, 'Visible in the thread.');

    try {
      await open(page, `/tasks/${task.id}`);
      await expect(page.getByText('Visible in the thread.', { exact: false }).first()).toBeVisible();
      await captureRoute(page, FEATURE, '/tasks/:id');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });
});
