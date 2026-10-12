import { expect, test, type Locator, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import { createTask, isoDay, uniqueLabel, type TaskPayload } from '../support/boardApi.js';
import { pathOf } from '../support/ui.js';

const FEATURE = 'my-week-page-screen';

/** Opens a route of the running app in the browser and waits for the screen to settle. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

/** One task's row on the My week screen. */
function rowOf(page: Page, taskId: string): Locator {
  return page.locator(`[data-testid="my-week-row"][data-task-id="${taskId}"]`).first();
}

/** The group a given task is listed in. */
function groupOf(page: Page, taskId: string): Locator {
  return page
    .locator('[data-testid="my-week-group"]')
    .filter({ has: page.locator(`[data-task-id="${taskId}"]`) })
    .first();
}

/** The task ids of one group, in the order the group lists them. */
async function taskIdsIn(group: Locator): Promise<string[]> {
  return group
    .locator('[data-testid="my-week-row"]')
    .evaluateAll((rows: Element[]): string[] =>
      rows.map((row: Element): string => row.getAttribute('data-task-id') ?? ''),
    );
}

/** Just the ids we seeded, in the order they appear. */
function onlyMine(order: readonly string[], wanted: readonly string[]): string[] {
  return order.filter((id: string): boolean => wanted.includes(id));
}

test.describe('@feature:my-week-page-screen the My week screen', () => {
  test('lists what is due this week grouped by day, and opens a task that is clicked', async ({
    page,
    request,
  }) => {
    const title = uniqueLabel('Alex QA this week');
    const task: TaskPayload = await createTask(request, {
      title,
      status: 'todo',
      priority: 'High',
      dueDate: isoDay(1),
    });

    try {
      await open(page, '/my-week');

      await expect(page.getByText('My week', { exact: false }).first()).toBeVisible();
      await expect(
        page.getByRole('link', { name: /^\s*board\s*$/i }).first(),
        'the screen must offer a way back to the board',
      ).toBeVisible();

      const row = rowOf(page, task.id);
      await expect(row, 'a task due tomorrow must be listed').toBeVisible();
      await expect(row, 'the row must name the task').toContainText(title);
      await expect(row, 'the row must say who it is assigned to').toContainText('Unassigned');
      await expect(row, 'the row must show the task status').toContainText('To do');
      await expect(
        row.locator('[data-priority]').first(),
        'the row must show the task priority',
      ).toHaveAttribute('data-priority', 'high');

      const group = groupOf(page, task.id);
      await expect(group, 'the task must be listed under a day heading').toBeVisible();
      await expect(group).toHaveAttribute('data-overdue', 'no');
      await expect(group.getByRole('heading').first()).toBeVisible();

      await captureRoute(page, FEATURE, '/my-week');
    } finally {
      await captureFeature(page, FEATURE);
    }

    await rowOf(page, task.id).click();
    await settle(page);
    expect(pathOf(page), 'a clicked row must open that task').toBe(`/tasks/${task.id}`);
    await expect(page.getByText('Task detail', { exact: false }).first()).toBeVisible();
    await captureRoute(page, FEATURE, '/tasks/:id');
  });

  test('@clarification:CL-24 a Done task stays in its day group, but an overdue Done task is left out', async ({
    page,
    request,
  }) => {
    const shipped: TaskPayload = await createTask(request, {
      title: uniqueLabel('Priya Lunch shipped soon'),
      status: 'done',
      dueDate: isoDay(1),
    });
    const shippedLate: TaskPayload = await createTask(request, {
      title: uniqueLabel('Priya Lunch shipped late'),
      status: 'done',
      dueDate: isoDay(-5),
    });

    await open(page, '/my-week');

    const row = rowOf(page, shipped.id);
    await expect(row, 'a Done task due inside the week must still be listed').toBeVisible();
    await expect(row, 'the row must carry its Done status badge').toContainText('Done');
    await expect(
      groupOf(page, shipped.id),
      'it belongs to its day group, never to Overdue',
    ).toHaveAttribute('data-overdue', 'no');

    await expect(
      page.locator(`[data-task-id="${shippedLate.id}"]`),
      'an overdue task that is Done is excluded entirely',
    ).toHaveCount(0);
    await expect(page.getByText(shippedLate.title, { exact: false })).toHaveCount(0);

    await captureRoute(page, FEATURE, '/my-week');
  });

  test('@clarification:CL-25 sorts a day group by priority, then by title', async ({
    page,
    request,
  }) => {
    const tag = uniqueLabel('weekly brief');
    const due = isoDay(2);

    const alpha: TaskPayload = await createTask(request, {
      title: `Alpha ${tag}`,
      status: 'todo',
      priority: 'High',
      dueDate: due,
    });
    const zebra: TaskPayload = await createTask(request, {
      title: `Zebra ${tag}`,
      status: 'todo',
      priority: 'High',
      dueDate: due,
    });
    const mid: TaskPayload = await createTask(request, {
      title: `Mid ${tag}`,
      status: 'doing',
      priority: 'Low',
      dueDate: due,
    });

    await open(page, '/my-week');

    const group = groupOf(page, alpha.id);
    await expect(group, 'the three tasks must share one day group').toBeVisible();
    await expect(group).toHaveAttribute('data-overdue', 'no');
    await expect(rowOf(page, zebra.id)).toBeVisible();
    await expect(rowOf(page, mid.id)).toBeVisible();

    const order = onlyMine(await taskIdsIn(group), [alpha.id, zebra.id, mid.id]);
    expect(
      order,
      'inside a day group: High before Low, then alphabetically by title',
    ).toEqual([alpha.id, zebra.id, mid.id]);

    await captureRoute(page, FEATURE, '/my-week');
  });

  test('@clarification:CL-26 puts Overdue first, oldest due date first', async ({
    page,
    request,
  }) => {
    const tag = uniqueLabel('overdue brief');

    // The oldest one is the LEAST urgent, so only the due date can explain the order.
    const oldest: TaskPayload = await createTask(request, {
      title: `Alex QA oldest ${tag}`,
      status: 'todo',
      priority: 'Low',
      dueDate: isoDay(-11),
    });
    const newer: TaskPayload = await createTask(request, {
      title: `Alex QA newer ${tag}`,
      status: 'doing',
      priority: 'High',
      dueDate: isoDay(-2),
    });

    await open(page, '/my-week');

    const first = page.locator('[data-testid="my-week-group"]').first();
    await expect(first, 'the overdue work must be the first group').toHaveAttribute(
      'data-overdue',
      'yes',
    );
    await expect(first, 'the group must say it is overdue in words').toHaveAttribute(
      'data-group-label',
      'Overdue',
    );

    await expect(rowOf(page, oldest.id)).toBeVisible();
    await expect(rowOf(page, newer.id)).toBeVisible();

    const order = onlyMine(await taskIdsIn(first), [oldest.id, newer.id]);
    expect(order, 'the most overdue task must come first').toEqual([oldest.id, newer.id]);

    await captureRoute(page, FEATURE, '/my-week');
  });

  test('@clarification:CL-27 leaves out a task with no due date', async ({ page, request }) => {
    const someday: TaskPayload = await createTask(request, {
      title: uniqueLabel('Alex QA someday brief'),
      status: 'todo',
    });
    const dated: TaskPayload = await createTask(request, {
      title: uniqueLabel('Alex QA dated brief'),
      status: 'todo',
      dueDate: isoDay(1),
    });

    await open(page, '/my-week');

    await expect(rowOf(page, dated.id), 'a dated task must be listed').toBeVisible();
    await expect(
      page.locator(`[data-task-id="${someday.id}"]`),
      'a task with no due date is never part of My week',
    ).toHaveCount(0);
    await expect(page.getByText(someday.title, { exact: false })).toHaveCount(0);

    await captureRoute(page, FEATURE, '/my-week');
  });
});
