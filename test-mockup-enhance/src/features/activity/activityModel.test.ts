import { describe, expect, it } from 'vitest';

import {
  CHANGE_ARROW,
  NOT_SET_TEXT,
  TASK_ACTIVITY_ICONS,
  TASK_ACTIVITY_KINDS,
  TASK_ACTIVITY_LABELS,
  TASK_ACTIVITY_ROUTE,
  UNKNOWN_ACTIVITY_ICON,
  UNKNOWN_ACTIVITY_LABEL,
  UNKNOWN_ACTOR_TEXT,
  activityActorName,
  activityKindIcon,
  activityKindLabel,
  changeSummary,
  decodeTaskActivityList,
  isTaskActivityKind,
  relativeTime,
  sortNewestFirst,
  taskActivityRoutePath,
  type TaskActivity,
} from './activityModel.js';

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

describe('activity kinds', () => {
  it('labels and marks every kind it knows', () => {
    for (const kind of TASK_ACTIVITY_KINDS) {
      expect(TASK_ACTIVITY_LABELS[kind].length).toBeGreaterThan(0);
      expect(TASK_ACTIVITY_ICONS[kind].length).toBeGreaterThan(0);
      expect(activityKindLabel(kind)).toBe(TASK_ACTIVITY_LABELS[kind]);
      expect(activityKindIcon(kind)).toBe(TASK_ACTIVITY_ICONS[kind]);
    }
  });

  it('gives every kind a label of its own', () => {
    const labels = TASK_ACTIVITY_KINDS.map((kind) => TASK_ACTIVITY_LABELS[kind]);
    expect(new Set(labels).size).toBe(TASK_ACTIVITY_KINDS.length);
  });

  it('recognises only the known kinds', () => {
    expect(isTaskActivityKind('status_changed')).toBe(true);
    expect(isTaskActivityKind('Status_changed')).toBe(false);
    expect(isTaskActivityKind('archived')).toBe(false);
    expect(isTaskActivityKind(undefined)).toBe(false);
  });

  it('falls back for a kind it does not know', () => {
    expect(activityKindLabel('archived')).toBe(UNKNOWN_ACTIVITY_LABEL);
    expect(activityKindIcon('archived')).toBe(UNKNOWN_ACTIVITY_ICON);
  });

  it('registers the activity screen under the task route', () => {
    expect(TASK_ACTIVITY_ROUTE).toBe('/tasks/:id/activity');
    expect(taskActivityRoutePath('task-one')).toBe('/tasks/task-one/activity');
    expect(taskActivityRoutePath('task one/two')).toBe('/tasks/task%20one%2Ftwo/activity');
  });
});

describe('changeSummary', () => {
  it('reads a change as from -> to', () => {
    expect(changeSummary(entry())).toBe(`Status: To do ${CHANGE_ARROW} Doing`);
  });

  it('names the missing side of a change', () => {
    expect(
      changeSummary(entry({ kind: 'assignee_changed', field: 'assigneeId', from: null, to: 'Dan Okafor' })),
    ).toBe(`Assignee: ${NOT_SET_TEXT} ${CHANGE_ARROW} Dan Okafor`);
    expect(
      changeSummary(entry({ kind: 'due_date_changed', field: 'dueDate', from: '2026-02-18', to: null })),
    ).toBe(`Due date: 2026-02-18 ${CHANGE_ARROW} ${NOT_SET_TEXT}`);
  });

  it('has no summary for an entry that records no values', () => {
    expect(changeSummary(entry({ kind: 'created', field: null, from: null, to: null }))).toBeNull();
  });

  it('shows a comment as the comment itself', () => {
    expect(
      changeSummary(entry({ kind: 'comment_added', field: null, from: null, to: 'Ready for review.' })),
    ).toBe('Ready for review.');
  });

  it('humanises a field it was handed for an unknown kind', () => {
    expect(changeSummary(entry({ kind: 'moved', field: 'board_column', from: 'A', to: 'B' }))).toBe(
      `Board column: A ${CHANGE_ARROW} B`,
    );
  });
});

describe('activityActorName', () => {
  it('keeps the recorded actor', () => {
    expect(activityActorName(entry())).toBe('Priya Natarajan');
  });

  it('stands in for an entry with no actor', () => {
    expect(activityActorName(entry({ actor: '  ' }))).toBe(UNKNOWN_ACTOR_TEXT);
  });
});

describe('relativeTime', () => {
  it('reads a fresh entry as just now', () => {
    expect(relativeTime('2026-03-01T11:59:40.000Z', NOW)).toBe('just now');
  });

  it('counts minutes, hours and days', () => {
    expect(relativeTime('2026-03-01T11:59:00.000Z', NOW)).toBe('1 minute ago');
    expect(relativeTime('2026-03-01T11:55:00.000Z', NOW)).toBe('5 minutes ago');
    expect(relativeTime('2026-03-01T09:00:00.000Z', NOW)).toBe('3 hours ago');
    expect(relativeTime('2026-02-27T12:00:00.000Z', NOW)).toBe('2 days ago');
  });

  it('counts weeks, months and years', () => {
    expect(relativeTime('2026-02-09T12:00:00.000Z', NOW)).toBe('2 weeks ago');
    expect(relativeTime('2025-12-31T12:00:00.000Z', NOW)).toBe('2 months ago');
    expect(relativeTime('2024-11-01T12:00:00.000Z', NOW)).toBe('1 year ago');
  });

  it('returns an unreadable stamp as it was given', () => {
    expect(relativeTime('next tuesday-ish', NOW)).toBe('next tuesday-ish');
  });
});

describe('sortNewestFirst', () => {
  it('puts the newest entry first', () => {
    const older = entry({ id: 'activity-older', createdAt: '2026-02-20T08:00:00.000Z' });
    const newer = entry({ id: 'activity-newer', createdAt: '2026-03-01T11:00:00.000Z' });

    expect(sortNewestFirst([older, newer]).map((row: TaskActivity): string => row.id)).toEqual([
      'activity-newer',
      'activity-older',
    ]);
  });
});

describe('decodeTaskActivityList', () => {
  it('reads the payload the activity endpoint answers with', () => {
    const decoded = decodeTaskActivityList([
      {
        id: 'activity-one',
        taskId: 'task-one',
        kind: 'status_changed',
        field: 'status',
        from: 'To do',
        to: 'Doing',
        actor: 'Priya Natarajan',
        createdAt: '2026-03-01T10:00:00.000Z',
      },
    ]);

    expect(decoded).toHaveLength(1);
    expect(decoded[0]?.kind).toBe('status_changed');
    expect(decoded[0]?.from).toBe('To do');
    expect(decoded[0]?.actor).toBe('Priya Natarajan');
  });

  it('accepts the alternative spellings of the same fields', () => {
    const decoded = decodeTaskActivityList([
      {
        id: 'activity-two',
        task_id: 'task-one',
        type: 'priority_changed',
        field_name: 'priority',
        fromValue: 'Medium',
        toValue: 'High',
        actorName: 'Dan Okafor',
        created_at: '2026-03-01T09:00:00.000Z',
      },
    ]);

    expect(decoded[0]).toEqual({
      id: 'activity-two',
      taskId: 'task-one',
      kind: 'priority_changed',
      field: 'priority',
      from: 'Medium',
      to: 'High',
      actor: 'Dan Okafor',
      createdAt: '2026-03-01T09:00:00.000Z',
    });
  });

  it('reads a list out of an envelope and drops anything malformed', () => {
    const decoded = decodeTaskActivityList({
      activity: [{ id: 'activity-three', kind: 'created' }, { kind: 'created' }, 'not an entry'],
    });

    expect(decoded).toHaveLength(1);
    expect(decoded[0]?.id).toBe('activity-three');
    expect(decoded[0]?.actor).toBe('');
  });

  it('reads nothing out of a payload that carries no list', () => {
    expect(decodeTaskActivityList(null)).toEqual([]);
    expect(decodeTaskActivityList({ message: 'nope' })).toEqual([]);
  });
});
