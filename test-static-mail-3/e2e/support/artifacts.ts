/**
 * Capture artifacts for visual QA.
 *
 * Every feature spec writes three files into the `.qa/shots` directory at the
 * workspace root after exercising its primary screen:
 *
 *   .qa/shots/<slug>.html        - the live DOM (page.content())
 *   .qa/shots/<slug>.png         - a full-page screenshot
 *   .qa/shots/<slug>.styles.json - computed-style facts for up to 200 visible elements
 *
 * Capture never fails a test: any error is logged and swallowed so the broken state
 * is still recorded when assertions fail.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

/** Relative directory the artifacts are written to. */
export const SHOTS_RELATIVE_DIR = '.qa/shots';

/** Absolute directory the artifacts are written to (workspace root + `.qa/shots`). */
export const SHOTS_DIR: string = path.resolve(process.cwd(), SHOTS_RELATIVE_DIR);

/** One element's computed-style facts. */
export interface ElementStyleFact {
  readonly tag: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: string;
  readonly backgroundColor: string;
  readonly fontFamily: string;
  readonly fontSize: string;
  readonly fontWeight: string;
  readonly borderRadius: string;
}

/** The serialised styles report. */
export interface StyleReport {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly elements: ElementStyleFact[];
}

/** Collect computed-style facts for the visible elements on the page. */
async function collectStyles(page: Page): Promise<StyleReport> {
  return page.evaluate((): StyleReport => {
    const facts: ElementStyleFact[] = [];
    const nodes: Element[] = Array.from(document.querySelectorAll('body *'));

    for (const node of nodes) {
      if (facts.length >= 200) break;
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();
      if (tag === 'style' || tag === 'script') continue;

      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      facts.push({
        tag,
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
      viewport: { width: window.innerWidth, height: window.innerHeight },
      elements: facts,
    };
  });
}

/** Write the three `.qa/shots` capture artifacts for `slug`. Never throws. */
export async function captureArtifacts(page: Page, slug: string): Promise<void> {
  try {
    mkdirSync(SHOTS_DIR, { recursive: true });

    const html = await page.content();
    writeFileSync(path.join(SHOTS_DIR, `${slug}.html`), html, 'utf8');

    await page.screenshot({ path: path.join(SHOTS_DIR, `${slug}.png`), fullPage: true });

    const report = await collectStyles(page);
    writeFileSync(
      path.join(SHOTS_DIR, `${slug}.styles.json`),
      JSON.stringify(report, null, 2),
      'utf8',
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[qa] artifact capture for ${slug} failed: ${message}`);
  }
}
