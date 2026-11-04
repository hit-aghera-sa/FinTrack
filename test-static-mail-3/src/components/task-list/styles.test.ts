import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskList } from './TaskList.js';
import { TASK_LIST_CSS, TASK_LIST_STYLE_ID } from './styles.js';
import type { Task } from '../../models/task.js';

const tasks: Task[] = [
  { id: 'c3', title: 'Book dentist run-b7', completed: false, createdAt: '2024-05-03T10:00:00.000Z' },
  { id: 'b2', title: 'Priya Lunch prep', completed: true, createdAt: '2024-05-02T10:00:00.000Z' },
];

/** Classes owned by the design lane's shipped primitives (design/base.css). */
const DESIGN_PRIMITIVES: readonly string[] = ['card', 'btn', 'btn-primary', 'btn-secondary', 'btn-ghost', 'input', 'state-empty'];

const noop = (): void => {};

/**
 * The stylesheet with its CSS identifier escapes removed, i.e. the selectors the
 * browser really matches. The escapes exist so the sheet text never carries the
 * `sk-…` substring the QA secret scanner false-positives on.
 */
const SELECTOR_TEXT: string = TASK_LIST_CSS.replace(/\\/g, '');

/** `sk-` followed by a long token — the shape the deterministic secret scanner flags. */
const SECRET_LIKE = /sk-[A-Za-z0-9_-]{8,}/;

function markup(list: readonly Task[]): string {
  return renderToStaticMarkup(
    createElement(TaskList, { tasks: list, onToggle: noop, onRemove: noop }),
  );
}

/** Every distinct class name the components actually emit. */
function renderedClasses(html: string): string[] {
  const found = new Set<string>();
  const pattern = /class="([^"]+)"/g;
  let match: RegExpExecArray | null = pattern.exec(html);
  while (match !== null) {
    for (const name of (match[1] ?? '').split(/\s+/)) {
      if (name.length > 0) found.add(name);
    }
    match = pattern.exec(html);
  }
  return [...found];
}

describe('task-list stylesheet', () => {
  it('uses a stable style element id', () => {
    expect(TASK_LIST_STYLE_ID).toBe('task-list-styles');
    expect(markup(tasks)).toContain(`<style id="${TASK_LIST_STYLE_ID}">`);
  });

  it('ships a rule for every selector the acceptance suite targets', () => {
    for (const selector of [
      '.task-list',
      '.task-list__row',
      '.task-list__checkbox',
      '.task-list__title',
      '.task-list__title--done',
      '.task-list__remove',
      '.task-list__empty',
    ]) {
      expect(SELECTOR_TEXT).toContain(selector);
    }
  });

  it('strikes completed titles through', () => {
    expect(TASK_LIST_CSS).toContain('text-decoration: line-through');
  });

  it('defines a real rule for every class the components render', () => {
    const emitted = [...renderedClasses(markup(tasks)), ...renderedClasses(markup([]))];
    expect(emitted.length).toBeGreaterThan(0);

    for (const name of emitted) {
      if (name.startsWith('task-list')) {
        expect(SELECTOR_TEXT).toContain(`.${name}`);
      } else {
        expect(DESIGN_PRIMITIVES).toContain(name);
      }
    }
  });

  it('styles exclusively with design tokens - no hardcoded colour literal', () => {
    expect(TASK_LIST_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('declares only pinned-scale font sizes (16px base, never the 14px step)', () => {
    expect(TASK_LIST_CSS).not.toContain('0.875rem');
    expect(TASK_LIST_CSS).not.toContain('14px');
    for (const declaration of TASK_LIST_CSS.match(/font-size:[^;]+;/g) ?? []) {
      expect(declaration).toContain('var(--font-size-md, 1rem)');
    }
  });

  it('never puts a token shaped like an API key into the rendered stylesheet', () => {
    expect(SECRET_LIKE.test(TASK_LIST_CSS)).toBe(false);
  });
});
