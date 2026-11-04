import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * Guards the pinned typography contract of this lane.
 *
 * The approved design declares a SINGLE type step (the 16px base), so any
 * `--font-size-*` alias that drifts back to a smaller/larger value - or a
 * typography layer that stops being loaded last - is a design-fidelity defect.
 * These assertions read the real stylesheets so the regression is caught by the
 * unit gate instead of by the next QA pass.
 *
 * Deliberately asserts NO colour literals: the `test:visual-diff` gate scans
 * src/ for hex values and the pinned palette lives in tokens.css alone.
 */

function read(file: string): string {
  return readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
}

const tokensCss: string = read('tokens.css');
const typographyCss: string = read('typography.css');
const indexCss: string = read('index.css');

const FONT_SIZE_DECLARATION = /--font-size-([a-z0-9]+):\s*([^;]+);/g;

function fontSizeTokens(css: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of css.matchAll(FONT_SIZE_DECLARATION)) {
    const name: string = (match[1] ?? '').trim();
    const value: string = (match[2] ?? '').trim();
    if (name.length > 0) {
      found[name] = value;
    }
  }
  return found;
}

describe('pinned type scale', () => {
  it('declares the 16px base once', () => {
    expect(fontSizeTokens(tokensCss).base).toBe('16px');
  });

  it('keeps every size alias on the single 16px step', () => {
    const tokens = fontSizeTokens(tokensCss);
    const aliases = Object.keys(tokens).filter((name: string) => name !== 'base');

    expect(aliases.sort()).toEqual(['2xl', 'lg', 'md', 'sm', 'xl', 'xs']);
    for (const alias of aliases) {
      expect(tokens[alias]).toBe('1rem');
    }
  });

  it('keeps the token names other lanes already consume', () => {
    for (const name of ['--font-family-base', '--font-family-heading', '--font-size-base']) {
      expect(tokensCss).toContain(name);
    }
  });
});

describe('typography layer', () => {
  it('normalises every rendered string onto the pinned step', () => {
    expect(typographyCss).toContain('body *');
    expect(typographyCss).toContain('font-size: var(--font-size-md) !important;');
  });

  it('neutralises the user-agent heading and small-print sizes', () => {
    expect(typographyCss).toContain('h1,');
    expect(typographyCss).toContain('small,');
  });

  it('expresses hierarchy without size', () => {
    expect(typographyCss).toContain('--font-weight-bold');
    expect(typographyCss).toContain('--letter-spacing-wide');
  });

  it('hardcodes no pixel font sizes of its own', () => {
    expect(/font-size:\s*\d/.test(typographyCss)).toBe(false);
  });
});

describe('stylesheet entry point', () => {
  it('loads tokens, the screen and then the typography layer', () => {
    const tokensAt = indexCss.indexOf("'./tokens.css'");
    const screenAt = indexCss.indexOf("'./quicklist.css'");
    const typographyAt = indexCss.indexOf("'./typography.css'");

    expect(tokensAt).toBeGreaterThanOrEqual(0);
    expect(screenAt).toBeGreaterThan(tokensAt);
    expect(typographyAt).toBeGreaterThan(screenAt);
  });
});
