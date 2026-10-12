import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  createMember,
  createTask,
  isoDay,
  uniqueLabel,
  type MemberPayload,
  type TaskPayload,
} from '../support/boardApi.js';
import { pathOf } from '../support/ui.js';

const FEATURE = 'my-week-end-to-end-acceptance-specs';

/** The empty-state wording the page shows when the 7-day window holds nothing. */
const EMPTY_TEXT = 'Nothing due this week';

/**
 * The weekday names a day group is labelled with, kept here as a COPY rather
 * than imported from `src/` — a spec may never import the application build.
 */
const WEEKDAY_NAMES: readonly string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** The number of calendar days the page covers, counting today. */
const WINDOW_DAYS = 7;

/** Opens a route of the running app in the browser and waits for it to settle. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

/** `Today`, `Tomorrow`, or the weekday name of the day `offset` days ahead. */
function dayLabelAt(offset: number): string {
  if (offset === 0) {
    return 'Today';
  }
  if (offset === 1) {
    return 'Tomorrow';
  }
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return WEEKDAY_NAMES[date.getDay()] ?? '';
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

/** Every group's label, in the order the page renders them. */
async function groupLabels(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid="my-week-group"]')
    .evaluateAll((nodes: Element[]): string[] =>
      nodes.map((node: Element): string => node.getAttribute('data-group-label') ?? ''),
    );
}

/** The task ids of one group, in the order the group lists them. */
async function taskIdsIn(group: Locator): Promise<string[]> {
  return group
    .locator('[data-testid="my-week-row"]')
    .evaluateAll((rows: Element[]): string[] =>
      rows.map((row: Element): string => row.getAttribute('data-task-id') ?? ''),
    );
}

/** Just the ids this spec seeded, in the order they appear. */
function onlyMine(order: readonly string[], wanted: readonly string[]): string[] {
  return order.filter((id: string): boolean => wanted.includes(id));
}

/** Whether `candidate` appears inside `whole` in the same relative order. */
function isSubsequence(candidate: readonly string[], whole: readonly string[]): boolean {
  let cursor = 0;
  for (const value of candidate) {
    const found = whole.indexOf(value, cursor);
    if (found === -1) {
      return false;
    }
    cursor = found + 1;
  }
  return true;
}

/** The colour the browser actually paints one element's text in. */
function textColourOf(element: Locator): Promise<string> {
  return element.evaluate(
    (node: HTMLElement): string => globalThis.getComputedStyle(node).color,
  );
}

/** The colour the browser actually paints one element's border in. */
function borderColourOf(element: Locator): Promise<string> {
  return element.evaluate(
    (node: HTMLElement): string => globalThis.getComputedStyle(node).borderTopColor,
  );
}

test.describe('@feature:my-week-end-to-end-acceptance-specs the My week screen end to end', () => {
  test('is reached from the top navigation and lists a task with its title, assignee, priority and status', async ({
    page,
    request,
  }) => {
    const member: MemberPayload = await createMember(request, {
      name: uniqueLabel('Priya Lunch week'),
      role: 'Delivery Lead',
    });
    const title = uniqueLabel('Alex QA due tomorrow');
    const task: TaskPayload = await createTask(request, {
      title,
      status: 'todo',
      priority: 'High',
      assigneeId: member.id,
      dueDate: isoDay(1),
    });

    try {
      // THE BOARD — the shell draws the navigation from its page list.
      await open(page, '/');
      const header = page.locator('header').first();
      await expect(header, 'the shell must draw its top navigation').toBeVisible();
      const link = header.locator('a[href="/my-week"]').first();
      await expect(
        link,
        'the top navigation must offer a My week link on every page of the shell',
      ).toBeVisible();
      await expect(link).toHaveText(/my week/i);

      // …and following it opens the page, inside the same shell.
      await link.click();
      await settle(page);

      expect(pathOf(page), 'the My week link must lead to /my-week').toBe('/my-week');
      await expect(page.getByText('My week', { exact: false }).first()).toBeVisible();
      await expect(
        page.getByRole('link', { name: /^\s*board\s*$/i }).first(),
        'the screen must offer a way back to the board',
      ).toBeVisible();
      await expect(page.locator('header').first()).toBeVisible();

      // THE ROW — title, assignee, priority and status, all four on it.
      const row = rowOf(page, task.id);
      await expect(row, 'a task due tomorrow must be listed').toBeVisible();
      await expect(row, 'the row must name the task').toContainText(title);
      await expect(row, 'the row must name the assignee').toContainText(member.name);
      await expect(row, 'the row must show the task status').toContainText('To do');
      await expect(
        row.locator('[data-priority]').first(),
        'the row must show the task priority through the shared badge',
      ).toHaveAttribute('data-priority', 'high');
      await expect(row.locator('[data-priority]').first()).toContainText(/high/i);

      const group = groupOf(page, task.id);
      await expect(group, 'the task must sit under a day heading').toBeVisible();
      await expect(group).toHaveAttribute('data-overdue', 'no');
      await expect(group).toHaveAttribute('data-group-label', 'Tomorrow');
      await expect(group.getByRole('heading').first()).toHaveText('Tomorrow');

      await captureRoute(page, FEATURE, '/my-week');
    } finally {
      // The feature's primary screen is /my-week, which is where this test ends.
      await captureFeature(page, FEATURE);
    }
  });

  test('opens the clicked task\u2019s own detail page at /tasks/:id', async ({ page, request }) => {
    const title = uniqueLabel('Alex QA clicked row');
    const task: TaskPayload = await createTask(request, {
      title,
      status: 'doing',
      priority: 'Medium',
      dueDate: isoDay(2),
    });

    await open(page, '/my-week');

    const row = rowOf(page, task.id);
    await expect(row, 'the task must be listed inside the week').toBeVisible();
    await expect(row).toContainText(title);
    await captureRoute(page, FEATURE, '/my-week');

    await row.click();
    await settle(page);

    expect(pathOf(page), 'a clicked row must land on that task\u2019s detail page').toBe(
      `/tasks/${task.id}`,
    );
    await expect(page.getByText('Task detail', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
    await expect(
      page.locator('header a[href="/my-week"]').first(),
      'the My week entry must be in the navigation on the task page too',
    ).toBeVisible();

    await captureRoute(page, FEATURE, '/tasks/:id');
  });

  test('puts Overdue first, in the danger styling, and says so in words', async ({
    page,
    request,
  }) => {
    const late: TaskPayload = await createTask(request, {
      title: uniqueLabel('Alex QA past due'),
      status: 'todo',
      priority: 'Medium',
      dueDate: isoDay(-4),
    });
    const soon: TaskPayload = await createTask(request, {
      title: uniqueLabel('Alex QA due tomorrow'),
      status: 'todo',
      priority: 'Medium',
      dueDate: isoDay(1),
    });

    await open(page, '/my-week');

    const first = page.locator('[data-testid="my-week-group"]').first();
    await expect(first, 'the overdue work must be the first group').toHaveAttribute(
      'data-overdue',
      'yes',
    );
    await expect(first, 'the group must be named in words, never colour alone').toHaveAttribute(
      'data-group-label',
      'Overdue',
    );
    await expect(first.getByRole('heading').first()).toHaveText('Overdue');
    await expect(rowOf(page, late.id), 'the overdue task must be in that group').toBeVisible();

    const plain = groupOf(page, soon.id);
    await expect(plain, 'a task due inside the week keeps its own day group').toHaveAttribute(
      'data-overdue',
      'no',
    );

    const overdueInk = await textColourOf(first.getByRole('heading').first());
    const plainInk = await textColourOf(plain.getByRole('heading').first());
    expect(
      overdueInk,
      'the Overdue heading must be drawn in the danger token, not the ordinary one',
    ).not.toBe(plainInk);

    const overdueEdge = await borderColourOf(first);
    const plainEdge = await borderColourOf(plain);
    expect(overdueEdge, 'the Overdue group must be outlined in the danger token').not.toBe(
      plainEdge,
    );

    await captureRoute(page, FEATURE, '/my-week');
  });

  test('groups Today, Tomorrow and the weekday-named days in chronological order', async ({
    page,
    request,
  }) => {
    const seeded: TaskPayload[] = [];
    for (const offset of [0, 1, 2, 3]) {
      seeded.push(
        await createTask(request, {
          title: uniqueLabel(`Alex QA day ${String(offset)} brief`),
          status: 'todo',
          priority: 'Medium',
          dueDate: isoDay(offset),
        }),
      );
    }

    await open(page, '/my-week');

    for (const task of seeded) {
      await expect(rowOf(page, task.id), 'every seeded task must be listed').toBeVisible();
    }

    const expectedOrder: string[] = [];
    for (let offset = 0; offset < WINDOW_DAYS; offset += 1) {
      expectedOrder.push(dayLabelAt(offset));
    }

    const rendered = await groupLabels(page);
    const dayGroups = rendered.filter((label: string): boolean => label !== 'Overdue');

    expect(
      rendered.indexOf('Overdue'),
      'Overdue, when present, is always the first group',
    ).toBeLessThan(1);
    expect(dayGroups.slice(0, 2), 'Today then Tomorrow lead the day groups').toEqual([
      'Today',
      'Tomorrow',
    ]);
    expect(
      dayGroups,
      'the day groups must follow the calendar, each labelled Today, Tomorrow or a weekday name',
    ).toEqual(expect.arrayContaining([dayLabelAt(2), dayLabelAt(3)]));
    expect(
      isSubsequence(dayGroups, expectedOrder),
      'the day groups must be in chronological order inside the 7-day window',
    ).toBe(true);
    expect(
      new Set(dayGroups).size,
      'a calendar day must produce at most one group',
    ).toBe(dayGroups.length);

    // A day with no tasks produces no heading: every rendered group holds work.
    const counts = await page
      .locator('[data-testid="my-week-group"]')
      .evaluateAll((nodes: Element[]): number[] =>
        nodes.map(
          (node: Element): number => node.querySelectorAll('[data-testid="my-week-row"]').length,
        ),
      );
    for (const count of counts) {
      expect(count, 'a group with no tasks must not be rendered at all').toBeGreaterThan(0);
    }

    await captureRoute(page, FEATURE, '/my-week');
  });

  test('@clarification:CL-24 a Done task keeps its day group, while an overdue Done task is left out', async ({
    page,
    request,
  }) => {
    const shipped: TaskPayload = await createTask(request, {
      title: uniqueLabel('Priya Lunch shipped soon'),
      status: 'done',
      priority: 'Medium',
      dueDate: isoDay(1),
    });
    const shippedLate: TaskPayload = await createTask(request, {
      title: uniqueLabel('Priya Lunch shipped late'),
      status: 'done',
      priority: 'Medium',
      dueDate: isoDay(-6),
    });

    await open(page, '/my-week');

    const row = rowOf(page, shipped.id);
    await expect(row, 'a Done task due inside the week must still be listed').toBeVisible();
    await expect(row, 'it must carry its Done status badge').toContainText('Done');
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

  test('@clarification:CL-25 orders a day group by priority, then by title', async ({
    page,
    request,
  }) => {
    const tag = uniqueLabel('weekly order brief');
    const due = isoDay(3);

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
    const middling: TaskPayload = await createTask(request, {
      title: `Aardvark ${tag}`,
      status: 'doing',
      priority: 'Medium',
      dueDate: due,
    });
    const lowest: TaskPayload = await createTask(request, {
      title: `Aardvark low ${tag}`,
      status: 'todo',
      priority: 'Low',
      dueDate: due,
    });

    await open(page, '/my-week');

    const group = groupOf(page, alpha.id);
    await expect(group, 'the four tasks must share one day group').toBeVisible();
    await expect(group).toHaveAttribute('data-overdue', 'no');
    for (const task of [zebra, middling, lowest]) {
      await expect(rowOf(page, task.id)).toBeVisible();
    }

    const order = onlyMine(await taskIdsIn(group), [
      alpha.id,
      zebra.id,
      middling.id,
      lowest.id,
    ]);
    expect(
      order,
      'inside a day group: High, then Medium, then Low \u2014 alphabetically by title within a level',
    ).toEqual([alpha.id, zebra.id, middling.id, lowest.id]);

    await captureRoute(page, FEATURE, '/my-week');
  });

  test('@clarification:CL-26 lists the Overdue group oldest due date first', async ({
    page,
    request,
  }) => {
    const tag = uniqueLabel('overdue order brief');

    // The oldest one is the LEAST urgent, so only the due date can explain the order.
    const oldest: TaskPayload = await createTask(request, {
      title: `Alex QA oldest ${tag}`,
      status: 'todo',
      priority: 'Low',
      dueDate: isoDay(-14),
    });
    const middle: TaskPayload = await createTask(request, {
      title: `Alex QA middle ${tag}`,
      status: 'doing',
      priority: 'Medium',
      dueDate: isoDay(-9),
    });
    const newest: TaskPayload = await createTask(request, {
      title: `Alex QA newest ${tag}`,
      status: 'todo',
      priority: 'High',
      dueDate: isoDay(-2),
    });

    await open(page, '/my-week');

    const first = page.locator('[data-testid="my-week-group"]').first();
    await expect(first, 'the overdue work must be the first group').toHaveAttribute(
      'data-overdue',
      'yes',
    );
    for (const task of [oldest, middle, newest]) {
      await expect(rowOf(page, task.id)).toBeVisible();
    }

    const order = onlyMine(await taskIdsIn(first), [oldest.id, middle.id, newest.id]);
    expect(order, 'the most overdue task must come first').toEqual([
      oldest.id,
      middle.id,
      newest.id,
    ]);

    await captureRoute(page, FEATURE, '/my-week');
  });

  test('@clarification:CL-27 leaves out a task that has no due date', async ({ page, request }) => {
    const someday: TaskPayload = await createTask(request, {
      title: uniqueLabel('Alex QA someday brief'),
      status: 'todo',
      priority: 'High',
    });
    const dated: TaskPayload = await createTask(request, {
      title: uniqueLabel('Alex QA dated brief'),
      status: 'todo',
      priority: 'High',
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

  test('says "Nothing due this week" when the 7-day window is empty', async ({ page }) => {
    // The real application is served throughout this suite; the shared board,
    // however, always holds work due inside the window, so the only way to see
    // the page's EMPTY window is to let the app read an empty task list once.
    // Only the board's own GET /api/tasks list is answered here \u2014 the screen,
    // its grouping and its empty state are the shipped ones.
    await page.route('**/api/tasks', async (route: Route): Promise<void> => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    try {
      await open(page, '/my-week');

      await expect(page.getByText('My week', { exact: false }).first()).toBeVisible();
      await expect(
        page.getByText(EMPTY_TEXT, { exact: false }).first(),
        'with nothing overdue and nothing due in the window the page must say so',
      ).toBeVisible();
      expect(
        await page.locator('[data-testid="my-week-group"]').count(),
        'the empty state replaces the groups entirely',
      ).toBe(0);
      await expect(page.locator('[data-testid="my-week-row"]')).toHaveCount(0);
      await expect(
        page.getByRole('link', { name: /^\s*board\s*$/i }).first(),
        'the empty page must still offer the way back to the board',
      ).toBeVisible();
    } finally {
      await page.unroute('**/api/tasks');
    }
  });

  test('leaves the other screens of the shell working, each carrying the My week link', async ({
    page,
    request,
  }) => {
    const task: TaskPayload = await createTask(request, {
      title: uniqueLabel('Alex QA shell check'),
      status: 'todo',
      priority: 'Medium',
      dueDate: isoDay(1),
    });

    // THE BOARD.
    await open(page, '/');
    for (const heading of ['To do', 'Doing', 'Done']) {
      await expect(page.getByText(heading, { exact: false }).first()).toBeVisible();
    }
    await expect(page.locator('header a[href="/my-week"]').first()).toBeVisible();
    await captureRoute(page, FEATURE, '/');

    // THE ADD TASK FORM.
    await open(page, '/tasks/new');
    await expect(page.getByText('Add task', { exact: false }).first()).toBeVisible();
    await expect(page.locator('header a[href="/my-week"]').first()).toBeVisible();
    await captureRoute(page, FEATURE, '/tasks/new');

    // ONE TASK'S DETAIL PAGE \u2014 opened at a real record.
    await open(page, `/tasks/${task.id}`);
    await expect(page.getByText('Task detail', { exact: false }).first()).toBeVisible();
    await expect(page.locator('header a[href="/my-week"]').first()).toBeVisible();
    await captureRoute(page, FEATURE, '/tasks/:id');

    // THE TEAM ROSTER.
    await open(page, '/team');
    await expect(page.getByText('Team', { exact: false }).first()).toBeVisible();
    await expect(page.locator('header a[href="/my-week"]').first()).toBeVisible();
    await captureRoute(page, FEATURE, '/team');

    // THE REPORTS PAGE.
    await open(page, '/reports');
    await expect(page.getByText('Reports', { exact: false }).first()).toBeVisible();
    await expect(page.locator('header a[href="/my-week"]').first()).toBeVisible();
    await captureRoute(page, FEATURE, '/reports');

    // THE REPORT PAYLOAD \u2014 still served by the API, unchanged by this build.
    await open(page, '/api/reports');
    const payload = await page.content();
    for (const token of ['generatedAt', 'members', 'overdue']) {
      expect(payload, `the report payload must still carry "${token}"`).toContain(token);
    }
    await captureRoute(page, FEATURE, '/api/reports');

    // …and back to the page this feature is about.
    await open(page, '/my-week');
    await expect(page.getByText('My week', { exact: false }).first()).toBeVisible();
    await captureRoute(page, FEATURE, '/my-week');
  });
});
