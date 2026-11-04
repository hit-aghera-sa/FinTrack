import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskList } from './TaskList.js';
import { TaskListRow } from './TaskListRow.js';
import { COPY } from '../../models/copy.js';
import type { Task } from '../../models/task.js';

const noop = (): void => {};
const noopToggle = (): void => {};

const tasks: Task[] = [
  { id: 'c3', title: 'Book dentist', completed: false, createdAt: '2024-05-03T10:00:00.000Z' },
  { id: 'b2', title: 'Priya Lunch prep', completed: true, createdAt: '2024-05-02T10:00:00.000Z' },
  { id: 'a1', title: 'Alex QA groceries', completed: false, createdAt: '2024-05-01T10:00:00.000Z' },
];

function indexOfAll(html: string, needles: string[]): number[] {
  return needles.map((needle) => html.indexOf(needle));
}

describe('<TaskList />', () => {
  it('renders one row per task in the order given', () => {
    const html = renderToStaticMarkup(<TaskList tasks={tasks} onToggle={noopToggle} onRemove={noop} />);
    expect(html.match(/<li /g) ?? []).toHaveLength(3);
    const positions = indexOfAll(html, ['Book dentist', 'Priya Lunch prep', 'Alex QA groceries']);
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('binds each checkbox to the task completed flag', () => {
    const html = renderToStaticMarkup(<TaskList tasks={tasks} onToggle={noopToggle} onRemove={noop} />);
    expect(html.match(/type="checkbox"/g) ?? []).toHaveLength(3);
    expect(html.match(/checked=""/g) ?? []).toHaveLength(1);
  });

  it('strikes through only completed titles', () => {
    const html = renderToStaticMarkup(<TaskList tasks={tasks} onToggle={noopToggle} onRemove={noop} />);
    // Count the rendered class attribute, not the stylesheet rule that ships beside the markup.
    expect(html.match(/class="task-list__title task-list__title--done"/g) ?? []).toHaveLength(1);
    expect(html).toContain('task-list__title task-list__title--done">Priya Lunch prep');
  });

  it('renders a small secondary Remove button per row with no confirmation markup', () => {
    const html = renderToStaticMarkup(<TaskList tasks={tasks} onToggle={noopToggle} onRemove={noop} />);
    expect(html.match(/>Remove</g) ?? []).toHaveLength(3);
    expect(html.match(/class="btn-secondary task-list__remove"/g) ?? []).toHaveLength(3);
    expect(html).not.toContain('dialog');
    expect(html).not.toContain('Are you sure');
  });

  it('labels the controls from the shared copy contract', () => {
    const html = renderToStaticMarkup(<TaskList tasks={tasks} onToggle={noopToggle} onRemove={noop} />);
    expect(html).toContain(`aria-label="${COPY.item.toggle('Book dentist')}"`);
    expect(html).toContain(`aria-label="${COPY.item.delete('Book dentist')}"`);
    expect(html).toContain(`aria-label="${COPY.listLabel}"`);
  });

  it('ships its stylesheet with the markup', () => {
    const html = renderToStaticMarkup(<TaskList tasks={tasks} onToggle={noopToggle} onRemove={noop} />);
    expect(html).toContain('<style id="task-list-styles">');
    // The stylesheet writes its selectors with an escaped hyphen, so compare the
    // un-escaped selector text (what the browser actually matches).
    expect(html.replace(/\\/g, '')).toContain('.task-list__row');
  });

  it('renders the empty state instead of a list when there are no tasks', () => {
    const html = renderToStaticMarkup(<TaskList tasks={[]} onToggle={noopToggle} onRemove={noop} />);
    expect(html).not.toContain('<ul');
    expect(html).toContain(COPY.empty.all);

    const custom = renderToStaticMarkup(
      <TaskList tasks={[]} onToggle={noopToggle} onRemove={noop} emptyMessage={COPY.empty.active} />,
    );
    expect(custom).toContain(COPY.empty.active);
  });
});

describe('<TaskListRow />', () => {
  it('exposes the task id and completed flag as data attributes', () => {
    const html = renderToStaticMarkup(
      <ul>
        <TaskListRow task={tasks[1] as Task} onToggle={noopToggle} onRemove={noop} />
      </ul>,
    );
    expect(html).toContain('data-task-id="b2"');
    expect(html).toContain('data-completed="true"');
  });

  it('reports the new completed value and the id through its callbacks', () => {
    const toggled: Array<[string, boolean]> = [];
    const removed: string[] = [];
    const element = (
      <TaskListRow
        task={tasks[0] as Task}
        onToggle={(id: string, completed: boolean) => toggled.push([id, completed])}
        onRemove={(id: string) => removed.push(id)}
      />
    );

    const props = element.props as {
      onToggle: (id: string, completed: boolean) => void;
      onRemove: (id: string) => void;
    };
    props.onToggle('c3', true);
    props.onRemove('c3');

    expect(toggled).toEqual([['c3', true]]);
    expect(removed).toEqual(['c3']);
  });
});
