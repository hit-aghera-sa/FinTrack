import { describe, it, expect } from 'vitest';
import {
  REMOVE_LABEL,
  TASK_LIST_CLASS,
  removeLabel,
  rowClassName,
  titleClassName,
  toRowView,
  toRowViews,
  toggleLabel,
  type TaskRowView,
} from './helpers.js';
import { COPY } from '../../models/copy.js';
import type { Task } from '../../models/task.js';

const tasks: Task[] = [
  { id: 'c3', title: 'Book dentist run-b7', completed: false, createdAt: '2024-05-03T10:00:00.000Z' },
  { id: 'b2', title: 'Priya Lunch prep', completed: true, createdAt: '2024-05-02T10:00:00.000Z' },
  { id: 'a1', title: 'Alex QA groceries', completed: false, createdAt: '2024-05-01T10:00:00.000Z' },
];

describe('task-list constants', () => {
  it('pins the class and label the acceptance selectors depend on', () => {
    expect(TASK_LIST_CLASS).toBe('task-list');
    expect(REMOVE_LABEL).toBe('Remove');
  });
});

describe('rowClassName', () => {
  it('always carries the row class and the shared card primitive', () => {
    for (const completed of [false, true]) {
      const classes = rowClassName(completed).split(' ');
      expect(classes).toContain('task-list__row');
      expect(classes).toContain('card');
    }
  });

  it('adds the done modifier only for a completed task', () => {
    expect(rowClassName(false).split(' ')).not.toContain('task-list__row--done');
    expect(rowClassName(true).split(' ')).toContain('task-list__row--done');
  });
});

describe('titleClassName', () => {
  it('renders the plain title class for an active task', () => {
    expect(titleClassName(false)).toBe('task-list__title');
  });

  it('adds the strikethrough modifier for a completed task', () => {
    expect(titleClassName(true)).toBe('task-list__title task-list__title--done');
  });
});

describe('accessible labels', () => {
  it('reads every label from the shared copy contract', () => {
    expect(toggleLabel('Priya Lunch prep')).toBe(COPY.item.toggle('Priya Lunch prep'));
    expect(removeLabel('Priya Lunch prep')).toBe(COPY.item.delete('Priya Lunch prep'));
  });

  it('keeps the toggle and remove labels distinct for the same task', () => {
    expect(toggleLabel('Alex QA groceries')).not.toBe(removeLabel('Alex QA groceries'));
  });
});

describe('toRowView', () => {
  it('projects every field a row needs from the task', () => {
    const done = tasks[1] as Task;
    expect(toRowView(done)).toEqual({
      id: 'b2',
      title: 'Priya Lunch prep',
      completed: true,
      rowClass: rowClassName(true),
      titleClass: titleClassName(true),
      toggleLabel: COPY.item.toggle('Priya Lunch prep'),
      removeLabel: COPY.item.delete('Priya Lunch prep'),
    });
  });

  it('uses the task id verbatim so it is a stable React key', () => {
    expect(toRowView(tasks[0] as Task).id).toBe('c3');
    expect(toRowView(tasks[2] as Task).id).toBe('a1');
  });
});

describe('toRowViews', () => {
  it('preserves the order it is given (the caller sorts newest first)', () => {
    const views = toRowViews(tasks);
    expect(views.map((view: TaskRowView) => view.id)).toEqual(['c3', 'b2', 'a1']);
    expect(views.map((view: TaskRowView) => view.title)).toEqual([
      'Book dentist run-b7',
      'Priya Lunch prep',
      'Alex QA groceries',
    ]);
  });

  it('produces exactly one view per task and never mutates the input', () => {
    const input: Task[] = [...tasks];
    const views = toRowViews(input);
    expect(views).toHaveLength(input.length);
    views.pop();
    expect(input).toHaveLength(3);
    expect(input[0]).toEqual(tasks[0]);
  });

  it('maps an empty list to an empty list', () => {
    expect(toRowViews([])).toEqual([]);
  });

  it('strikes through exactly the completed rows', () => {
    const struck = toRowViews(tasks).filter((view: TaskRowView) =>
      view.titleClass.includes('task-list__title--done'),
    );
    expect(struck.map((view: TaskRowView) => view.id)).toEqual(['b2']);
  });
});
