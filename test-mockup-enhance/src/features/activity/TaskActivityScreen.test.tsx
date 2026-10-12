// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import {
  TASK_ACTIVITY_NOT_FOUND,
  TASK_ACTIVITY_TITLE,
  TaskActivityScreen,
} from './TaskActivityScreen.js';
import { ACTIVITY_LOADING_TEXT, NO_ACTIVITY_TITLE } from './ActivityTimeline.js';
import type { TaskActivityClient } from './TaskActivityClient.js';
import { CHANGE_ARROW, type TaskActivity } from './activityModel.js';
import { ApiError } from '../../lib/api/index.js';

const ENTRY: TaskActivity = {
  id: 'activity-one',
  taskId: 'task-one',
  kind: 'status_changed',
  field: 'status',
  from: 'To do',
  to: 'Doing',
  actor: 'Priya Natarajan',
  createdAt: '2026-03-01T10:00:00.000Z',
};

const SUMMARY = `Status: To do ${CHANGE_ARROW} Doing`;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TaskActivityScreen', () => {
  it('loads one task\u2019s activity and renders the timeline', async () => {
    const client: TaskActivityClient = {
      listActivity: vi.fn((): Promise<TaskActivity[]> => Promise.resolve([ENTRY])),
    };

    render(<TaskActivityScreen taskId="task-one" onBack={vi.fn()} client={client} />);

    expect(screen.getByRole('heading', { name: TASK_ACTIVITY_TITLE })).toBeInTheDocument();
    expect(screen.getByText(ACTIVITY_LOADING_TEXT)).toBeInTheDocument();

    expect(await screen.findByText(SUMMARY)).toBeInTheDocument();
    expect(screen.getByText('Status changed')).toBeInTheDocument();
    expect(screen.getByText('Priya Natarajan')).toBeInTheDocument();
    expect(screen.getByText('1 entry')).toBeInTheDocument();
    expect(client.listActivity).toHaveBeenCalledWith('task-one');
  });

  it('shows the empty state for a task with no activity yet', async () => {
    const client: TaskActivityClient = {
      listActivity: vi.fn((): Promise<TaskActivity[]> => Promise.resolve([])),
    };

    render(<TaskActivityScreen taskId="task-one" onBack={vi.fn()} client={client} />);

    expect(await screen.findByText(NO_ACTIVITY_TITLE)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: TASK_ACTIVITY_TITLE })).toBeInTheDocument();
  });

  it('shows the failure and reloads when the reader tries again', async () => {
    let calls = 0;
    const client: TaskActivityClient = {
      listActivity: vi.fn((): Promise<TaskActivity[]> => {
        calls += 1;
        return calls === 1
          ? Promise.reject(new Error('Activity unavailable'))
          : Promise.resolve([ENTRY]);
      }),
    };

    render(<TaskActivityScreen taskId="task-one" onBack={vi.fn()} client={client} />);

    expect(await screen.findByText('Activity unavailable')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(SUMMARY)).toBeInTheDocument();
    await waitFor(() => {
      expect(client.listActivity).toHaveBeenCalledTimes(2);
    });
  });

  it('says so when the task itself does not exist', async () => {
    const client: TaskActivityClient = {
      listActivity: vi.fn(
        (): Promise<TaskActivity[]> =>
          Promise.reject(new ApiError(404, 'That task could not be found.')),
      ),
    };

    render(<TaskActivityScreen taskId="task-missing" onBack={vi.fn()} client={client} />);

    expect(await screen.findByText(TASK_ACTIVITY_NOT_FOUND)).toBeInTheDocument();
  });

  it('offers a back action to the task detail screen', async () => {
    const onBack = vi.fn();
    const client: TaskActivityClient = {
      listActivity: vi.fn((): Promise<TaskActivity[]> => Promise.resolve([ENTRY])),
    };

    render(<TaskActivityScreen taskId="task-one" onBack={onBack} client={client} />);

    expect(await screen.findByText(SUMMARY)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to task' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
