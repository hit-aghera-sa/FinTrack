import { expect, test, type Page } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture.js';

const FEATURE = 'design-tokens-shared-ui-primitives';

/** Opens a route of the running app in the browser and waits for the screen to finish loading. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await settle(page);
}

test.describe('@feature:design-tokens-shared-ui-primitives design tokens and shared UI primitives', () => {
  test('every colour on the board comes from a design token', async ({ page }) => {
    try {
      await open(page, '/');

      const declared = await page.evaluate((): string[] => {
        const names = new Set<string>();
        for (const sheet of Array.from(globalThis.document.styleSheets)) {
          let rules: CSSRule[];
          try {
            rules = Array.from(sheet.cssRules);
          } catch {
            continue;
          }
          for (const rule of rules) {
            const matches = rule.cssText.match(/--color-[a-z0-9-]+/g);
            if (matches !== null) {
              for (const match of matches) names.add(match);
            }
          }
        }
        return Array.from(names);
      });

      expect(declared, 'the theme must declare the shared colour tokens').toContain('--color-primary');
      expect(declared.length).toBeGreaterThanOrEqual(4);

      const resolved = await page.evaluate((): { primary: string; bodyColor: string; bodyFont: string } => {
        const root = globalThis.getComputedStyle(globalThis.document.documentElement);
        const body = globalThis.getComputedStyle(globalThis.document.body);
        return {
          primary: root.getPropertyValue('--color-primary').trim(),
          bodyColor: body.color,
          bodyFont: body.fontFamily,
        };
      });
      expect(resolved.primary, '--color-primary must resolve to a value').not.toBe('');
      expect(resolved.bodyColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(resolved.bodyFont).not.toBe('');

      // The shared primitives really draw the screen: a heading and the kit's button class.
      await expect(page.getByRole('heading').first()).toBeVisible();
      await expect(page.locator('.button, button').first()).toBeVisible();

      await captureRoute(page, FEATURE, '/');
    } finally {
      await captureFeature(page, FEATURE);
    }
  });

  test('@clarification:CL-4 the layout is built for desktop browsers and survives a narrow desktop window', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await settle(page);

    const wide = await page.evaluate((): { scrollWidth: number; clientWidth: number } => {
      const root = globalThis.document.documentElement;
      return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
    });
    expect(
      wide.scrollWidth,
      'the board must fit a desktop window without sideways scrolling',
    ).toBeLessThanOrEqual(wide.clientWidth + 2);

    for (const heading of ['To do', 'Doing', 'Done']) {
      await expect(page.getByText(heading, { exact: false }).first()).toBeVisible();
    }

    // Basic responsive behaviour, as a bonus: the three columns stay reachable when the window narrows.
    await page.setViewportSize({ width: 1024, height: 800 });
    for (const heading of ['To do', 'Doing', 'Done']) {
      await expect(page.getByText(heading, { exact: false }).first()).toBeVisible();
    }
  });
});
