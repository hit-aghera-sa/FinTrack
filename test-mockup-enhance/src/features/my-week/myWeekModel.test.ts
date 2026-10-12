// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  MY_WEEK_DAYS,
  MY_WEEK_EMPTY_TEXT,
  OVERDUE_GROUP_KEY,
  OVERDUE_GROUP_LABEL,
  UNASSIGNED_LABEL,
  UNKNOWN_ASSIGNEE_LABEL,
  assigneeNameOf,
  compareWithinDay,
  dayKeyAt,
  dayLabel,
  dueText,
  groupTasksForWeek,
  isOverdueTask,
  taskDueDay,
  toDayKey,
  type MyWeekGroup,
} from './myWeekModel.js';
import {
  DEFAULT_TASK_PRIORITY,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TeamMemberWithWorkload,
} from '../../models/index.js';

/** Tuesday 10 March 2026, in the runner's own time zone. */
const TODAY = new Date(2026, 2, 10, 9, 0, 0);

interface Fixture {
  id: string;
  title: string;
  dueDate: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
}

function makeTask(fixture: Fixture): Task {
  return {
    id: fixture.id,
    title: fixture.title,
    description: '',
    assigneeId: fixture.assigneeId ?? null,
    dueDate: fixture.dueDate,
    status: fixture.status ?? 'todo',
    priority: fixture.priority ?? DEFAULT_TASK_PRIORITY,
    createdAt: '2026-03-01T09:00:00.000Z',
  };
}

function labelsOf(groups: readonly MyWeekGroup[]): string[] {
  return groups.map((group: MyWeekGroup): string => group.label);
}

function titlesOf(group: MyWeekGroup | undefined): string[] {
  if (group === undefined) {
    throw new Error('The expected group is missing.');
  }
  return group.tasks.map((task: Task): string => task.title);
}

describe('the My week calendar helpers', () => {
  it('covers seven calendar days, counting today', () => {
    expect(MY_WEEK_DAYS).toBe(7);
    expect(dayKeyAt(TODAY, 0)).toBe('2026-03-10');
    expect(dayKeyAt(TODAY, 6)).toBe('2026-03-16');
  });

  it('names today, tomorrow and then the weekday', () => {
    expect(dayLabel(TODAY, 0)).toBe('Today');
    expect(dayLabel(TODAY, 1)).toBe('Tomorrow');
    expect(dayLabel(TODAY, 2)).toBe('Thursday');
    expect(dayLabel(TODAY, 6)).toBe('Monday');
  });

  it('reads the calendar day of a date', () => {
    expect(toDayKey(new Date(2026, 2, 10))).toBe('2026-03-10');
    expect(toDayKey(new Date(2026, 11, 1))).toBe('2026-12-01');
  });

  it('reads the due day of a task, whatever shape the stamp has', () => {
    expect(taskDueDay(makeTask({ id: 't1', title: 'A', dueDate: '2026-04-09' }))).toBe('2026-04-09');
    expect(
      taskDueDay(makeTask({ id: 't2', title: 'B', dueDate: '2026-04-09T22:00:00.000Z' })),
    ).toBe('2026-04-09');
    expect(taskDueDay(makeTask({ id: 't3', title: 'C', dueDate: null }))).toBeNull();
    expect(taskDueDay(makeTask({ id: 't4', title: 'D', dueDate: '   ' }))).toBeNull();
  });

  it('says what a row prints for the due date', () => {
    expect(dueText(makeTask({ id: 't5', title: 'E', dueDate: '2026-03-12' }))).toBe('Due 2026-03-12');
    expect(dueText(makeTask({ id: 't6', title: 'F', dueDate: null }))).toBe('No due date');
  });
});

describe('isOverdueTask', () => {
  it('is true only for a task due before today that is not Done', () => {
    expect(isOverdueTask(makeTask({ id: 'o1', title: 'A', dueDate: '2026-03-09' }), TODAY)).toBe(true);
    expect(
      isOverdueTask(
        makeTask({ id: 'o2', title: 'B', dueDate: '2026-03-09', status: 'done' }),
        TODAY,
      ),
    ).toBe(false);
    expect(isOverdueTask(makeTask({ id: 'o3', title: 'C', dueDate: '2026-03-10' }), TODAY)).toBe(false);
    expect(isOverdueTask(makeTask({ id: 'o4', title: 'D', dueDate: null }), TODAY)).toBe(false);
  });
});

describe('compareWithinDay', () => {
  it('puts the most urgent first, then sorts by title', () => {
    const high = makeTask({ id: 'h', title: 'Zebra brief', dueDate: '2026-03-11', priority: 'High' });
    const low = makeTask({ id: 'l', title: 'Alpha brief', dueDate: '2026-03-11', priority: 'Low' });
    expect(compareWithinDay(high, low)).toBeLessThan(0);

    const alsoHigh = makeTask({
      id: 'h2',
      title: 'Alpha urgent brief',
      dueDate: '2026-03-11',
      priority: 'High',
    });
    expect(compareWithinDay(alsoHigh, high)).toBeLessThan(0);
  });
});

describe('groupTasksForWeek', () => {
  it('groups the window in order, Overdue first', () => {
    const groups = groupTasksForWeek(
      [
        makeTask({ id: 'later', title: 'Alex QA next week', dueDate: '2026-03-17' }),
        makeTask({ id: 'none', title: 'Alex QA someday', dueDate: null }),
        makeTask({ id: 'monday', title: 'Alex QA monday', dueDate: '2026-03-16' }),
        makeTask({ id: 'thursday', title: 'Alex QA thursday', dueDate: '2026-03-12' }),
        makeTask({ id: 'tomorrow', title: 'Alex QA tomorrow', dueDate: '2026-03-11' }),
        makeTask({ id: 'today', title: 'Alex QA today', dueDate: '2026-03-10' }),
        makeTask({ id: 'late', title: 'Alex QA late', dueDate: '2026-03-08' }),
      ],
      TODAY,
    );

    expect(labelsOf(groups)).toEqual([
      OVERDUE_GROUP_LABEL,
      'Today',
      'Tomorrow',
      'Thursday',
      'Monday',
    ]);
    expect(groups[0]?.key).toBe(OVERDUE_GROUP_KEY);
    expect(groups[0]?.overdue).toBe(true);
    expect(groups[1]?.overdue).toBe(false);
    expect(groups[1]?.dayKey).toBe('2026-03-10');
  });

  it('keeps a Done task in its day group but never in Overdue', () => {
    const groups = groupTasksForWeek(
      [
        makeTask({ id: 'done-late', title: 'Priya Lunch shipped late', dueDate: '2026-03-06', status: 'done' }),
        makeTask({ id: 'done-today', title: 'Priya Lunch shipped today', dueDate: '2026-03-10', status: 'done' }),
      ],
      TODAY,
    );

    expect(labelsOf(groups)).toEqual(['Today']);
    expect(titlesOf(groups[0])).toEqual(['Priya Lunch shipped today']);
  });

  it('lists overdue tasks oldest first', () => {
    const groups = groupTasksForWeek(
      [
        makeTask({ id: 'late-b', title: 'Alex QA overdue late', dueDate: '2026-03-08', priority: 'High' }),
        makeTask({ id: 'late-a', title: 'Alex QA overdue early', dueDate: '2026-03-05', priority: 'Low' }),
      ],
      TODAY,
    );

    expect(titlesOf(groups[0])).toEqual(['Alex QA overdue early', 'Alex QA overdue late']);
  });

  it('sorts a day group by priority, then by title', () => {
    const groups = groupTasksForWeek(
      [
        makeTask({ id: 'z', title: 'Zebra tomorrow brief', dueDate: '2026-03-11', priority: 'High' }),
        makeTask({ id: 'm', title: 'Mid tomorrow brief', dueDate: '2026-03-11', priority: 'Low' }),
        makeTask({ id: 'a', title: 'Alpha tomorrow brief', dueDate: '2026-03-11', priority: 'High' }),
      ],
      TODAY,
    );

    expect(titlesOf(groups[0])).toEqual([
      'Alpha tomorrow brief',
      'Zebra tomorrow brief',
      'Mid tomorrow brief',
    ]);
  });

  it('produces no groups at all when nothing is due in the window', () => {
    expect(
      groupTasksForWeek(
        [
          makeTask({ id: 'later', title: 'Alex QA next week', dueDate: '2026-03-20' }),
          makeTask({ id: 'none', title: 'Alex QA someday', dueDate: null }),
        ],
        TODAY,
      ),
    ).toEqual([]);
    expect(MY_WEEK_EMPTY_TEXT).toBe('Nothing due this week');
  });
});

describe('assigneeNameOf', () => {
  const members: TeamMemberWithWorkload[] = [
    { id: 'member-priya', name: 'Priya Lunch', role: 'Engineering Lead', openTaskCount: 2 },
  ];

  it('names the assignee, or says there is none', () => {
    expect(
      assigneeNameOf(
        makeTask({ id: 'a', title: 'A', dueDate: '2026-03-10', assigneeId: 'member-priya' }),
        members,
      ),
    ).toBe('Priya Lunch');
    expect(assigneeNameOf(makeTask({ id: 'b', title: 'B', dueDate: '2026-03-10' }), members)).toBe(
      UNASSIGNED_LABEL,
    );
    expect(
      assigneeNameOf(
        makeTask({ id: 'c', title: 'C', dueDate: '2026-03-10', assigneeId: 'member-gone' }),
        members,
      ),
    ).toBe(UNKNOWN_ASSIGNEE_LABEL);
  });
});
