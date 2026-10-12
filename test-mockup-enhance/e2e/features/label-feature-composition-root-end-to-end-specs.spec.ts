import { expect, test, type Locator, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import { uniqueLabel } from '../support/boardApi.js';
import { clickButton } from '../support/ui.js';
import {
  FIXTURE_LABEL_COLOR,
  createLabel,
  createLabelledTask,
  findTaskByTitle,
  labelNames,
  labelNamesOfTask,
  listLabels,
  postLabel,
  type LabelPayload,
  type LabelledTaskPayload,
} from '../support/labelsApi.js';

const FEATURE = 'label-feature-composition-root-end-to-end-specs';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

/** The Labels field of a screen, by the test id that screen renders it under. */
function labelsField(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]`).first();
}

/** The control inside a label picker that creates the label whose name has just been typed. */
async function createControl(field: Locator): Promise<Locator> {
  const patterns: RegExp[] = [/create/i, /^add\b/i, /add label/i, /^\+$/];
  for (const pattern of patterns) {
    const candidate = field.getByRole('button', { name: pattern }).first();
    if ((await candidate.count()) > 0) {
      return candidate;
    }
  }
  return field.getByRole('button').first();
}

/**
 * Names a brand-new label in a screen's own label picker and creates it there — the way a person
 * does it, without leaving the form they are filling in.
 */
async function createLabelInPicker(page: Page, field: Locator, name: string): Promise<void> {
  await expect(field, 'the screen must render its Labels field').toBeVisible();

  let nameBox = field.getByRole('textbox').first();
  if ((await nameBox.count()) === 0) {
    // Some pickers keep the create form behind a control of their own.
    const reveal = field.getByRole('button', { name: /new label|create label|add label|^\+$/i }).first();
    if ((await reveal.count()) > 0) {
      await reveal.click();
      await settle(page);
    }
    nameBox = field.getByRole('textbox').first();
  }
  await expect(nameBox, 'the label picker must offer a field to name a new label').toBeVisible();
  await nameBox.fill(name);

  const create = await createControl(field);
  await expect(
    create,
    'the label picker must offer a control that creates the label just named',
  ).toBeVisible();
  await create.click();
  await settle(page);

  await expect(
    field.getByText(name, { exact: false }).first(),
    'a label created in the picker must be attached to the task straight away',
  ).toBeVisible();
}

test.describe('@feature:label-feature-composition-root-end-to-end-specs task labels across the assembled app', () => {
  test('creates a label on the add task form, saves the task with it and shows its chips on the task page', async ({
    page,
    request,
  }) => {
    const newLabel = uniqueLabel('Lane Urgent');
    const title = uniqueLabel('Alex QA labelled');

    try {
      // THE ADD TASK FORM — the label-enabled create screen.
      await open(page, '/tasks/new');
      await expect(page.getByText('Title', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Labels', { exact: false }).first()).toBeVisible();

      await page.getByLabel(/title/i).first().fill(title);
      await createLabelInPicker(page, labelsField(page, 'new-task-labels'), newLabel);

      // The label really reached the backend, through POST /api/labels.
      await expect
        .poll(async (): Promise<string> => (await labelNames(request)).join(' | '), {
          timeout: 10000,
        })
        .toContain(newLabel);

      await captureRoute(page, FEATURE, '/tasks/new');

      await clickButton(page, /save task/i);

      // …and the saved task carries it.
      await expect
        .poll(
          async (): Promise<string> => {
            const stored = await findTaskByTitle(request, title);
            return stored === null
              ? ''
              : (stored.labels ?? []).map((label: LabelPayload): string => label.name).join(' | ');
          },
          { timeout: 10000 },
        )
        .toContain(newLabel);

      const created: LabelledTaskPayload | null = await findTaskByTitle(request, title);
      expect(created, 'the saved task must be on the board').not.toBeNull();
      const taskId = created === null ? '' : created.id;
      expect(taskId, 'the created task must have an id').not.toBe('');

      // THE BOARD — the new task is there.
      await open(page, '/');
      await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
      await captureRoute(page, FEATURE, '/');

      // THE TASK PAGE — opened at the real record, showing its label chips.
      await open(page, `/tasks/${taskId}`);
      await expect(page.getByText('Labels', { exact: false }).first()).toBeVisible();
      await expect(
        labelsField(page, 'task-detail-labels').getByText(newLabel, { exact: false }).first(),
        'the task page must show the chip for every label the task carries',
      ).toBeVisible();
      await captureRoute(page, FEATURE, '/tasks/:id');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('changes a task\u2019s label set on the task page and saves it', async ({ page, request }) => {
    const existing = await createLabel(request, uniqueLabel('Lane Design'));
    const task = await createLabelledTask(request, {
      title: uniqueLabel('Priya Lunch relabelled'),
      status: 'todo',
      labelIds: [existing.id],
    });
    expect(
      (task.labels ?? []).map((label: LabelPayload): string => label.name),
      'a task created with labelIds must come back carrying those labels',
    ).toContain(existing.name);

    const added = uniqueLabel('Lane Spike');

    await open(page, `/tasks/${task.id}`);
    const field = labelsField(page, 'task-detail-labels');
    await expect(field.getByText(existing.name, { exact: false }).first()).toBeVisible();

    await createLabelInPicker(page, field, added);
    await clickButton(page, /save changes/i);

    await expect
      .poll(async (): Promise<string> => (await labelNamesOfTask(request, task.id)).join(' | '), {
        timeout: 10000,
      })
      .toContain(added);

    const saved = await labelNamesOfTask(request, task.id);
    expect(saved, 'the label the task already carried must still be attached').toContain(
      existing.name,
    );

    // The change was persisted, not only held on screen.
    await page.reload();
    await settle(page);
    const reloaded = labelsField(page, 'task-detail-labels');
    await expect(reloaded.getByText(existing.name, { exact: false }).first()).toBeVisible();
    await expect(reloaded.getByText(added, { exact: false }).first()).toBeVisible();
    await captureRoute(page, FEATURE, '/tasks/:id');
  });

  test('refuses a second label with a name that is already taken', async ({ request }) => {
    const name = uniqueLabel('Lane Duplicate');
    const created = await createLabel(request, name);
    expect(created.name).toBe(name);

    const again = await postLabel(request, { name, color: FIXTURE_LABEL_COLOR });
    expect(
      again.status(),
      'POST /api/labels must refuse a label whose name is already in use',
    ).toBeGreaterThanOrEqual(400);
    expect(
      again.status(),
      'a duplicate label name is a client error, never a server failure',
    ).toBeLessThan(500);

    const said = await again.text();
    expect(said, 'the refusal must carry a message a screen can show').not.toBe('');
    expect(
      said.toLowerCase(),
      'the refusal must say that the name is already taken',
    ).toMatch(/exist|already|taken|duplicate|in use|unique|name/);

    const stored = (await listLabels(request)).filter(
      (label: LabelPayload): boolean => label.name === name,
    );
    expect(stored, 'the duplicate must not have been stored').toHaveLength(1);
  });

  test('the composition root answers the label API before it serves the client shell', async ({
    request,
  }) => {
    const labels = await request.get('/api/labels');
    expect(labels.status(), 'the mounted label router must answer /api/labels').toBe(200);
    expect(labels.headers()['content-type'] ?? '').toContain('application/json');

    const unknown = await request.get('/api/not-a-real-label-endpoint');
    expect(unknown.status(), 'an unknown /api address must be a JSON 404').toBe(404);
    expect(unknown.headers()['content-type'] ?? '').toContain('application/json');

    for (const route of ['/', '/tasks/new']) {
      const served = await request.get(route);
      expect(served.status(), `${route} must be served by the client shell`).toBe(200);
      expect(served.headers()['content-type'] ?? '').toContain('text/html');
    }
  });
});
