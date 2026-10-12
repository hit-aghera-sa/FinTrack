import { expect, test, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  TASK_STATUSES,
  addComment,
  createMember,
  createTask,
  getTask,
  listComments,
  listMembers,
  patchTask,
  uniqueLabel,
  type CommentPayload,
  type MemberPayload,
} from '../support/boardApi.js';

const FEATURE = 'data-model-prisma-schema-repositories';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

test.describe('@feature:data-model-prisma-schema-repositories the shared data model', () => {
  test('@clarification:CL-1 every stored record carries its name, its date and its status', async ({
    page,
    request,
  }) => {
    const memberName = uniqueLabel('Priya Lunch');
    const member: MemberPayload = await createMember(request, {
      name: memberName,
      role: 'Product Designer',
    });
    expect(member.id).not.toBe('');
    expect(member.name).toBe(memberName);
    expect(member.role).toBe('Product Designer');

    const title = uniqueLabel('Alex QA');
    const created = await createTask(request, {
      title,
      description: 'Carries a name, a date and a status.',
      assigneeId: member.id,
      dueDate: '2026-03-04',
      status: 'doing',
    });

    // the NAME, the DATE, the STATUS — and the record's own creation date.
    expect(created.title).toBe(title);
    expect(created.dueDate ?? '').toContain('2026-03-04');
    expect(created.status).toBe('doing');
    expect(created.assigneeId).toBe(member.id);
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);

    // …and it is really persisted, not just echoed back.
    const reloaded = await getTask(request, created.id);
    expect(reloaded.title).toBe(title);
    expect(reloaded.status).toBe('doing');
    expect(reloaded.dueDate ?? '').toContain('2026-03-04');

    const comment: CommentPayload = await addComment(request, created.id, 'Stored with its own date.');
    expect(comment.taskId).toBe(created.id);
    expect(comment.body).toBe('Stored with its own date.');
    expect(Number.isNaN(Date.parse(comment.createdAt))).toBe(false);
    const thread = await listComments(request, created.id);
    expect(thread.length).toBeGreaterThanOrEqual(1);

    const roster = await listMembers(request);
    const stored = roster.find((row: MemberPayload): boolean => row.id === member.id);
    expect(stored?.name).toBe(memberName);
    expect(typeof stored?.openTaskCount).toBe('number');

    try {
      await open(page, '/');
      await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
      await captureRoute(page, FEATURE, '/');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('a task status is one of the three board columns and nothing else', async ({ request }) => {
    const task = await createTask(request, { title: uniqueLabel('Alex QA status') });

    for (const status of TASK_STATUSES) {
      const updated = await patchTask(request, task.id, { status });
      expect(updated.status).toBe(status);
    }

    const rejectedPatch = await request.patch(`/api/tasks/${task.id}`, { data: { status: 'archived' } });
    expect(rejectedPatch.status(), 'an unknown status must be refused').toBe(400);

    const rejectedCreate = await request.post('/api/tasks', {
      data: { title: uniqueLabel('Alex QA bad status'), status: 'parked' },
    });
    expect(rejectedCreate.status(), 'an unknown status must be refused on create too').toBe(400);
  });
});
