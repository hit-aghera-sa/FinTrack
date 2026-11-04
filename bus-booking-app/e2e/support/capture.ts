import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

/**
 * THE SHARED CAPTURE HELPERS for every spec under e2e/features.
 *
 * Three exports, under exactly these names, so any spec in any lane can import them:
 *   settle(page)                      - resolves when the screen has finished loading;
 *   captureFeature(page, slug)        - writes .qa/shots/<slug>.{html,png,styles.json};
 *   captureRoute(page, slug, route)   - writes .qa/shots/<slug>__<route-slug>.{html,png,styles.json}.
 *
 * Neither capture function navigates: the spec opens the screen (a route with a :param is opened at a
 * REAL record) and then calls captureRoute with the route PATTERN, which is what names the files.
 */

const SHOTS_DIR = path.join('.qa', 'shots');
const MAX_ELEMENTS = 200;

/** One element's computed-style facts, as the visual QA grader reads them. */
interface ElementFacts {
  tag: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  backgroundColor: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  borderRadius: string;
}

interface PageFacts {
  viewport: { width: number; height: number };
  elements: ElementFacts[];
}

/** `/patients/new` -> `patients-new`, `/bookings/:bookingId` -> `bookings-bookingid`, `/` -> `home`. */
export function routeSlug(route: string): string {
  const slug = route
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'home' : slug;
}

/** The network has gone quiet and nothing on the page still says it is busy. */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  await expect.poll(() => page.locator('[aria-busy="true"]:visible').count(), { timeout: 10000 }).toBe(0);
}

async function readFacts(page: Page): Promise<PageFacts> {
  return await page.evaluate((limit: number) => {
    const collected: ElementFacts[] = [];
    const nodes = Array.from(document.querySelectorAll('body *'));
    for (const node of nodes) {
      if (collected.length >= limit) break;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      collected.push({
        tag: node.tagName.toLowerCase(),
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        borderRadius: style.borderRadius,
      });
    }
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      elements: collected,
    };
  }, MAX_ELEMENTS);
}

async function writeArtifacts(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  const html = await page.content();
  fs.writeFileSync(path.join(SHOTS_DIR, `${name}.html`), html, 'utf8');

  const png = await page.screenshot({ fullPage: true });
  fs.writeFileSync(path.join(SHOTS_DIR, `${name}.png`), png);

  const facts = await readFacts(page);
  const styles = {
    url: page.url(),
    viewport: facts.viewport,
    elements: facts.elements,
  };
  fs.writeFileSync(path.join(SHOTS_DIR, `${name}.styles.json`), JSON.stringify(styles, null, 2), 'utf8');
}

/** The feature's primary screen, as `.qa/shots/<featureSlug>.*`. */
export async function captureFeature(page: Page, featureSlug: string): Promise<void> {
  await writeArtifacts(page, featureSlug);
}

/** One required route of the feature, as `.qa/shots/<featureSlug>__<route-slug>.*`. */
export async function captureRoute(page: Page, featureSlug: string, route: string): Promise<void> {
  await writeArtifacts(page, `${featureSlug}__${routeSlug(route)}`);
}
