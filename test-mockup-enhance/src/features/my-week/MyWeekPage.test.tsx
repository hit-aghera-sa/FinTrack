// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { MyWeekView } from './MyWeekPage.js';
import type { MyWeekTasksClient } from './myWeekClient.js';
import { MY_WEEK_EMPTY_TEXT } from './myWeekModel.js';
import { ApiError } from '../../lib/api/index.js';
import {
  DEFAULT_TASK_PRIORITY,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TeamMemberWithWorkload,
} from '../../models/index.js';

/** Tuesday 10 March 2026, in the runner's own time zone. */
const TODAY = new Date(2026, 2, 10, 9, 0, 0);

function now(): Date {
  return new Date(TODAY.getTime());
}

const MEMBERS: TeamMemberWithWorkload[] = [
  { id: 'member-priya', name: 'Priya Lunch', role: 'Engineering Lead', openTaskCount: 3 },
];

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

/** A stub implementing the whole reader surface. */
function createStub(tasks: readonly Task[]) {
  return {
    listTasks: vi.fn(
      (): Promise<Task[]> => Promise.resolve(tasks.map((task: Task): Task => ({ ...task }))),
    ),
    listMembers: vi.fn(
      (): Promise<TeamMemberWithWorkload[]> =>
        Promise.resolve(
          MEMBERS.map((member: TeamMemberWithWorkload): TeamMemberWithWorkload => ({ ...member })),
        ),
    ),
  };
}

const WEEK: Task[] = [
  makeTask({ id: 'task-late-b', title: 'Alex QA overdue late', dueDate: '2026-03-08', status: 'doing', priority: 'High' }),
  makeTask({ id: 'task-late-a', title: 'Alex QA overdue early', dueDate: '2026-03-05', priority: 'Low' }),
  makeTask({ id: 'task-late-done', title: 'Alex QA overdue shipped', dueDate: '2026-03-06', status: 'done' }),
  makeTask({
    id: 'task-today',
    title: 'Priya Lunch today brief',
    dueDate: '2026-03-10',
    priority: 'High',
    assigneeId: 'member-priya',
  }),
  makeTask({ id: 'task-today-done', title: 'Priya Lunch shipped today', dueDate: '2026-03-10', status: 'done' }),
  makeTask({ id: 'task-tomorrow-z', title: 'Zebra tomorrow brief', dueDate: '2026-03-11', priority: 'High' }),
  makeTask({ id: 'task-tomorrow-a', title: 'Alpha tomorrow brief', dueDate: '2026-03-11', priority: 'High' }),
  makeTask({ id: 'task-tomorrow-m', title: 'Mid tomorrow brief', dueDate: '2026-03-11', priority: 'Low' }),
  makeTask({ id: 'task-thursday', title: 'Alex QA thursday brief', dueDate: '2026-03-12' }),
  makeTask({ id: 'task-monday', title: 'Alex QA monday brief', dueDate: '2026-03-16' }),
  makeTask({ id: 'task-later', title: 'Alex QA next week brief', dueDate: '2026-03-17' }),
  makeTask({ id: 'task-no-due', title: 'Alex QA someday brief', dueDate: null }),
];

function groupByLabel(label: string): HTMLElement {
  const found = screen
    .getAllByTestId('my-week-group')
    .find((group: HTMLElement): boolean => group.getAttribute('data-group-label') === label);
  if (found === undefined) {
    throw new Error(`No group labelled ${label} was rendered.`);
  }
  return found;
}

function rowTitles(group: HTMLElement): string[] {
  return within(group)
    .getAllByTestId('my-week-row')
    .map((row: HTMLElement): string =>
      (row.querySelector('.my-week-row-title')?.textContent ?? '').trim(),
    );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MyWeekView', () => {
  it('heads the page and reads the tasks from the board API', async () => {
    const stub = createStub(WEEK);
    const client: MyWeekTasksClient = stub;

    render(<MyWeekView onOpenTask={vi.fn()} client={client} now={now} />);

    expect(await screen.findByText('My week')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Board' })).toBeInTheDocument();
    expect(stub.listTasks).toHaveBeenCalledTimes(1);
    expect(stub.listMembers).toHaveBeenCalledTimes(1);
  });

  it('groups the window in order: Overdue, Today, Tomorrow, then each weekday', async () => {
    const client: MyWeekTasksClient = createStub(WEEK);

    render(<MyWeekView onOpenTask={vi.fn()} client={client} now={now} />);

    const groups = await screen.findAllByTestId('my-week-group');
    expect(
      groups.map((group: HTMLElement): string | null => group.getAttribute('data-group-label')),
    ).toEqual(['Overdue', 'Today', 'Tomorrow', 'Thursday', 'Monday']);

    // A day group sorts High -> Low, then by title…
    expect(rowTitles(groupByLabel('Tomorrow'))).toEqual([
      'Alpha tomorrow brief',
      'Zebra tomorrow brief',
      'Mid tomorrow brief',
    ]);

    // …a Done task still appears in its day group…
    expect(rowTitles(groupByLabel('Today'))).toEqual([
      'Priya Lunch today brief',
      'Priya Lunch shipped today',
    ]);

    // …and nothing outside the seven days, and nothing without a due date, is listed.
    expect(screen.queryByText('Alex QA next week brief')).toBeNull();
    expect(screen.queryByText('Alex QA someday brief')).toBeNull();
  });

  it('puts the overdue tasks first, oldest first, and leaves out the Done one', async () => {
    const client: MyWeekTasksClient = createStub(WEEK);

    render(<MyWeekView onOpenTask={vi.fn()} client={client} now={now} />);

    await screen.findAllByTestId('my-week-group');
    const overdue = groupByLabel('Overdue');

    expect(overdue).toHaveAttribute('data-overdue', 'yes');
    expect(overdue.className).toContain('my-week-group--overdue');
    expect(within(overdue).getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
    expect(rowTitles(overdue)).toEqual(['Alex QA overdue early', 'Alex QA overdue late']);
    expect(screen.queryByText('Alex QA overdue shipped')).toBeNull();
  });

  it('shows the title, the assignee, the priority and the status on a row', async () => {
    const client: MyWeekTasksClient = createStub([
      makeTask({
        id: 'task-today',
        title: 'Priya Lunch today brief',
        dueDate: '2026-03-10',
        priority: 'High',
        assigneeId: 'member-priya',
      }),
    ]);

    render(<MyWeekView onOpenTask={vi.fn()} client={client} now={now} />);

    const rows = await screen.findAllByTestId('my-week-row');
    const first = rows[0];
    if (first === undefined) {
      throw new Error('The first row is missing.');
    }

    expect(within(first).getByText('Priya Lunch today brief')).toBeInTheDocument();
    expect(within(first).getByText('Priya Lunch')).toBeInTheDocument();
    expect(within(first).getByText('High')).toBeInTheDocument();
    expect(within(first).getByText('To do')).toBeInTheDocument();
    expect(within(first).getByText('Due 2026-03-10')).toBeInTheDocument();
  });

  it('reports the clicked task upward and navigates nowhere itself', async () => {
    const onOpenTask = vi.fn();
    const client: MyWeekTasksClient = createStub(WEEK);

    render(<MyWeekView onOpenTask={onOpenTask} client={client} now={now} />);

    const row = await screen.findByRole('button', { name: /Zebra tomorrow brief/ });
    fireEvent.click(row);

    expect(onOpenTask).toHaveBeenCalledTimes(1);
    expect(onOpenTask).toHaveBeenCalledWith('task-tomorrow-z');
  });

  it('says "Nothing due this week" when the window is empty', async () => {
    const client: MyWeekTasksClient = createStub([
      makeTask({ id: 'task-later', title: 'Alex QA next week brief', dueDate: '2026-03-20' }),
      makeTask({ id: 'task-no-due', title: 'Alex QA someday brief', dueDate: null }),
    ]);

    render(<MyWeekView onOpenTask={vi.fn()} client={client} now={now} />);

    expect(await screen.findByText(MY_WEEK_EMPTY_TEXT)).toBeInTheDocument();
    expect(screen.queryAllByTestId('my-week-group')).toHaveLength(0);
  });

  it('says what went wrong when the tasks cannot be read', async () => {
    const stub = createStub([]);
    stub.listTasks.mockImplementation(
      (): Promise<Task[]> => Promise.reject(new ApiError(500, 'The board is unavailable.')),
    );
    const client: MyWeekTasksClient = stub;

    render(<MyWeekView onOpenTask={vi.fn()} client={client} now={now} />);

    expect(await screen.findByText('The board is unavailable.')).toBeInTheDocument();
    expect(screen.getByText('My week')).toBeInTheDocument();
  });
});
