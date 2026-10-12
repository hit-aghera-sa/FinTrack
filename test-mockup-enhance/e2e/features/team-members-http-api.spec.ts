import { expect, test, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  createMember,
  createTask,
  getTask,
  listMembers,
  openTaskCount,
  patchTask,
  removeMember,
  uniqueLabel,
  type MemberPayload,
} from '../support/boardApi.js';

const FEATURE = 'team-members-http-api';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

test.describe('@feature:team-members-http-api the team members HTTP API', () => {
  test('reports a live open-task count for every member', async ({ request }) => {
    const member: MemberPayload = await createMember(request, {
      name: uniqueLabel('Priya Lunch'),
      role: 'Engineering Lead',
    });
    expect(await openTaskCount(request, member.id)).toBe(0);

    const task = await createTask(request, {
      title: uniqueLabel('Alex QA counted'),
      assigneeId: member.id,
      status: 'doing',
    });
    expect(await openTaskCount(request, member.id)).toBe(1);

    await patchTask(request, task.id, { status: 'done' });
    expect(await openTaskCount(request, member.id), 'a done task is no longer open work').toBe(0);
  });

  test('refuses a member with no name or no role', async ({ request }) => {
    const noName = await request.post('/api/members', { data: { name: '  ', role: 'QA Engineer' } });
    expect(noName.status()).toBe(400);
    const noNameBody = (await noName.json()) as { error?: string };
    expect(noNameBody.error ?? '').toMatch(/name/i);

    const noRole = await request.post('/api/members', { data: { name: uniqueLabel('Priya Lunch') } });
    expect(noRole.status()).toBe(400);
    const noRoleBody = (await noRole.json()) as { error?: string };
    expect(noRoleBody.error ?? '').toMatch(/role/i);
  });

  test('removing a member unassigns their tasks and keeps them on the board', async ({ page, request }) => {
    const member = await createMember(request, {
      name: uniqueLabel('Priya Lunch leaving'),
      role: 'Backend Engineer',
    });
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA kept'),
      assigneeId: member.id,
      status: 'doing',
    });
    expect(task.assigneeId).toBe(member.id);

    await removeMember(request, member.id);

    const roster = await listMembers(request);
    expect(roster.some((row: MemberPayload): boolean => row.id === member.id)).toBe(false);

    const survivor = await getTask(request, task.id);
    expect(survivor.assigneeId, 'the task must be unassigned, not deleted').toBeNull();
    expect(survivor.status).toBe('doing');

    try {
      await open(page, '/team');
      await expect(page.getByText(member.name, { exact: false })).toHaveCount(0);
      await captureRoute(page, FEATURE, '/team');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('a member that does not exist cannot be removed', async ({ request }) => {
    const response = await request.delete('/api/members/no-such-member-anywhere');
    expect(response.status()).toBe(404);
  });
});
