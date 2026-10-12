import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import { createTask, getTask, uniqueLabel } from '../support/boardApi.js';
import { columnOfTask } from '../support/ui.js';

const FEATURE = 'end-to-end-acceptance-specs-for-task-checklists';

/** The label the panel's add-item submit button carries. */
const ADD_BUTTON = /^add subtask$/i;

/** One checklist item exactly as the mounted checklist API serialises it. */
interface ChecklistItemPayload {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  position: number;
  createdAt: string;
}

/** The problem body every refusal of the checklist API carries. */
interface ProblemPayload {
  error?: string;
  message?: string;
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

/** The panel's own progress figure — a SEPARATE element inside the panel root. */
function panelProgress(page: Page): Locator {
  return panelOf(page).locator('[data-testid="checklist-progress"]').first();
}

/** One task's card on the board, by the title it renders. */
function boardCard(page: Page, title: string): Locator {
  return page.getByRole('article', { name: title }).first();
}

/** One task's checklist, read straight from the mounted API. */
async function readChecklist(
  request: APIRequestContext,
  taskId: string,
): Promise<ChecklistItemPayload[]> {
  const response = await request.get(`/api/tasks/${taskId}/checklist`);
  expect(
    response.status(),
    'the checklist API must answer GET /api/tasks/:taskId/checklist',
  ).toBe(200);
  expect(response.headers()['content-type'] ?? '').toContain('application/json');
  return (await response.json()) as ChecklistItemPayload[];
}

/** Adds an item through the API, so a screen can be opened with items already stored. */
async function postItem(
  request: APIRequestContext,
  taskId: string,
  title: string,
): Promise<ChecklistItemPayload> {
  const response = await request.post(`/api/tasks/${taskId}/checklist`, { data: { title } });
  expect([200, 201], 'POST /api/tasks/:taskId/checklist must create the item').toContain(
    response.status(),
  );
  return (await response.json()) as ChecklistItemPayload;
}

/** Ticks or unticks one item through the API. */
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

/** Adds an item the way a person does: typing the title and pressing Add subtask. */
async function addItemOnScreen(page: Page, title: string): Promise<void> {
  const panel = panelOf(page);
  await expect(panel, 'the task screen must render its subtasks panel').toBeVisible();

  const box = panel.getByRole('textbox', { name: /checklist item/i }).first();
  await expect(box, 'the panel must expose a fillable checklist item field').toBeVisible();
  await expect(box).toHaveAttribute('type', 'text');
  await box.fill(title);
  await expect(box, 'the checklist item field must accept what is typed').toHaveValue(title);

  await panel.getByRole('button', { name: ADD_BUTTON }).first().click();
  await expect(
    panel.getByRole('checkbox', { name: title }),
    'a new subtask must appear in the list straight away',
  ).toBeVisible();
}

test.describe('@feature:end-to-end-acceptance-specs-for-task-checklists task checklists', () => {
  test('adds an item that appears at once, persists it and survives a reload', async ({
    page,
    request,
  }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA checklist run-b7'),
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
      const progress = panelProgress(page);

      // The progress figure is its own element INSIDE the panel root, never the
      // element data-testid="task-checklist" resolves to.
      await expect(progress, 'the panel must show its own done/total figure').toHaveText('0/0');
      await expect(progress).toHaveAttribute('aria-label', '0 of 0 checklist items done');
      expect(
        await panel.locator('[data-testid="checklist-progress"]').count(),
        'the progress element must live inside the subtasks panel',
      ).toBe(1);
      await expect(panel.getByRole('button', { name: ADD_BUTTON }).first()).toBeVisible();

      await addItemOnScreen(page, step);

      // The figure moves with the list.
      await expect(progress).toHaveText('0/1');
      await expect(progress).toHaveAttribute('aria-label', '0 of 1 checklist items done');

      // …and the add really reached the backend.
      await expect
        .poll(
          async (): Promise<string> =>
            (await readChecklist(request, task.id))
              .map((row: ChecklistItemPayload): string => row.title)
              .join(' | '),
          { timeout: 10000 },
        )
        .toContain(step);

      const stored = await readChecklist(request, task.id);
      expect(stored, 'exactly one item must have been stored').toHaveLength(1);
      expect(stored[0]?.taskId).toBe(task.id);
      expect(stored[0]?.done).toBe(false);

      // It is persisted, not only on screen.
      await page.reload();
      await settle(page);
      await expect(
        panelOf(page).getByRole('checkbox', { name: step }),
        'a stored subtask must still be there after a reload',
      ).toBeVisible();
      await expect(panelProgress(page)).toHaveText('0/1');

      await captureRoute(page, FEATURE, '/tasks/:id');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('ticks an item, persisting done and updating the progress figure', async ({
    page,
    request,
  }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Priya Lunch ticked'),
      status: 'todo',
    });
    const first = 'Collect the release notes';
    const second = 'Review with Priya Lunch';
    await postItem(request, task.id, first);
    await postItem(request, task.id, second);

    await open(page, `/tasks/${task.id}`);

    const panel = panelOf(page);
    const progress = panelProgress(page);
    await expect(progress).toHaveText('0/2');

    const checkbox = panel.getByRole('checkbox', { name: first });
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();

    // It re-renders immediately…
    await expect(checkbox, 'ticking an item must re-render it at once').toBeChecked();
    await expect(progress).toHaveText('1/2');
    await expect(progress).toHaveAttribute('aria-label', '1 of 2 checklist items done');

    // …and the tick is persisted.
    await expect
      .poll(
        async (): Promise<boolean> => {
          const rows = await readChecklist(request, task.id);
          return rows.find((row: ChecklistItemPayload): boolean => row.title === first)?.done === true;
        },
        { timeout: 10000 },
      )
      .toBe(true);

    await page.reload();
    await settle(page);
    await expect(
      panelOf(page).getByRole('checkbox', { name: first }),
      'a ticked item must still be ticked after a reload',
    ).toBeChecked();
    await expect(panelProgress(page)).toHaveText('1/2');

    // Unticking it again is saved too.
    await panelOf(page).getByRole('checkbox', { name: first }).click();
    await expect(panelProgress(page)).toHaveText('0/2');
    await expect
      .poll(
        async (): Promise<boolean> => {
          const rows = await readChecklist(request, task.id);
          return rows.every((row: ChecklistItemPayload): boolean => !row.done);
        },
        { timeout: 10000 },
      )
      .toBe(true);

    await captureRoute(page, FEATURE, '/tasks/:id');
  });

  test('Delete removes an item from the list and from the store', async ({ page, request }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA deleted step'),
      status: 'todo',
    });
    const doomed = 'Remove this step';
    const kept = 'Keep this step';
    await postItem(request, task.id, doomed);
    await postItem(request, task.id, kept);

    await open(page, `/tasks/${task.id}`);

    const panel = panelOf(page);
    await expect(panelProgress(page)).toHaveText('0/2');

    const rows = panel.locator('[data-testid="checklist-item"]');
    await expect(rows).toHaveCount(2);

    const first = rows.first();
    await expect(first.getByRole('checkbox', { name: doomed })).toBeVisible();
    await first.getByRole('button', { name: /^delete$/i }).click();

    await expect(
      panel.getByRole('checkbox', { name: doomed }),
      'a deleted item must disappear from the list',
    ).toHaveCount(0);
    await expect(panel.getByRole('checkbox', { name: kept })).toBeVisible();
    await expect(panelProgress(page)).toHaveText('0/1');

    await expect
      .poll(
        async (): Promise<string> =>
          (await readChecklist(request, task.id))
            .map((row: ChecklistItemPayload): string => row.title)
            .join(' | '),
        { timeout: 10000 },
      )
      .toBe(kept);

    await page.reload();
    await settle(page);
    await expect(panelOf(page).getByRole('checkbox', { name: doomed })).toHaveCount(0);
    await expect(panelProgress(page)).toHaveText('0/1');

    await captureRoute(page, FEATURE, '/tasks/:id');
  });

  test('the matching board card shows the same done/total progress text', async ({
    page,
    request,
  }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Priya Lunch progress'),
      status: 'todo',
    });

    const titles = [
      'Collect the release notes',
      'Review with Priya Lunch',
      'Book the walkthrough room',
      'Write the summary',
      'Send it round',
    ];
    const created: ChecklistItemPayload[] = [];
    for (const title of titles) {
      created.push(await postItem(request, task.id, title));
    }
    const firstId = created[0]?.id ?? '';
    const secondId = created[1]?.id ?? '';
    expect(firstId, 'the first item must have an id').not.toBe('');
    expect(secondId, 'the second item must have an id').not.toBe('');
    await setItemDone(request, task.id, firstId, true);
    await setItemDone(request, task.id, secondId, true);

    // The panel reads 2/5…
    await open(page, `/tasks/${task.id}`);
    await expect(panelProgress(page)).toHaveText('2/5');
    await expect(panelProgress(page)).toHaveAttribute(
      'aria-label',
      '2 of 5 checklist items done',
    );
    await captureRoute(page, FEATURE, '/tasks/:id');

    // …and so does the task's own card on the board.
    await open(page, '/');
    const card = boardCard(page, task.title);
    await expect(card, 'the task must be on the board').toBeVisible();
    await expect(
      card.locator('[data-testid="checklist-progress"]').first(),
      'the card must show the same done/total figure as the panel',
    ).toHaveText('2/5');
    await captureRoute(page, FEATURE, '/');

    // A change on the task screen is reflected on the board card.
    await open(page, `/tasks/${task.id}`);
    await panelOf(page).getByRole('checkbox', { name: titles[2] ?? '' }).click();
    await expect(panelProgress(page)).toHaveText('3/5');
    await expect
      .poll(
        async (): Promise<number> =>
          (await readChecklist(request, task.id)).filter(
            (row: ChecklistItemPayload): boolean => row.done,
          ).length,
        { timeout: 10000 },
      )
      .toBe(3);

    await open(page, '/');
    await expect(
      boardCard(page, task.title).locator('[data-testid="checklist-progress"]').first(),
      'the board card must follow the checklist',
    ).toHaveText('3/5');
  });

  test('answers a JSON 404 for the checklist of a task that does not exist', async ({
    request,
  }) => {
    const response = await request.get('/api/tasks/no-such-task-anywhere/checklist');

    expect(response.status(), 'an unknown task must be a 404, never an empty list').toBe(404);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ProblemPayload;
    const said = body.message ?? body.error ?? '';
    expect(said, 'the refusal must carry a message a screen can show').not.toBe('');
    expect(
      said.toLowerCase(),
      'the refusal must say that the task does not exist',
    ).toMatch(/not found|does not exist|no such|unknown|missing/);

    const posted = await request.post('/api/tasks/no-such-task-anywhere/checklist', {
      data: { title: 'Nowhere to put this' },
    });
    expect(posted.status(), 'adding to an unknown task\u2019s checklist must be a 404').toBe(404);
    expect(posted.headers()['content-type'] ?? '').toContain('application/json');
  });

  test('refuses a checklist item with an empty title with 400 and stores nothing', async ({
    request,
  }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA blank title'),
      status: 'todo',
    });

    const blank = await request.post(`/api/tasks/${task.id}/checklist`, { data: { title: '   ' } });
    expect(blank.status(), 'a whitespace-only title is no title').toBe(400);
    expect(blank.headers()['content-type'] ?? '').toContain('application/json');
    const blankBody = (await blank.json()) as ProblemPayload;
    const blankSaid = blankBody.message ?? blankBody.error ?? '';
    expect(blankSaid, 'the refusal must carry a message a screen can show').not.toBe('');
    expect(blankSaid.toLowerCase()).toContain('title');

    const missing = await request.post(`/api/tasks/${task.id}/checklist`, { data: {} });
    expect(missing.status(), 'a payload with no title at all must be refused').toBe(400);

    expect(
      await readChecklist(request, task.id),
      'a refused create must store nothing',
    ).toHaveLength(0);
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

    const checkbox = panelOf(page).getByRole('checkbox', { name: step });
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await expect(panelProgress(page)).toHaveText('1/1');

    await expect
      .poll(
        async (): Promise<boolean> => {
          const rows = await readChecklist(request, task.id);
          return rows.length > 0 && rows.every((row: ChecklistItemPayload): boolean => row.done);
        },
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
    expect(stored.map((row: ChecklistItemPayload): string => row.title)).toEqual(ordered);
    expect(stored.map((row: ChecklistItemPayload): number => row.position)).toEqual([1, 2, 3]);

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
      title: uniqueLabel('Alex QA immediate delete'),
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

    await expect(panelProgress(page)).toHaveText('0/0');
    await captureRoute(page, FEATURE, '/tasks/:id');
  });
});
