import { expect, test, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  addComment,
  createMember,
  createTask,
  listComments,
  listMembers,
  patchTask,
  removeMember,
  uniqueLabel,
  type MemberPayload,
  type CommentPayload,
} from '../support/boardApi.js';
import { columnOfTask, pathOf } from '../support/ui.js';

const FEATURE = 'end-to-end-acceptance-suite';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

test.describe('@feature:end-to-end-acceptance-suite the assembled board app', () => {
  test('every route renders its own screen through the shell', async ({ page, request }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA'), status: 'todo' });

    try {
      // THE BOARD — the primary screen of the app.
      await open(page, '/');
      await expect(page.locator('header').first()).toBeVisible();
      for (const heading of ['To do', 'Doing', 'Done']) {
        await expect(page.getByText(heading, { exact: false }).first()).toBeVisible();
      }
      // The shell draws its navigation from the page list, so the team page is reachable from here.
      const teamLink = page.locator('header a[href="/team"]').first();
      await expect(teamLink, 'the shell navigation must link the team page').toBeVisible();
      await captureRoute(page, FEATURE, '/');

      // ADD TASK
      await open(page, '/tasks/new');
      await expect(page.getByText('Add task', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Title', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Status', { exact: false }).first()).toBeVisible();
      await captureRoute(page, FEATURE, '/tasks/new');

      // TASK DETAIL — opened at a real record.
      await open(page, `/tasks/${task.id}`);
      await expect(page.getByText('Task detail', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Back to board', { exact: false }).first()).toBeVisible();
      await expect(page.getByText(task.title, { exact: false }).first()).toBeVisible();
      await captureRoute(page, FEATURE, '/tasks/:id');

      // TEAM
      await open(page, '/team');
      await expect(page.getByText('Team', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Name', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Role', { exact: false }).first()).toBeVisible();
      await captureRoute(page, FEATURE, '/team');

      // …and the navigation really navigates: back to the board from the team page.
      await page.locator('header a[href="/"]').first().click();
      await settle(page);
      expect(pathOf(page)).toBe('/');
    } finally {
      // The feature's primary screen is the board, which is where this walk ends.
      await captureFeature(page, FEATURE);
    }
  });

  test('the board opens without any sign-in', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    expect(pathOf(page)).toBe('/');
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByText('To do', { exact: false }).first()).toBeVisible();
  });

  test('@clarification:CL-2 a task can be created, moved, edited and commented on, and members managed, inside the app', async ({
    page,
    request,
  }) => {
    // MANAGE MEMBERS — add.
    const memberName = uniqueLabel('Priya Lunch');
    const member: MemberPayload = await createMember(request, { name: memberName, role: 'Delivery Lead' });
    expect(member.name).toBe(memberName);

    // CREATE.
    const created = await createTask(request, {
      title: uniqueLabel('Alex QA'),
      description: 'Written through the app itself.',
      assigneeId: member.id,
      dueDate: '2026-04-09',
      status: 'todo',
    });
    expect(created.status).toBe('todo');

    // MOVE.
    const moved = await patchTask(request, created.id, { status: 'doing' });
    expect(moved.status).toBe('doing');

    // EDIT.
    const editedTitle = uniqueLabel('Alex QA edited');
    const edited = await patchTask(request, created.id, {
      title: editedTitle,
      description: 'Rewritten in the app.',
      dueDate: '2026-05-12',
    });
    expect(edited.title).toBe(editedTitle);
    expect(edited.description).toBe('Rewritten in the app.');
    expect(edited.dueDate ?? '').toContain('2026-05-12');
    expect(edited.status).toBe('doing');

    // COMMENT.
    await addComment(request, created.id, 'Ready for review.');
    const thread: CommentPayload[] = await listComments(request, created.id);
    expect(thread.map((comment: CommentPayload): string => comment.body)).toContain('Ready for review.');

    // MANAGE MEMBERS — remove, with the task staying on the board.
    await removeMember(request, member.id);
    const members = await listMembers(request);
    expect(members.some((row: MemberPayload): boolean => row.id === member.id)).toBe(false);

    // And the board shows the result of all of it, with no reliance on anything outside the app.
    await page.goto('/');
    await settle(page);
    await expect(page.getByText(editedTitle, { exact: false }).first()).toBeVisible();
    expect(await columnOfTask(page, editedTitle)).toMatch(/doing/i);
  });
});
