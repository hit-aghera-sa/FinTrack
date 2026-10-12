// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ACTIVITY_LOADING_TEXT, ActivityTimeline, NO_ACTIVITY_TITLE } from './ActivityTimeline.js';
import {
  CHANGE_ARROW,
  NOT_SET_TEXT,
  TASK_ACTIVITY_KINDS,
  TASK_ACTIVITY_LABELS,
  UNKNOWN_ACTIVITY_LABEL,
  UNKNOWN_ACTOR_TEXT,
  type TaskActivity,
} from './activityModel.js';

/** A fixed "now", so the relative timestamps are the same on every run. */
const NOW = Date.parse('2026-03-01T12:00:00.000Z');

function entry(overrides: Partial<TaskActivity> = {}): TaskActivity {
  const base: TaskActivity = {
    id: 'activity-one',
    taskId: 'task-one',
    kind: 'status_changed',
    field: 'status',
    from: 'To do',
    to: 'Doing',
    actor: 'Priya Natarajan',
    createdAt: '2026-03-01T10:00:00.000Z',
  };
  return { ...base, ...overrides };
}

afterEach(() => {
  cleanup();
});

describe('ActivityTimeline', () => {
  it('renders one entry per kind, each with its own written label', () => {
    const entries = TASK_ACTIVITY_KINDS.map((kind: string, index: number) =>
      entry({
        id: `activity-${kind}`,
        kind,
        field: null,
        from: 'Low',
        to: 'High',
        createdAt: `2026-03-01T0${String(index)}:00:00.000Z`,
      }),
    );

    render(<ActivityTimeline entries={entries} now={NOW} />);

    for (const kind of TASK_ACTIVITY_KINDS) {
      expect(screen.getByText(TASK_ACTIVITY_LABELS[kind])).toBeInTheDocument();
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(TASK_ACTIVITY_KINDS.length);
  });

  it('shows the change as from -> to with the actor and a relative timestamp', () => {
    render(<ActivityTimeline entries={[entry()]} now={NOW} />);

    expect(screen.getByText('Status changed')).toBeInTheDocument();
    expect(screen.getByText(`Status: To do ${CHANGE_ARROW} Doing`)).toBeInTheDocument();
    expect(screen.getByText('Priya Natarajan')).toBeInTheDocument();
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
  });

  it('names the value that was cleared and the actor it does not know', () => {
    render(
      <ActivityTimeline
        entries={[
          entry({
            id: 'activity-due',
            kind: 'due_date_changed',
            field: 'dueDate',
            from: '2026-02-18',
            to: null,
            actor: '   ',
          }),
        ]}
        now={NOW}
      />,
    );

    expect(screen.getByText('Due date changed')).toBeInTheDocument();
    expect(
      screen.getByText(`Due date: 2026-02-18 ${CHANGE_ARROW} ${NOT_SET_TEXT}`),
    ).toBeInTheDocument();
    expect(screen.getByText(UNKNOWN_ACTOR_TEXT)).toBeInTheDocument();
  });

  it('shows a comment entry as the comment itself', () => {
    render(
      <ActivityTimeline
        entries={[
          entry({
            id: 'activity-comment',
            kind: 'comment_added',
            field: null,
            from: null,
            to: 'Checked with the designer, ready to go.',
          }),
        ]}
        now={NOW}
      />,
    );

    expect(screen.getByText('Comment added')).toBeInTheDocument();
    expect(screen.getByText('Checked with the designer, ready to go.')).toBeInTheDocument();
  });

  it('falls back to a neutral label for a kind it does not know', () => {
    render(
      <ActivityTimeline
        entries={[entry({ id: 'activity-odd', kind: 'archived', field: null, from: null, to: null })]}
        now={NOW}
      />,
    );

    expect(screen.getByText(UNKNOWN_ACTIVITY_LABEL)).toBeInTheDocument();
  });

  it('lists the entries newest first, whatever order it is handed', () => {
    const older = entry({
      id: 'activity-older',
      kind: 'created',
      field: null,
      from: null,
      to: null,
      createdAt: '2026-02-26T09:00:00.000Z',
    });
    const newer = entry({ id: 'activity-newer', createdAt: '2026-03-01T11:30:00.000Z' });

    render(<ActivityTimeline entries={[older, newer]} now={NOW} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent ?? '').toContain('Status changed');
    expect(items[1]?.textContent ?? '').toContain('Task created');
  });

  it('renders the loading state while the entries are on their way', () => {
    render(<ActivityTimeline entries={[]} loading now={NOW} />);

    expect(screen.getByRole('status')).toHaveTextContent(ACTIVITY_LOADING_TEXT);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders the empty state when there is no activity yet', () => {
    render(<ActivityTimeline entries={[]} now={NOW} />);

    expect(screen.getByText(NO_ACTIVITY_TITLE)).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders the error state and offers a retry', () => {
    const onRetry = vi.fn();

    render(
      <ActivityTimeline
        entries={[]}
        error="The activity could not be loaded."
        onRetry={onRetry}
        now={NOW}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('The activity could not be loaded.');
    expect(screen.queryByText(NO_ACTIVITY_TITLE)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
