import { expect, test, type Page, type Request } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';
import { createMember, createTask, uniqueLabel, type MemberPayload } from '../support/boardApi.js';
import { pathOf } from '../support/ui.js';

const FEATURE = 'reports-route-top-navigation-link-and-server-composition-roo';

/** One member's row of the workload report, exactly as the API serialises it. */
interface MemberReportRow {
  memberId: string;
  memberName: string;
  role: string;
  todo: number;
  doing: number;
  done: number;
  overdue: number;
  total: number;
}

/** The whole payload of `GET /api/reports`. */
interface WorkloadReportBody {
  generatedAt: string;
  members: MemberReportRow[];
}

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

/**
 * Follows the shell's own "Reports" entry in the top navigation — a link when the frame draws one,
 * otherwise the navigation button carrying that label. Fails loudly when the shell offers neither,
 * because an unreachable page is the defect this feature exists to prevent.
 */
async function followReportsNavEntry(page: Page): Promise<void> {
  const byHref = page.locator('a[href="/reports"]').first();
  if ((await byHref.count()) > 0) {
    await byHref.click();
    await settle(page);
    return;
  }

  const byLinkName = page.getByRole('link', { name: /^\s*reports\s*$/i }).first();
  if ((await byLinkName.count()) > 0) {
    await byLinkName.click();
    await settle(page);
    return;
  }

  const byButtonName = page.getByRole('button', { name: /^\s*reports\s*$/i }).first();
  await expect(
    byButtonName,
    'the top navigation must offer a Reports entry on every page of the app',
  ).toBeVisible();
  await byButtonName.click();
  await settle(page);
}

test.describe('@feature:reports-route-top-navigation-link-and-server-composition-roo the reports route, its navigation link and the server composition root', () => {
  test('reaches the Reports page from the top navigation', async ({ page }) => {
    try {
      await open(page, '/');
      await followReportsNavEntry(page);

      expect(pathOf(page), 'the Reports entry must lead to /reports').toBe('/reports');
      await expect(page.getByText('Reports', { exact: false }).first()).toBeVisible();

      await captureRoute(page, FEATURE, '/reports');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('opens /reports directly and renders the figures the server computed', async ({
    page,
    request,
  }) => {
    const name = uniqueLabel('Priya Lunch reported');
    const member: MemberPayload = await createMember(request, {
      name,
      role: 'Engineering Lead',
    });
    await createTask(request, {
      title: uniqueLabel('Alex QA reported'),
      assigneeId: member.id,
      status: 'doing',
    });

    const dataCalls: string[] = [];
    page.on('request', (outgoing: Request): void => {
      const type = outgoing.resourceType();
      if (type === 'fetch' || type === 'xhr') dataCalls.push(outgoing.url());
    });

    await open(page, '/reports');

    await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Engineering Lead', { exact: false }).first()).toBeVisible();

    expect(
      dataCalls.some((url: string): boolean => url.includes('/api/reports')),
      'the reports screen must read its numbers from the backend over /api/reports',
    ).toBe(true);

    const origin = new URL(page.url()).origin;
    for (const url of dataCalls) {
      expect(new URL(url).origin, `${url} must be the app's own origin`).toBe(origin);
      expect(new URL(url).pathname).toMatch(/^\/api\//);
    }

    await captureRoute(page, FEATURE, '/reports');
  });

  test('GET /api/reports answers with the workload report the page reads', async ({
    page,
    request,
  }) => {
    const name = uniqueLabel('Priya Lunch workload');
    const member: MemberPayload = await createMember(request, { name, role: 'QA Engineer' });

    const response = await request.get('/api/reports');
    expect(response.status(), 'the mounted report router must answer /api/reports').toBe(200);

    const body = (await response.json()) as WorkloadReportBody;
    expect(
      Number.isNaN(Date.parse(body.generatedAt)),
      'the report must carry the moment the server produced it',
    ).toBe(false);
    expect(Array.isArray(body.members)).toBe(true);

    const row = body.members.find(
      (entry: MemberReportRow): boolean => entry.memberId === member.id,
    );
    expect(row, 'every roster member must appear in the report').toBeDefined();
    expect(row?.memberName).toBe(name);
    expect(row?.role).toBe('QA Engineer');
    expect(typeof row?.todo).toBe('number');
    expect(typeof row?.doing).toBe('number');
    expect(typeof row?.done).toBe('number');
    expect(typeof row?.overdue).toBe('number');
    expect(typeof row?.total).toBe('number');

    await open(page, '/api/reports');
    const rendered = await page.content();
    for (const token of ['generatedAt', 'members', 'overdue']) {
      expect(rendered, `the report payload must carry "${token}"`).toContain(token);
    }
    await captureRoute(page, FEATURE, '/api/reports');
  });

  test('leaves the Team page exactly as it was', async ({ page, request }) => {
    const name = uniqueLabel('Priya Lunch roster');
    await createMember(request, { name, role: 'Product Designer' });

    await open(page, '/team');
    await expect(page.getByText('Team', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible();

    await captureRoute(page, FEATURE, '/team');
  });

  test('the composition root answers the API before serving the client, and keeps the web root for the app', async ({
    request,
  }) => {
    const title = uniqueLabel('Alex QA mounted');

    const created = await request.post('/api/tasks', { data: { title } });
    expect(
      [200, 201],
      'a write must reach the API, never the single-page fallback',
    ).toContain(created.status());
    expect(created.headers()['content-type'] ?? '').toContain('application/json');
    const createdBody = (await created.json()) as { title?: string };
    expect(createdBody.title).toBe(title);

    const unknown = await request.get('/api/not-a-real-endpoint');
    expect(unknown.status(), 'an unknown /api address must be a JSON 404').toBe(404);
    expect(unknown.headers()['content-type'] ?? '').toContain('application/json');

    const root = await request.get('/');
    expect(root.status(), 'the shell owns the web root').toBe(200);
    expect(root.headers()['content-type'] ?? '').toContain('text/html');

    const clientRoute = await request.get('/reports');
    expect(clientRoute.status(), '/reports must be served by the client shell').toBe(200);
    expect(clientRoute.headers()['content-type'] ?? '').toContain('text/html');
  });
});
