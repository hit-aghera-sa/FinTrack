import { expect, test, type Locator, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  createMember,
  createTask,
  escapeForRegExp,
  getTask,
  isoDay,
  listTasks,
  memberReport,
  uniqueLabel,
  type TaskPayload,
} from '../support/boardApi.js';
import {
  clickButton,
  columnOfTask,
  expectNoReload,
  markNoReload,
  moveTaskViaUi,
  pathOf,
} from '../support/ui.js';

const FEATURE = 'reports-and-priority-acceptance-specs';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

/** One figure of one member's row on the reports table. */
function reportCell(page: Page, field: string, memberId: string): Locator {
  return page.locator(`[data-testid="reports-${field}-${memberId}"]`);
}

test.describe('@feature:reports-and-priority-acceptance-specs reports and task priority', () => {
  test('opens Reports from the board through the top navigation', async ({ page }) => {
    try {
      await open(page, '/');

      const link = page.locator('header a[href="/reports"]').first();
      await expect(link, 'the shell navigation must link the Reports page').toBeVisible();
      await link.click();
      await settle(page);

      expect(pathOf(page), 'the Reports link must land on /reports').toBe('/reports');
      await expect(page.getByText('Reports', { exact: false }).first()).toBeVisible();
      await captureRoute(page, FEATURE, '/reports');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('reports a member with the status breakdown, the overdue count, the total and a bar', async ({
    page,
    request,
  }) => {
    const member = await createMember(request, {
      name: uniqueLabel('Priya Lunch workload'),
      role: 'Engineering Lead',
    });
    const past = isoDay(-6);
    const future = isoDay(21);

    // Two To do (one of them past due), one Doing, and one Done that is long past its due date and
    // therefore NOT overdue.
    await createTask(request, {
      title: uniqueLabel('Alex QA overdue'),
      assigneeId: member.id,
      status: 'todo',
      dueDate: past,
    });
    await createTask(request, {
      title: uniqueLabel('Alex QA planned'),
      assigneeId: member.id,
      status: 'todo',
      dueDate: future,
    });
    await createTask(request, {
      title: uniqueLabel('Alex QA in flight'),
      assigneeId: member.id,
      status: 'doing',
    });
    await createTask(request, {
      title: uniqueLabel('Alex QA shipped'),
      assigneeId: member.id,
      status: 'done',
      dueDate: past,
    });

    const row = await memberReport(request, member.id);
    expect(row.todo).toBe(2);
    expect(row.doing).toBe(1);
    expect(row.done).toBe(1);
    expect(row.overdue, 'only the past-due task that is not Done is overdue').toBe(1);
    expect(row.total).toBe(4);

    try {
      await open(page, '/reports');
      await expect(page.getByText('Reports', { exact: false }).first()).toBeVisible();

      const tableRow = page
        .getByRole('row', { name: new RegExp(escapeForRegExp(member.name)) })
        .first();
      await expect(tableRow, 'the member must have a row in the report').toBeVisible();
      await expect(tableRow).toContainText('Engineering Lead');

      // Every figure on screen is the figure the server computed.
      await expect(reportCell(page, 'todo', member.id)).toHaveText(String(row.todo));
      await expect(reportCell(page, 'doing', member.id)).toHaveText(String(row.doing));
      await expect(reportCell(page, 'done', member.id)).toHaveText(String(row.done));
      await expect(reportCell(page, 'total', member.id)).toHaveText(String(row.total));

      const overdue = reportCell(page, 'overdue', member.id);
      await expect(overdue).toContainText(String(row.overdue));
      await expect(overdue, 'a positive overdue count must be highlighted').toHaveAttribute(
        'data-overdue',
        'yes',
      );

      const bar = reportCell(page, 'bar', member.id);
      await expect(bar, 'the member must get a workload bar').toHaveCount(1);
      const barWidth = await bar.evaluate(
        (element: HTMLElement): number => element.getBoundingClientRect().width,
      );
      expect(barWidth, 'a member who carries work must get a visible bar').toBeGreaterThan(0);

      await captureRoute(page, FEATURE, '/reports');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('GET /api/reports answers with server-computed numbers that match the seeded tasks', async ({
    page,
    request,
  }) => {
    const busy = await createMember(request, {
      name: uniqueLabel('Priya Lunch counted'),
      role: 'Backend Engineer',
    });
    const idle = await createMember(request, {
      name: uniqueLabel('Alex QA idle'),
      role: 'QA Engineer',
    });

    await createTask(request, {
      title: uniqueLabel('Alex QA late'),
      assigneeId: busy.id,
      status: 'doing',
      dueDate: isoDay(-9),
    });
    await createTask(request, {
      title: uniqueLabel('Alex QA finished late'),
      assigneeId: busy.id,
      status: 'done',
      dueDate: isoDay(-9),
    });

    const busyRow = await memberReport(request, busy.id);
    expect(busyRow.memberName).toBe(busy.name);
    expect(busyRow.todo).toBe(0);
    expect(busyRow.doing).toBe(1);
    expect(busyRow.done).toBe(1);
    expect(busyRow.overdue, 'a Done task is never overdue, however old its due date').toBe(1);
    expect(busyRow.total).toBe(2);

    const idleRow = await memberReport(request, idle.id);
    expect(idleRow.todo).toBe(0);
    expect(idleRow.doing).toBe(0);
    expect(idleRow.done).toBe(0);
    expect(idleRow.overdue).toBe(0);
    expect(idleRow.total, 'a member with no tasks is reported with zeros').toBe(0);

    await page.goto('/api/reports');
    await settle(page);
    const payload = await page.content();
    expect(payload).toContain('generatedAt');
    expect(payload).toContain('members');
    expect(payload).toContain('overdue');
    await captureRoute(page, FEATURE, '/api/reports');
  });

  test('a task created with a non-default priority shows that label on its board card', async ({
    page,
    request,
  }) => {
    const title = uniqueLabel('Priya Lunch urgent');

    await open(page, '/tasks/new');
    await expect(page.getByText('Title', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Priority', { exact: false }).first()).toBeVisible();

    await page.getByLabel(/title/i).first().fill(title);
    const prioritySelect = page.getByLabel(/^priority$/i).first();
    await expect(prioritySelect, 'the add-task form must offer a priority').toBeVisible();
    await expect(prioritySelect, 'a new task starts on the default priority').toHaveValue('Medium');
    await prioritySelect.selectOption({ label: 'High' });
    await captureRoute(page, FEATURE, '/tasks/new');

    await clickButton(page, /save task/i);

    await expect
      .poll(
        async (): Promise<string> => {
          const tasks: TaskPayload[] = await listTasks(request);
          const created = tasks.find((task: TaskPayload): boolean => task.title === title);
          return created === undefined ? '' : created.priority;
        },
        { timeout: 10000 },
      )
      .toBe('High');

    await open(page, '/');
    const card = page.getByRole('article', { name: title }).first();
    await expect(card, 'the new task must appear on the board').toBeVisible();

    const badge = card.locator('[data-priority]').first();
    await expect(badge, 'the card must carry the task priority').toHaveAttribute(
      'data-priority',
      'high',
    );
    await expect(badge).toContainText(/high/i);
    const background = await badge.evaluate(
      (element: HTMLElement): string => globalThis.getComputedStyle(element).backgroundColor,
    );
    expect(background, 'the priority label must be coloured').not.toBe('rgba(0, 0, 0, 0)');

    await captureRoute(page, FEATURE, '/');
  });

  test('a priority changed on the task screen survives a reload', async ({ page, request }) => {
    const created = await createTask(request, {
      title: uniqueLabel('Alex QA priority'),
      priority: 'Low',
    });
    expect(created.priority, 'the API must store the priority it was given').toBe('Low');

    await open(page, `/tasks/${created.id}`);
    await expect(page.getByText('Priority', { exact: false }).first()).toBeVisible();

    const select = page.getByLabel(/^priority$/i).first();
    await expect(select, 'the task screen must show the stored priority').toHaveValue('Low');
    await select.selectOption({ label: 'High' });

    await clickButton(page, /save changes/i);

    await expect
      .poll(async (): Promise<string> => (await getTask(request, created.id)).priority, {
        timeout: 10000,
      })
      .toBe('High');

    await page.reload();
    await settle(page);
    await expect(
      page.getByLabel(/^priority$/i).first(),
      'the saved priority must still be shown after a reload',
    ).toHaveValue('High');
    await captureRoute(page, FEATURE, '/tasks/:id');

    // …and the board shows the new level on the card.
    await open(page, '/');
    const card = page.getByRole('article', { name: created.title }).first();
    await expect(card.locator('[data-priority]').first()).toHaveAttribute('data-priority', 'high');
  });

  test('the board columns, a move between them and the team page still work unchanged', async ({
    page,
    request,
  }) => {
    const member = await createMember(request, {
      name: uniqueLabel('Priya Lunch roster'),
      role: 'Delivery Lead',
    });
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA regression'),
      status: 'todo',
    });

    await open(page, '/');
    for (const heading of ['To do', 'Doing', 'Done']) {
      await expect(page.getByText(heading, { exact: false }).first()).toBeVisible();
    }
    await expect(page.getByText(task.title, { exact: false }).first()).toBeVisible();
    expect(await columnOfTask(page, task.title)).toMatch(/to do/i);

    await markNoReload(page);
    await moveTaskViaUi(page, task.title, 'doing');

    await expect
      .poll(async (): Promise<string> => (await columnOfTask(page, task.title)) ?? '', {
        timeout: 10000,
      })
      .toMatch(/doing/i);
    await expectNoReload(page);
    expect((await getTask(request, task.id)).status, 'the move must reach the backend').toBe('doing');
    await captureRoute(page, FEATURE, '/');

    await open(page, '/team');
    await expect(page.getByText('Team', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Name', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Role', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(member.name, { exact: false }).first()).toBeVisible();
    await captureRoute(page, FEATURE, '/team');
  });
});
