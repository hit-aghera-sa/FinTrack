import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskListRow, resolveRemoveHandler, type RemoveHandler } from './TaskListRow.js';
import { COPY } from '../../models/copy.js';
import type { Task } from '../../models/task.js';

const active: Task = {
  id: 'c3',
  title: 'Book dentist run-b7',
  completed: false,
  createdAt: '2024-05-03T10:00:00.000Z',
};

const noopToggle = (): void => {};

function collect(into: string[]): RemoveHandler {
  return (id: string): void => {
    into.push(id);
  };
}

describe('resolveRemoveHandler', () => {
  it('uses onRemove when it is the only callback given', () => {
    const removed: string[] = [];
    resolveRemoveHandler(collect(removed), undefined)('c3');
    expect(removed).toEqual(['c3']);
  });

  it('falls back to the onDelete alias when onRemove is absent', () => {
    const deleted: string[] = [];
    resolveRemoveHandler(undefined, collect(deleted))('c3');
    expect(deleted).toEqual(['c3']);
  });

  it('prefers onRemove when both callbacks are supplied', () => {
    const removed: string[] = [];
    const deleted: string[] = [];
    resolveRemoveHandler(collect(removed), collect(deleted))('c3');
    expect(removed).toEqual(['c3']);
    expect(deleted).toEqual([]);
  });

  it('is a harmless no-op when neither callback is supplied', () => {
    expect(resolveRemoveHandler(undefined, undefined)('c3')).toBeUndefined();
  });
});

describe('<TaskListRow /> removal callback aliases', () => {
  it('renders the same row markup when only the onDelete alias is given', () => {
    const html = renderToStaticMarkup(
      <ul>
        <TaskListRow task={active} onToggle={noopToggle} onDelete={(): void => {}} />
      </ul>,
    );

    expect(html).toContain('data-task-id="c3"');
    expect(html).toContain('data-completed="false"');
    expect(html).toContain('class="btn-secondary task-list__remove"');
    expect(html).toContain('>Remove<');
    expect(html).toContain(`aria-label="${COPY.item.delete(active.title)}"`);
    expect(html).toContain(`aria-label="${COPY.item.toggle(active.title)}"`);
    expect(html).not.toContain('Are you sure');
  });

  it('still renders the Remove control when no removal callback is wired yet', () => {
    const html = renderToStaticMarkup(
      <ul>
        <TaskListRow task={active} onToggle={noopToggle} />
      </ul>,
    );

    expect(html.match(/>Remove</g) ?? []).toHaveLength(1);
    expect(html).toContain('class="task-list__title"');
  });
});
