import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import { createTask, getTask, uniqueLabel } from '../support/boardApi.js';
import { columnOfTask } from '../support/ui.js';

const FEATURE = 'composition-root-wiring-for-the-checklist-feature';

/** The label the panel's add-item submit button carries. */
const ADD_BUTTON = /^add subtask$/i;

/** One checklist item exactly as the mounted router serialises it. */
interface ChecklistRowPayload {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  position: number;
  createdAt: string;
}

/** One task's progress counts, as the board's summary endpoint serialises them. */
interface ChecklistProgressPayload {
  taskId: string;
  done: number;
  total: number;
}

/** Opens a route of the running app in the browser and waits for it to settle. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

/** The subtasks panel of the task detail screen. */
function panelOf(page: Page): Locator {
  return page.locator('[data-testid="task-checklist"]').first();
}

/** One task's checklist, read straight from the mounted API. */
async function readChecklist(
  request: APIRequestContext,
  taskId: string,
): Promise<ChecklistRowPayload[]> {
  const response = await request.get(`/api/tasks/${taskId}/checklist`);
  expect(
    response.status(),
    'the mounted checklist router must answer GET /api/tasks/:taskId/checklist',
  ).toBe(200);
  expect(response.headers()['content-type'] ?? '').toContain('application/json');
  return (await response.json()) as ChecklistRowPayload[];
}

/** Adds an item through the mounted API, so a screen can be opened with items already there. */
async function postItem(
  request: APIRequestContext,
  taskId: string,
  title: string,
): Promise<ChecklistRowPayload> {
  const response = await request.post(`/api/tasks/${taskId}/checklist`, { data: { title } });
  expect(
    [200, 201],
    'POST /api/tasks/:taskId/checklist must create the item',
  ).toContain(response.status());
  return (await response.json()) as ChecklistRowPayload;
}

/** Ticks or unticks one item through the mounted API. */
async function setItemDone(
  request: APIRequestContext,
  taskId: string,
  itemId: string,
  done: boolean,
): Promise<void> {
  const response = await request.patch(`/api/tasks/${taskId}/checklist/${itemId}`, {
    data: { done },
  });
  expect(response.status(), 'PATCH must save the item\u2019s done flag').toBe(200);
}

/** Adds an item the way a person does, on the screen. */
async function addItemOnScreen(page: Page, title: string): Promise<void> {
  const panel = panelOf(page);
  await expect(panel, 'the task screen must render its subtasks panel').toBeVisible();

  const box = panel.getByRole('textbox', { name: /checklist item/i }).first();
  await expect(box, 'the subtasks panel must offer a field to name an item').toBeVisible();
  await box.fill(title);

  await panel.getByRole('button', { name: ADD_BUTTON }).first().click();
  await expect(
    panel.getByRole('checkbox', { name: title }),
    'a new subtask must appear in the list straight away',
  ).toBeVisible();
}

test.describe('@feature:composition-root-wiring-for-the-checklist-feature the checklist feature in the assembled app', () => {
  test('adds a checklist item on the task screen and persists it through the mounted API', async ({
    page,
    request,
  }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA checklist'),
      status: 'todo',
    });
    const step = 'Draft the Alex QA brief';

    try {
      await open(page, `/tasks/${task.id}`);

      await expect(page.getByText('Task detail', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Back to board', { exact: false }).first()).toBeVisible();
      await expect(
        page.getByText('Subtasks', { exact: false }).first(),
        'the task screen must show its Subtasks panel',
      ).toBeVisible();

      const panel = panelOf(page);
      await expect(panel.getByRole('button', { name: ADD_BUTTON }).first()).toBeVisible();
      await expect(
        panel.locator('[data-testid="checklist-progress"]').first(),
        'the panel must show its own progress figure',
      ).toHaveText('0/0');

      await addItemOnScreen(page, step);

      // …and it really reached the backend through the mounted router.
      await expect
        .poll(
          async (): Promise<string> =>
            (await readChecklist(request, task.id))
              .map((row: ChecklistRowPayload): string => row.title)
              .join(' | '),
          { timeout: 10000 },
        )
        .toContain(step);

      const stored = await readChecklist(request, task.id);
      expect(stored, 'exactly one item must have been stored').toHaveLength(1);
      expect(stored[0]?.taskId).toBe(task.id);
      expect(stored[0]?.done).toBe(false);

      await expect(
        panel.locator('[data-testid="checklist-progress"]').first(),
      ).toHaveText('0/1');

      // It survives a reload, because it is stored and not only on screen.
      await page.reload();
      await settle(page);
      await expect(
        panelOf(page).getByRole('checkbox', { name: step }),
        'a stored subtask must still be there after a reload',
      ).toBeVisible();

      await captureRoute(page, FEATURE, '/tasks/:id');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('shows a task\u2019s checklist progress on its board card', async ({ page, request }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Priya Lunch progress'),
      status: 'todo',
    });

    const first = await postItem(request, task.id, 'Collect the release notes');
    await postItem(request, task.id, 'Review with Priya Lunch');
    await setItemDone(request, task.id, first.id, true);

    // The board reads the counts from the mounted summary endpoint.
    const summary = await request.get('/api/checklist/summary');
    expect(
      summary.status(),
      'the mounted checklist router must answer GET /api/checklist/summary',
    ).toBe(200);
    const counts = (await summary.json()) as ChecklistProgressPayload[];
    const row = counts.find(
      (entry: ChecklistProgressPayload): boolean => entry.taskId === task.id,
    );
    expect(row, 'the summary must report the task that has a checklist').toBeDefined();
    expect(row?.done).toBe(1);
    expect(row?.total).toBe(2);

    await open(page, '/');

    const card = page.getByRole('article', { name: task.title }).first();
    await expect(card, 'the task must be on the board').toBeVisible();
    await expect(
      card.locator('[data-testid="checklist-progress"]').first(),
      'the card must show its own done/total checklist badge',
    ).toHaveText('1/2');

    await captureRoute(page, FEATURE, '/');
  });

  test('@clarification:CL-17 ticking every checklist item never moves the task', async ({
    page,
    request,
  }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA independent'),
      status: 'todo',
    });
    const step = 'Finish the last step';

    await open(page, `/tasks/${task.id}`);
    await addItemOnScreen(page, step);

    const panel = panelOf(page);
    const checkbox = panel.getByRole('checkbox', { name: step });
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect(checkbox, 'ticking an item must re-render it at once').toBeChecked();

    await expect
      .poll(
        async (): Promise<boolean> =>
          (await readChecklist(request, task.id)).every(
            (item: ChecklistRowPayload): boolean => item.done,
          ),
        { timeout: 10000 },
      )
      .toBe(true);

    // The whole checklist is done — and the task has not moved.
    const stored = await getTask(request, task.id);
    expect(
      stored.status,
      'checklist completion is independent: it must never change the task status',
    ).toBe('todo');

    await expect(
      page.locator('[data-testid="task-detail-status"]').first(),
      'the task screen must still show the status it had',
    ).toContainText('To do');

    await captureRoute(page, FEATURE, '/tasks/:id');

    await open(page, '/');
    expect(
      await columnOfTask(page, task.title),
      'the task must stay in the column it was in',
    ).toMatch(/to do/i);
    await captureRoute(page, FEATURE, '/');
  });

  test('@clarification:CL-18 lists items in creation order with no reordering controls', async ({
    page,
    request,
  }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA ordered'),
      status: 'todo',
    });

    const ordered = ['Write the outline', 'Draft the copy', 'Send for review'];
    for (const title of ordered) {
      await postItem(request, task.id, title);
    }

    const stored = await readChecklist(request, task.id);
    expect(stored.map((item: ChecklistRowPayload): string => item.title)).toEqual(ordered);
    expect(stored.map((item: ChecklistRowPayload): number => item.position)).toEqual([1, 2, 3]);

    await open(page, `/tasks/${task.id}`);

    const panel = panelOf(page);
    const rows = panel.locator('[data-testid="checklist-item"]');
    await expect(rows).toHaveCount(3);

    const rendered = await rows.allInnerTexts();
    for (let index = 0; index < ordered.length; index += 1) {
      expect(
        rendered[index] ?? '',
        'the items must be listed in the order they were created',
      ).toContain(ordered[index] ?? '');
    }

    expect(
      await panel.getByRole('button', { name: /move|reorder|^up$|^down$|drag/i }).count(),
      'there must be no reordering controls on a checklist',
    ).toBe(0);

    await captureRoute(page, FEATURE, '/tasks/:id');
  });

  test('@clarification:CL-19 a checklist item\u2019s title cannot be edited', async ({
    page,
    request,
  }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Priya Lunch fixed title'),
      status: 'todo',
    });
    const step = 'Confirm the room booking';
    await postItem(request, task.id, step);

    await open(page, `/tasks/${task.id}`);

    const panel = panelOf(page);
    await expect(panel.getByRole('checkbox', { name: step })).toBeVisible();

    expect(
      await panel.getByRole('textbox').count(),
      'the only text box in the panel is the add-item field',
    ).toBe(1);
    expect(
      await panel.getByRole('button', { name: /edit|rename/i }).count(),
      'a stored checklist item offers no way to edit its title',
    ).toBe(0);

    // The actions a stored item does offer: tick / untick, and delete.
    const row = panel.locator('[data-testid="checklist-item"]').first();
    await expect(row.getByRole('checkbox')).toBeVisible();
    await expect(row.getByRole('button', { name: /^delete$/i })).toBeVisible();

    await captureRoute(page, FEATURE, '/tasks/:id');
  });

  test('@clarification:CL-20 Delete removes the item at once, with no confirmation', async ({
    page,
    request,
  }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA deleted step'),
      status: 'todo',
    });
    const step = 'Remove this step';
    await postItem(request, task.id, step);

    await open(page, `/tasks/${task.id}`);

    const panel = panelOf(page);
    const row = panel.locator('[data-testid="checklist-item"]').first();
    await expect(row.getByRole('checkbox', { name: step })).toBeVisible();

    await row.getByRole('button', { name: /^delete$/i }).click();

    expect(
      await page.locator('[role="alertdialog"]').count(),
      'deleting a checklist item must not ask for confirmation',
    ).toBe(0);
    expect(
      await page.locator('[role="dialog"]').count(),
      'deleting a checklist item must not open a dialog',
    ).toBe(0);

    await expect(
      panel.getByRole('checkbox', { name: step }),
      'the item must disappear straight away',
    ).toHaveCount(0);

    await expect
      .poll(async (): Promise<number> => (await readChecklist(request, task.id)).length, {
        timeout: 10000,
      })
      .toBe(0);

    await captureRoute(page, FEATURE, '/tasks/:id');
  });

  test('the composition root answers the checklist API before it serves the client shell', async ({
    request,
  }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA mounted checklist'),
      status: 'todo',
    });

    const items = await request.get(`/api/tasks/${task.id}/checklist`);
    expect(items.status(), 'the checklist router must be mounted under /api').toBe(200);
    expect(items.headers()['content-type'] ?? '').toContain('application/json');

    const created = await request.post(`/api/tasks/${task.id}/checklist`, {
      data: { title: 'Reach the real API' },
    });
    expect(
      [200, 201],
      'a write must reach the API, never the single-page fallback',
    ).toContain(created.status());
    expect(created.headers()['content-type'] ?? '').toContain('application/json');

    const summary = await request.get('/api/checklist/summary');
    expect(summary.status(), '/api/checklist/summary must be mounted').toBe(200);
    expect(summary.headers()['content-type'] ?? '').toContain('application/json');

    const blank = await request.post(`/api/tasks/${task.id}/checklist`, { data: { title: '  ' } });
    expect(blank.status(), 'a blank title must be refused').toBe(400);

    const missingTask = await request.get('/api/tasks/no-such-task-anywhere/checklist');
    expect(missingTask.status(), 'an unknown task must be a JSON 404').toBe(404);
    expect(missingTask.headers()['content-type'] ?? '').toContain('application/json');

    const unknown = await request.get('/api/not-a-real-checklist-endpoint');
    expect(unknown.status(), 'an unknown /api address must be a JSON 404').toBe(404);
    expect(unknown.headers()['content-type'] ?? '').toContain('application/json');

    for (const route of ['/', '/tasks/new', `/tasks/${task.id}`]) {
      const served = await request.get(route);
      expect(served.status(), `${route} must be served by the client shell`).toBe(200);
      expect(served.headers()['content-type'] ?? '').toContain('text/html');
    }
  });
});
