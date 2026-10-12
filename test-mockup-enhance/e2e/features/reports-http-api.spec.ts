import { expect, test } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  createMember,
  createTask,
  fetchReport,
  isoDay,
  memberReport,
  uniqueLabel,
  type MemberReportPayload,
} from '../support/boardApi.js';

const FEATURE = 'reports-http-api';

test.describe('@feature:reports-http-api the reports HTTP API', () => {
  test('computes each member\u2019s breakdown and total from the stored tasks', async ({ request }) => {
    const member = await createMember(request, {
      name: uniqueLabel('Priya Lunch api'),
      role: 'Product Designer',
    });

    await createTask(request, { title: uniqueLabel('Alex QA one'), assigneeId: member.id, status: 'todo' });
    await createTask(request, { title: uniqueLabel('Alex QA two'), assigneeId: member.id, status: 'todo' });
    await createTask(request, { title: uniqueLabel('Alex QA three'), assigneeId: member.id, status: 'doing' });
    await createTask(request, { title: uniqueLabel('Alex QA four'), assigneeId: member.id, status: 'done' });
    // Assigned to nobody: counted for nobody.
    await createTask(request, { title: uniqueLabel('Alex QA nobody'), status: 'todo', dueDate: isoDay(-4) });

    const row = await memberReport(request, member.id);
    expect(row.memberName).toBe(member.name);
    expect(row.role).toBe('Product Designer');
    expect(row.todo).toBe(2);
    expect(row.doing).toBe(1);
    expect(row.done).toBe(1);
    expect(row.total, 'the total is every task assigned to the member').toBe(4);
    expect(row.todo + row.doing + row.done).toBe(row.total);
  });

  test('counts a task as overdue only when it is past due and not Done', async ({ request }) => {
    const member = await createMember(request, {
      name: uniqueLabel('Priya Lunch overdue'),
      role: 'Engineering Lead',
    });

    await createTask(request, {
      title: uniqueLabel('Alex QA past due'),
      assigneeId: member.id,
      status: 'todo',
      dueDate: isoDay(-3),
    });
    await createTask(request, {
      title: uniqueLabel('Alex QA due today'),
      assigneeId: member.id,
      status: 'doing',
      dueDate: isoDay(0),
    });
    await createTask(request, {
      title: uniqueLabel('Alex QA no due date'),
      assigneeId: member.id,
      status: 'todo',
    });
    await createTask(request, {
      title: uniqueLabel('Alex QA done late'),
      assigneeId: member.id,
      status: 'done',
      dueDate: isoDay(-30),
    });

    const row = await memberReport(request, member.id);
    expect(row.overdue, 'only the past-due task that is not Done counts').toBe(1);
    expect(row.total).toBe(4);
    expect(row.overdue).toBeLessThanOrEqual(row.todo + row.doing);
  });

  test('covers the whole roster, including a member with no tasks at all', async ({ request }) => {
    const joiner = await createMember(request, {
      name: uniqueLabel('Alex QA joiner'),
      role: 'QA Engineer',
    });

    const report = await fetchReport(request);
    expect(Number.isNaN(Date.parse(report.generatedAt)), 'generatedAt must be a timestamp').toBe(
      false,
    );
    expect(Array.isArray(report.members)).toBe(true);

    for (const row of report.members) {
      expect(typeof row.memberId).toBe('string');
      expect(typeof row.memberName).toBe('string');
      expect(typeof row.role).toBe('string');
      for (const count of [row.todo, row.doing, row.done, row.overdue, row.total]) {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }

    const row = report.members.find(
      (entry: MemberReportPayload): boolean => entry.memberId === joiner.id,
    );
    expect(row, 'a member with no tasks still appears in the report').toBeDefined();
    expect(row?.todo).toBe(0);
    expect(row?.doing).toBe(0);
    expect(row?.done).toBe(0);
    expect(row?.overdue).toBe(0);
    expect(row?.total).toBe(0);
  });

  test('serves the report payload the Reports screen reads', async ({ page, request }) => {
    const member = await createMember(request, {
      name: uniqueLabel('Priya Lunch payload'),
      role: 'Delivery Lead',
    });
    await createTask(request, {
      title: uniqueLabel('Alex QA payload'),
      assigneeId: member.id,
      status: 'doing',
    });

    await page.goto('/api/reports');
    await settle(page);
    const payload = await page.content();
    expect(payload).toContain('generatedAt');
    expect(payload).toContain('members');
    expect(payload).toContain('overdue');
    await captureRoute(page, FEATURE, '/api/reports');

    try {
      await page.goto('/reports');
      await settle(page);
      await expect(page.getByText('Reports', { exact: false }).first()).toBeVisible();
      await expect(page.getByText(member.name, { exact: false }).first()).toBeVisible();
      await captureRoute(page, FEATURE, '/reports');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });
});
