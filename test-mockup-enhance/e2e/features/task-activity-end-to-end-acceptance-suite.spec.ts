import { expect, test, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import {
  addComment,
  createMember,
  createTask,
  getTask,
  listTasks,
  patchTask,
  uniqueLabel,
  type TaskPayload,
} from '../support/boardApi.js';
import { createLabel } from '../support/labelsApi.js';
import { clickButton } from '../support/ui.js';
import {
  entriesMentioning,
  entryId,
  entryText,
  entryTime,
  fetchActivity,
  getActivityResponse,
  pause,
  taskActivityPath,
  type ActivityEntry,
} from '../support/activityApi.js';

const FEATURE = 'task-activity-end-to-end-acceptance-suite';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

/** Everything the current screen says, lowercased. */
async function screenText(page: Page): Promise<string> {
  const text = await page.locator('body').innerText();
  return text.toLowerCase();
}

test.describe('@feature:task-activity-end-to-end-acceptance-suite the task activity feed', () => {
  test('records a created entry and shows the timeline for that task', async ({ page, request }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA tracked'),
      status: 'todo',
    });

    try {
      const response = await getActivityResponse(request, task.id);
      expect(response.status(), 'the activity feed must answer 200 for a real task').toBe(200);
      expect(response.headers()['content-type'] ?? '').toContain('application/json');

      const entries = await fetchActivity(request, task.id);
      expect(entries.length, 'creating a task must record an activity entry').toBeGreaterThanOrEqual(
        1,
      );

      // The shape every timeline needs: an identifier and a moment on every entry.
      for (const entry of entries) {
        expect(entryId(entry), 'every activity entry must carry its own id').not.toBe('');
        expect(
          Number.isNaN(entryTime(entry)),
          'every activity entry must carry the moment it was recorded',
        ).toBe(false);
      }

      const created = entriesMentioning(entries, /creat/);
      expect(
        created.length,
        'the feed must hold the entry recorded when the task was created',
      ).toBeGreaterThanOrEqual(1);

      // THE TASK SCREEN — it offers the way through to this task's activity.
      await open(page, `/tasks/${task.id}`);
      await expect(
        page.getByText('Activity', { exact: false }).first(),
        'the task screen must offer the Activity timeline',
      ).toBeVisible();
      await expect(page.getByText(task.title, { exact: false }).first()).toBeVisible();
      await captureRoute(page, FEATURE, '/tasks/:id');

      // THE TIMELINE — opened at the real record.
      await open(page, taskActivityPath(task.id));
      await expect(page.getByText('Activity', { exact: false }).first()).toBeVisible();
      expect(
        await screenText(page),
        'the timeline must show the entry recorded when the task was created',
      ).toMatch(/creat/);
      await captureRoute(page, FEATURE, '/tasks/:id/activity');
    } finally {
      // The feature's primary screen is the activity timeline, which is where this test ends.
      await captureFeature(page, FEATURE);
    }
  });

  test('records one entry per field changed, each with its from and to values', async ({
    page,
    request,
  }) => {
    const member = await createMember(request, {
      name: uniqueLabel('Priya Lunch activity'),
      role: 'Delivery Lead',
    });
    const label = await createLabel(request, uniqueLabel('Lane Activity'));
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA edited'),
      status: 'todo',
      priority: 'Medium',
    });

    try {
      // THE TASK SCREEN — status, priority and assignee changed the way a person changes them.
      await open(page, `/tasks/${task.id}`);
      await page.getByLabel(/^status$/i).first().selectOption({ label: 'Doing' });
      await page.getByLabel(/^priority$/i).first().selectOption({ label: 'High' });
      await page.getByLabel(/assignee/i).first().selectOption({ label: member.name });
      await clickButton(page, /save changes/i);

      await expect
        .poll(async (): Promise<string> => (await getTask(request, task.id)).status, {
          timeout: 10000,
        })
        .toBe('doing');

      const saved = await getTask(request, task.id);
      expect(saved.priority).toBe('High');
      expect(saved.assigneeId).toBe(member.id);

      // …and the labels, changed on the record itself.
      await pause(40);
      const relabelled = await request.patch(`/api/tasks/${task.id}`, {
        data: { labelIds: [label.id] },
      });
      expect(relabelled.status(), 'PATCH /api/tasks/:id must attach the label').toBe(200);

      const entries = await fetchActivity(request, task.id);

      const statusEntries = entriesMentioning(entries, /status/, /doing/);
      expect(statusEntries, 'a status change must record exactly one entry').toHaveLength(1);
      const statusText = entryText(statusEntries[0] ?? {});
      expect(statusText, 'the status entry must carry the value it changed from').toMatch(
        /to ?do|todo/,
      );
      expect(statusText, 'the status entry must carry the value it changed to').toMatch(/doing/);

      const priorityEntries = entriesMentioning(entries, /priority/, /high/);
      expect(priorityEntries, 'a priority change must record exactly one entry').toHaveLength(1);
      const priorityText = entryText(priorityEntries[0] ?? {});
      expect(priorityText, 'the priority entry must carry the value it changed from').toMatch(
        /medium/,
      );

      const assigneeEntries = entriesMentioning(entries, /assign/);
      expect(
        assigneeEntries.length,
        'assigning the task must record its own entry',
      ).toBeGreaterThanOrEqual(1);
      const assigneeText = assigneeEntries.map((entry: ActivityEntry): string => entryText(entry)).join(' | ');
      expect(
        assigneeText.includes(member.name.toLowerCase()) ||
          assigneeText.includes(member.id.toLowerCase()),
        'the assignee entry must say who the task was assigned to',
      ).toBe(true);

      const labelEntries = entriesMentioning(entries, /label/);
      expect(
        labelEntries.length,
        'changing the labels must record its own entry',
      ).toBeGreaterThanOrEqual(1);
      const labelText = labelEntries.map((entry: ActivityEntry): string => entryText(entry)).join(' | ');
      expect(
        labelText.includes(label.name.toLowerCase()) || labelText.includes(label.id.toLowerCase()),
        'the label entry must say which label was attached',
      ).toBe(true);

      // THE TIMELINE — the same changes, on screen.
      await open(page, taskActivityPath(task.id));
      await expect(page.getByText('Activity', { exact: false }).first()).toBeVisible();
      const shown = await screenText(page);
      expect(shown, 'the timeline must show the new status').toContain('doing');
      expect(shown, 'the timeline must show the new priority').toContain('high');
      await captureRoute(page, FEATURE, '/tasks/:id/activity');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('records a comment as its own entry and lists the feed newest first', async ({ request }) => {
    const task = await createTask(request, {
      title: uniqueLabel('Alex QA discussed'),
      status: 'todo',
    });

    await pause(40);
    const moved = await patchTask(request, task.id, { status: 'doing' });
    expect(moved.status).toBe('doing');

    await pause(40);
    await addComment(request, task.id, 'Picked this up for the Alex QA walkthrough.');

    const entries = await fetchActivity(request, task.id);
    expect(
      entries.length,
      'the create, the move and the comment must each be recorded',
    ).toBeGreaterThanOrEqual(3);

    const commentEntries = entriesMentioning(entries, /comment/);
    expect(
      commentEntries.length,
      'adding a comment must record an activity entry',
    ).toBeGreaterThanOrEqual(1);

    const times = entries.map((entry: ActivityEntry): number => entryTime(entry));
    for (const moment of times) {
      expect(Number.isNaN(moment), 'every entry must carry a readable moment').toBe(false);
    }
    for (let index = 1; index < times.length; index += 1) {
      expect(
        times[index - 1] ?? 0,
        'the feed must be newest first',
      ).toBeGreaterThanOrEqual(times[index] ?? 0);
    }

    expect(
      entryText(entries[0] ?? {}),
      'the newest entry must be the comment that was just added',
    ).toMatch(/comment/);
    expect(
      entryText(entries[entries.length - 1] ?? {}),
      'the oldest entry must be the one recorded when the task was created',
    ).toMatch(/creat/);
  });

  test('shows the empty state for a task with no recorded activity', async ({ page, request }) => {
    const tasks: TaskPayload[] = await listTasks(request);
    expect(tasks.length, 'the board must hold at least one task').toBeGreaterThan(0);

    let quiet: TaskPayload | null = null;
    for (const task of tasks.slice(0, 12)) {
      const response = await getActivityResponse(request, task.id);
      expect(response.status(), 'the activity feed must answer 200 for a real task').toBe(200);
      const entries = await fetchActivity(request, task.id);
      if (entries.length === 0) {
        quiet = task;
        break;
      }
    }

    expect(
      quiet,
      'the board\u2019s seeded tasks predate the activity feed, so at least one must have no recorded activity',
    ).not.toBeNull();
    if (quiet === null) {
      throw new Error('No task on the board has an empty activity feed.');
    }

    await open(page, taskActivityPath(quiet.id));
    await expect(page.getByText('Activity', { exact: false }).first()).toBeVisible();

    const shown = await screenText(page);
    expect(
      /no activity|no recorded activity|no entries|activity yet|nothing to show|nothing has happened|no changes/.test(
        shown,
      ),
      'a task with no recorded activity must say so, never show a blank timeline',
    ).toBe(true);
  });

  test('answers the activity feed of a task that does not exist with a JSON 404', async ({
    request,
  }) => {
    const response = await getActivityResponse(request, 'no-such-task-anywhere');

    expect(response.status(), 'an unknown task must be a 404, never an empty feed').toBe(404);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as { message?: string; error?: string };
    const said = body.message ?? body.error ?? '';
    expect(said, 'the refusal must carry a message a screen can show').not.toBe('');
    expect(
      said.toLowerCase(),
      'the refusal must say that the task does not exist',
    ).toMatch(/not found|does not exist|no such|unknown|missing/);
  });
});
