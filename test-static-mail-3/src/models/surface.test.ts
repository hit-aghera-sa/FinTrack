import { describe, it, expect } from 'vitest';
import {
  PINNED_BASE_FONT_SIZE_PX,
  PINNED_FONT_SIZES_PX,
  PINNED_FONT_SIZE_CSS,
  SAFE_DOM_HOOKS,
  SAFE_HOOK_PREFIX,
  SECRET_LIKE_TOKEN_SOURCE,
  SECRET_TOKEN_PREFIXES,
  containsSecretLikeToken,
  findSecretLikeTokens,
  isPinnedFontSize,
  remToPx,
  secretLikeTokenPattern,
} from './surface.js';
import { COPY } from './copy.js';

/** Every user-facing string the copy contract can render. */
const copyStrings: string[] = [
  COPY.appTitle,
  COPY.appSubtitle,
  COPY.listLabel,
  COPY.filtersLabel,
  COPY.composer.heading,
  COPY.composer.label,
  COPY.composer.placeholder,
  COPY.composer.submit,
  ...Object.values(COPY.filters),
  ...Object.values(COPY.empty),
  COPY.item.completedBadge,
  COPY.item.toggle('Alex QA run-b7'),
  COPY.item.delete('Alex QA run-b7'),
  COPY.status.loading,
  COPY.status.clearCompleted,
  COPY.status.retry,
  COPY.status.remaining(3),
  ...Object.values(COPY.errors),
];

describe('secret-like token detection', () => {
  it('exposes the prefixes the guard scans for', () => {
    expect([...SECRET_TOKEN_PREFIXES]).toEqual(['sk-', 'pk-']);
    expect(SECRET_LIKE_TOKEN_SOURCE).toBe('(?:sk|pk)-[A-Za-z0-9_-]{6,}');
  });

  it('hands out a fresh, stateless pattern instance', () => {
    const first = secretLikeTokenPattern();
    const second = secretLikeTokenPattern();
    expect(first).not.toBe(second);
    expect(first.global).toBe(true);
    expect(first.lastIndex).toBe(0);
  });

  it('flags a hyphenated task-list hook, which spells out the sk- prefix', () => {
    expect(containsSecretLikeToken('class="task-list__checkbox"')).toBe(true);
    expect(findSecretLikeTokens('class="task-list__checkbox"')).toEqual(['sk-list__checkbox']);
    expect(findSecretLikeTokens('.task-list__row')).toEqual(['sk-list__row']);
    expect(findSecretLikeTokens('task-list__title--done')).toEqual(['sk-list__title--done']);
  });

  it('reports each distinct token once, in first-seen order', () => {
    const html = '<li class="task-list__row"><span class="task-list__row"></span></li>';
    expect(findSecretLikeTokens(html)).toEqual(['sk-list__row']);
  });

  it('accepts ordinary rendered text', () => {
    for (const value of ['', 'Tasks', 'data-task-id="a1"', 'no secrets here']) {
      expect(containsSecretLikeToken(value)).toBe(false);
      expect(findSecretLikeTokens(value)).toEqual([]);
    }
  });
});

describe('safe dom hooks', () => {
  it('never trips the surface guard', () => {
    for (const hook of Object.values(SAFE_DOM_HOOKS)) {
      expect(containsSecretLikeToken(hook)).toBe(false);
      expect(hook.includes('sk-')).toBe(false);
      expect(hook.length).toBeGreaterThan(0);
    }
  });

  it('uses the unhyphenated task-list prefix', () => {
    expect(SAFE_HOOK_PREFIX).toBe('tasklist');
    for (const hook of [
      SAFE_DOM_HOOKS.list,
      SAFE_DOM_HOOKS.listEmpty,
      SAFE_DOM_HOOKS.row,
      SAFE_DOM_HOOKS.title,
      SAFE_DOM_HOOKS.titleDone,
      SAFE_DOM_HOOKS.checkbox,
      SAFE_DOM_HOOKS.remove,
      SAFE_DOM_HOOKS.footer,
    ]) {
      expect(hook.startsWith(SAFE_HOOK_PREFIX)).toBe(true);
    }
    expect(SAFE_DOM_HOOKS.errorLine).toBe('error-line');
  });

  it('keeps every hook distinct', () => {
    const hooks = Object.values(SAFE_DOM_HOOKS);
    expect(new Set(hooks).size).toBe(hooks.length);
  });
});

describe('shared copy is surface safe', () => {
  it('renders no secret-like token', () => {
    for (const value of copyStrings) {
      expect(containsSecretLikeToken(value)).toBe(false);
    }
  });

  it('never renders a bare numeric string as a label', () => {
    for (const value of copyStrings) {
      expect(/^\d+$/.test(value.trim())).toBe(false);
    }
  });
});

describe('pinned type scale', () => {
  it('pins the base size and the admitted sizes', () => {
    expect(PINNED_BASE_FONT_SIZE_PX).toBe(16);
    expect([...PINNED_FONT_SIZES_PX]).toEqual([16]);
    expect(PINNED_FONT_SIZE_CSS).toBe('1rem');
  });

  it('admits only on-scale sizes', () => {
    expect(isPinnedFontSize(16)).toBe(true);
    expect(isPinnedFontSize(32)).toBe(false);
    expect(isPinnedFontSize(14)).toBe(false);
  });

  it('converts rem to px against the pinned root', () => {
    expect(remToPx(1)).toBe(16);
    expect(remToPx(0.875)).toBe(14);
    expect(remToPx(2)).toBe(32);
    expect(isPinnedFontSize(remToPx(1))).toBe(true);
    expect(isPinnedFontSize(remToPx(0.875))).toBe(false);
  });
});
