import { expect, test, type Locator, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  createMember,
  createTask,
  escapeForRegExp,
  fetchReport,
  isoDay,
  memberReport,
  uniqueLabel,
  type MemberReportPayload,
} from '../support/boardApi.js';

const FEATURE = 'reports-page-ui';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

function reportCell(page: Page, field: string, memberId: string): Locator {
  return page.locator(`[data-testid="reports-${field}-${memberId}"]`);
}

/** The width the screen drew for one member's bar, as the CSS length it set. */
async function barWidth(page: Page, memberId: string): Promise<string> {
  const bar = reportCell(page, 'bar', memberId);
  await expect(bar, 'every member row must draw a bar').toHaveCount(1);
  return bar.evaluate((element: HTMLElement): string => element.style.width);
}

function percentOf(width: string): number {
  const parsed = Number.parseFloat(width.replace('%', ''));
  return Number.isFinite(parsed) ? parsed : -1;
}

test.describe('@feature:reports-page-ui the reports page', () => {
  test('shows the server figures per member, highlights overdue work and draws a bar', async ({
    page,
    request,
  }) => {
    const heavy = await createMember(request, {
      name: uniqueLabel('Priya Lunch heavy'),
      role: 'Engineering Lead',
    });
    const light = await createMember(request, {
      name: uniqueLabel('Alex QA light'),
      role: 'QA Engineer',
    });

    for (const status of ['todo', 'doing', 'done'] as const) {
      await createTask(request, {
        title: uniqueLabel(`Priya Lunch ${status}`),
        assigneeId: heavy.id,
        status,
      });
    }
    await createTask(request, {
      title: uniqueLabel('Priya Lunch late'),
      assigneeId: heavy.id,
      status: 'todo',
      dueDate: isoDay(-5),
    });
    await createTask(request, {
      title: uniqueLabel('Alex QA single'),
      assigneeId: light.id,
      status: 'todo',
    });

    const heavyRow = await memberReport(request, heavy.id);
    const lightRow = await memberReport(request, light.id);
    expect(heavyRow.total).toBeGreaterThan(lightRow.total);
    expect(heavyRow.overdue).toBe(1);

    try {
      await open(page, '/reports');

      await expect(page.getByText('Reports', { exact: false }).first()).toBeVisible();
      for (const header of ['Member', 'Role', 'To do', 'Doing', 'Done', 'Overdue', 'Total']) {
        await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
      }

      const row = page.getByRole('row', { name: new RegExp(escapeForRegExp(heavy.name)) }).first();
      await expect(row).toBeVisible();
      await expect(row).toContainText('Engineering Lead');

      await expect(reportCell(page, 'todo', heavy.id)).toHaveText(String(heavyRow.todo));
      await expect(reportCell(page, 'doing', heavy.id)).toHaveText(String(heavyRow.doing));
      await expect(reportCell(page, 'done', heavy.id)).toHaveText(String(heavyRow.done));
      await expect(reportCell(page, 'total', heavy.id)).toHaveText(String(heavyRow.total));

      const overdue = reportCell(page, 'overdue', heavy.id);
      await expect(overdue).toContainText(String(heavyRow.overdue));
      await expect(overdue).toHaveAttribute('data-overdue', 'yes');
      await expect(
        overdue,
        'the highlight must be paired with wording, never colour alone',
      ).toContainText(/overdue/i);

      const calm = reportCell(page, 'overdue', light.id);
      await expect(calm).toHaveAttribute('data-overdue', 'no');

      // The bars are drawn against the largest total in the report.
      const report = await fetchReport(request);
      const largest = report.members.reduce(
        (running: number, entry: MemberReportPayload): number =>
          entry.total > running ? entry.total : running,
        0,
      );
      expect(largest).toBeGreaterThan(0);
      const busiest = report.members.find(
        (entry: MemberReportPayload): boolean => entry.total === largest,
      );
      expect(busiest).toBeDefined();
      if (busiest === undefined) {
        throw new Error('The report named no busiest member.');
      }
      expect(percentOf(await barWidth(page, busiest.memberId))).toBe(100);

      const heavyWidth = percentOf(await barWidth(page, heavy.id));
      const lightWidth = percentOf(await barWidth(page, light.id));
      expect(lightWidth).toBeGreaterThan(0);
      expect(heavyWidth, 'more work must not draw a narrower bar').toBeGreaterThanOrEqual(
        lightWidth,
      );

      await captureRoute(page, FEATURE, '/reports');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('lists a member with no tasks with zero counts and no bar', async ({ page, request }) => {
    const joiner = await createMember(request, {
      name: uniqueLabel('Alex QA newcomer'),
      role: 'Product Designer',
    });

    await open(page, '/reports');

    const row = page.getByRole('row', { name: new RegExp(escapeForRegExp(joiner.name)) }).first();
    await expect(row, 'a member with no tasks still gets a row').toBeVisible();
    await expect(reportCell(page, 'todo', joiner.id)).toHaveText('0');
    await expect(reportCell(page, 'doing', joiner.id)).toHaveText('0');
    await expect(reportCell(page, 'done', joiner.id)).toHaveText('0');
    await expect(reportCell(page, 'total', joiner.id)).toHaveText('0');
    await expect(reportCell(page, 'overdue', joiner.id)).toHaveAttribute('data-overdue', 'no');
    expect(percentOf(await barWidth(page, joiner.id))).toBe(0);

    await captureRoute(page, FEATURE, '/reports');
  });
});
