// e2e/support/capture.ts
//
// The shared capture helpers every feature spec uses (F67). These names are an agreement
// between every task that writes under e2e/: `settle`, `captureFeature`, `captureRoute`.
//
// Nothing here imports from src/: Playwright loads these files with its own transform, so an
// application module pulled in here could take the whole suite down before a test runs.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { expect, type Page } from '@playwright/test';

/** Where the visual-QA artifacts go, at the workspace root. */
const SHOTS_DIR: string = path.join(process.cwd(), '.qa', 'shots');

/** How many visible elements the computed-style record holds. */
const MAX_ELEMENTS = 200;

/** One visible element, as the visual-QA grader reads it. */
export interface StyleFact {
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

/** The whole computed-style record for one captured screen. */
export interface StyleReport {
  viewport: { width: number; height: number };
  elements: StyleFact[];
  url: string;
}

/**
 * The filesystem-safe name of a route: the full route lowercased, runs of non-alphanumeric
 * characters replaced by a hyphen, leading/trailing hyphens trimmed.
 *
 *   '/tasks/new' -> 'tasks-new'
 *   '/tasks/:id' -> 'tasks-id'
 *   '/'          -> 'home'
 */
export function routeSlug(route: string): string {
  const slug = String(route)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'home' : slug;
}

/**
 * Resolves when the screen has finished loading: the network has gone quiet and nothing on the
 * page still says it is busy.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  await expect.poll(() => page.locator('[aria-busy="true"]:visible').count(), { timeout: 10000 }).toBe(0);
}

/** The computed-style facts of everything visible on the screen, plus the viewport and the URL. */
async function collectStyles(page: Page): Promise<StyleReport> {
  const collected = await page.evaluate(
    (limit: number): { viewport: { width: number; height: number }; elements: StyleFact[] } => {
      const doc = globalThis.document;
      const elements: StyleFact[] = [];
      const nodes = Array.from(doc.querySelectorAll('body *'));
      for (const node of nodes) {
        if (elements.length >= limit) break;
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const style = globalThis.getComputedStyle(node);
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
        elements.push({
          tag: node.tagName.toLowerCase(),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          borderRadius: style.borderRadius,
        });
      }
      return {
        viewport: { width: globalThis.innerWidth, height: globalThis.innerHeight },
        elements,
      };
    },
    MAX_ELEMENTS,
  );
  return { viewport: collected.viewport, elements: collected.elements, url: page.url() };
}

/** Writes the three artifacts for one screen. Never throws: a failed capture must not mask a failed test. */
async function writeArtifacts(page: Page, name: string): Promise<void> {
  try {
    fs.mkdirSync(SHOTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(SHOTS_DIR, `${name}.html`), await page.content(), 'utf8');
    await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: true });
    const styles = await collectStyles(page);
    fs.writeFileSync(path.join(SHOTS_DIR, `${name}.styles.json`), JSON.stringify(styles, null, 2), 'utf8');
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[qa] could not capture "${name}": ${reason}`);
  }
}

/** Writes `.qa/shots/<feature-slug>.{html,png,styles.json}` for the feature's primary screen. */
export async function captureFeature(page: Page, featureSlug: string): Promise<void> {
  await writeArtifacts(page, featureSlug);
}

/** Writes `.qa/shots/<feature-slug>__<route-slug>.{html,png,styles.json}` for one extra route. */
export async function captureRoute(page: Page, featureSlug: string, route: string): Promise<void> {
  await writeArtifacts(page, `${featureSlug}__${routeSlug(route)}`);
}
