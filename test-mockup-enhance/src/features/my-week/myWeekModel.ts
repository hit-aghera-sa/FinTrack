/**
 * THE "MY WEEK" GROUPING RULES.
 *
 * Pure functions, so the whole of the page's behaviour is testable without a
 * DOM: the screen itself only renders what these return.
 *
 * The rules, exactly as agreed:
 *
 *   • A task with NO due date is not part of My week at all (CL-27).
 *   • OVERDUE comes first: due before today AND status not Done, oldest
 *     (most overdue) first (CL-26). An overdue task that is Done is excluded.
 *   • Then TODAY, then TOMORROW, then one group per remaining calendar day of
 *     the 7-day window, labelled with that day's weekday name, in
 *     chronological order. A day with no tasks produces no group.
 *   • Inside a day group: priority High -> Low, then title alphabetically
 *     (CL-25). A Done task still appears in its day group (CL-24).
 *
 * No domain type is declared here: `Task`, `TaskPriority` and `TeamMember`
 * are the project's shared models.
 */

import {
  TASK_PRIORITIES,
  type Task,
  type TaskPriority,
  type TeamMember,
} from '../../models/index.js';

/** The number of calendar days the page covers, counting today. */
export const MY_WEEK_DAYS = 7;

/** Shown when nothing is overdue and nothing falls inside the window. */
export const MY_WEEK_EMPTY_TEXT = 'Nothing due this week';

/** The key and label of the group that always comes first. */
export const OVERDUE_GROUP_KEY = 'overdue';
export const OVERDUE_GROUP_LABEL = 'Overdue';

/** What a row shows when a task carries no assignee. */
export const UNASSIGNED_LABEL = 'Unassigned';

/** What a row shows when the assignee is no longer on the roster. */
export const UNKNOWN_ASSIGNEE_LABEL = 'Unknown member';

/**
 * The weekday names, written down here rather than taken from `Intl`, so a
 * group label is the same in every environment the suite runs in.
 */
const WEEKDAY_NAMES: readonly string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** One rendered group of the page. */
export interface MyWeekGroup {
  /** `overdue`, or the calendar day in `YYYY-MM-DD` form. */
  key: string;
  /** `Overdue`, `Today`, `Tomorrow`, or the day's weekday name. */
  label: string;
  /** True only for the overdue group, which is drawn in the danger tokens. */
  overdue: boolean;
  /** The calendar day this group holds, or null for the overdue group. */
  dayKey: string | null;
  /** The tasks of the group, already in display order. */
  tasks: readonly Task[];
}

/** A date as the calendar day it falls on locally, e.g. `2026-03-10`. */
export function toDayKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const ISO_DAY_PREFIX = /^\d{4}-\d{2}-\d{2}/;

/**
 * The calendar day a task is due on, or null when it has no usable due date.
 * A stored value may be a plain `YYYY-MM-DD` day or a full ISO stamp; the day
 * part is taken verbatim so the grouping never shifts with the time zone.
 */
export function taskDueDay(task: Task): string | null {
  const value = task.dueDate;
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  if (ISO_DAY_PREFIX.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : toDayKey(parsed);
}

/** The calendar day `offset` days after the day `today` falls on. */
export function dayKeyAt(today: Date, offset: number): string {
  return toDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
}

/** `Today`, `Tomorrow`, or the weekday name of the day `offset` days ahead. */
export function dayLabel(today: Date, offset: number): string {
  if (offset === 0) {
    return 'Today';
  }
  if (offset === 1) {
    return 'Tomorrow';
  }
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return WEEKDAY_NAMES[date.getDay()] ?? toDayKey(date);
}

/**
 * The sort rank of a priority: the most urgent level first. Derived from the
 * shared ascending list, so there is no second copy of the three levels.
 */
export function priorityRank(priority: TaskPriority): number {
  const index = TASK_PRIORITIES.indexOf(priority);
  return index === -1 ? TASK_PRIORITIES.length + 1 : TASK_PRIORITIES.length - index;
}

/** Inside a day group: High -> Low, then title alphabetically (CL-25). */
export function compareWithinDay(left: Task, right: Task): number {
  const byPriority = priorityRank(left.priority) - priorityRank(right.priority);
  if (byPriority !== 0) {
    return byPriority;
  }
  return left.title.localeCompare(right.title, 'en');
}

/** Inside the overdue group: oldest due date first (CL-26). */
export function compareOverdue(left: Task, right: Task): number {
  const leftDay = taskDueDay(left) ?? '';
  const rightDay = taskDueDay(right) ?? '';
  if (leftDay !== rightDay) {
    return leftDay < rightDay ? -1 : 1;
  }
  return left.title.localeCompare(right.title, 'en');
}

/** Whether a task is overdue: due before today and not finished. */
export function isOverdueTask(task: Task, today: Date): boolean {
  const day = taskDueDay(task);
  if (day === null) {
    return false;
  }
  return day < toDayKey(today) && task.status !== 'done';
}

/**
 * The groups the page renders, in the order it renders them. A day with no
 * tasks produces no group, and an empty result means the empty state.
 */
export function groupTasksForWeek(tasks: readonly Task[], now: Date): MyWeekGroup[] {
  const todayKey = toDayKey(now);
  const windowKeys: string[] = [];
  for (let offset = 0; offset < MY_WEEK_DAYS; offset += 1) {
    windowKeys.push(dayKeyAt(now, offset));
  }

  const overdue: Task[] = [];
  const byDay = new Map<string, Task[]>();

  for (const task of tasks) {
    const day = taskDueDay(task);
    if (day === null) {
      continue;
    }
    if (day < todayKey) {
      if (task.status !== 'done') {
        overdue.push(task);
      }
      continue;
    }
    if (!windowKeys.includes(day)) {
      continue;
    }
    const bucket = byDay.get(day);
    if (bucket === undefined) {
      byDay.set(day, [task]);
    } else {
      bucket.push(task);
    }
  }

  const groups: MyWeekGroup[] = [];

  if (overdue.length > 0) {
    groups.push({
      key: OVERDUE_GROUP_KEY,
      label: OVERDUE_GROUP_LABEL,
      overdue: true,
      dayKey: null,
      tasks: [...overdue].sort(compareOverdue),
    });
  }

  for (let offset = 0; offset < windowKeys.length; offset += 1) {
    const key = windowKeys[offset] ?? '';
    const bucket = byDay.get(key);
    if (bucket === undefined || bucket.length === 0) {
      continue;
    }
    groups.push({
      key,
      label: dayLabel(now, offset),
      overdue: false,
      dayKey: key,
      tasks: [...bucket].sort(compareWithinDay),
    });
  }

  return groups;
}

/** How many tasks the groups hold in total. */
export function countGroupedTasks(groups: readonly MyWeekGroup[]): number {
  let total = 0;
  for (const group of groups) {
    total += group.tasks.length;
  }
  return total;
}

/** The name a row shows for a task's assignee. */
export function assigneeNameOf(task: Task, members: readonly TeamMember[]): string {
  const assigneeId = task.assigneeId;
  if (assigneeId === null) {
    return UNASSIGNED_LABEL;
  }
  const found = members.find((member: TeamMember): boolean => member.id === assigneeId);
  return found === undefined ? UNKNOWN_ASSIGNEE_LABEL : found.name;
}

/** The "Due …" line of a row. */
export function dueText(task: Task): string {
  const day = taskDueDay(task);
  return day === null ? 'No due date' : `Due ${day}`;
}

/** The line under a group heading: how much work it holds. */
export function groupSummary(group: MyWeekGroup): string {
  const count = group.tasks.length;
  const tasks = count === 1 ? 'one task' : `${String(count)} tasks`;
  return group.overdue ? `${tasks} past their due date` : tasks;
}
