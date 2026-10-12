import { expect, test, type Locator, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  createMember,
  createTask,
  escapeForRegExp,
  listMembers,
  patchTask,
  uniqueLabel,
  type MemberPayload,
} from '../support/boardApi.js';
import { assigneeOptions, clickButton } from '../support/ui.js';

const FEATURE = 'team-roster-page-ui';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

/** The roster row for one member. */
function rowFor(page: Page, name: string): Locator {
  return page.getByRole('row', { name: new RegExp(escapeForRegExp(name)) }).first();
}

test.describe('@feature:team-roster-page-ui the team roster page', () => {
  test('lists the roster with names, roles and live open-task counts', async ({ page, request }) => {
    const name = uniqueLabel('Priya Lunch');
    const member = await createMember(request, { name, role: 'Engineering Lead' });
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA assigned'),
      assigneeId: member.id,
      status: 'doing',
    });

    try {
      await open(page, '/team');
      await expect(page.getByText('Team', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Name', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Role', { exact: false }).first()).toBeVisible();

      const row = rowFor(page, name);
      await expect(row).toBeVisible();
      await expect(row).toContainText('Engineering Lead');
      await expect(row, 'the roster must show the live open-task count').toContainText('1');

      await patchTask(request, task.id, { status: 'done' });
      await page.reload();
      await settle(page);
      await expect(rowFor(page, name)).toContainText('0');

      await captureRoute(page, FEATURE, '/team');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('adds a member from the roster form and offers them as an assignee straight away', async ({
    page,
    request,
  }) => {
    const name = uniqueLabel('Priya Lunch joining');

    await page.goto('/team');
    await settle(page);
    await page.getByLabel(/^name$/i).first().fill(name);
    await page.getByLabel(/^role$/i).first().fill('QA Engineer');
    await clickButton(page, /add member|add/i);

    await expect(rowFor(page, name)).toBeVisible();
    await expect(rowFor(page, name)).toContainText('QA Engineer');

    await expect
      .poll(
        async (): Promise<boolean> => {
          const roster = await listMembers(request);
          return roster.some((row: MemberPayload): boolean => row.name === name);
        },
        { timeout: 10000 },
      )
      .toBe(true);

    // Available as an assignee immediately, with no extra step.
    await open(page, '/tasks/new');
    expect((await assigneeOptions(page)).join(' | ')).toContain(name);
    await captureRoute(page, FEATURE, '/tasks/new');
  });

  test('@clarification:CL-3 a role is a descriptive label and changes nothing a member can do', async ({
    page,
    request,
  }) => {
    const manager = await createMember(request, {
      name: uniqueLabel('Priya Lunch manager'),
      role: 'Project Manager',
    });
    const developer = await createMember(request, {
      name: uniqueLabel('Alex QA developer'),
      role: 'Backend Engineer',
    });

    await page.goto('/team');
    await settle(page);

    // Both roles are shown as plain text, and both members get exactly the same actions.
    for (const member of [manager, developer]) {
      const row = rowFor(page, member.name);
      await expect(row).toBeVisible();
      await expect(row).toContainText(member.role);
      await expect(
        row.getByRole('button', { name: /remove/i }),
        'every member, whatever their role, can be removed',
      ).toHaveCount(1);
    }

    // …and both are equally assignable: a role grants nothing and withholds nothing.
    await open(page, '/tasks/new');
    const options = (await assigneeOptions(page)).join(' | ');
    expect(options).toContain(manager.name);
    expect(options).toContain(developer.name);
  });

  test('removes a member from the roster', async ({ page, request }) => {
    const name = uniqueLabel('Priya Lunch leaving');
    await createMember(request, { name, role: 'Product Designer' });

    await page.goto('/team');
    await settle(page);
    const row = rowFor(page, name);
    await expect(row).toBeVisible();
    await clickButton(row, /remove/i);

    // A confirmation step is allowed; it must be honoured, not assumed away.
    const dialog = page.getByRole('alertdialog');
    if ((await dialog.count()) > 0) {
      await clickButton(dialog.first(), /remove|confirm|yes/i);
    }

    await expect(page.getByRole('row', { name: new RegExp(escapeForRegExp(name)) })).toHaveCount(0);

    await expect
      .poll(
        async (): Promise<boolean> => {
          const roster = await listMembers(request);
          return roster.some((member: MemberPayload): boolean => member.name === name);
        },
        { timeout: 10000 },
      )
      .toBe(false);
  });
});
