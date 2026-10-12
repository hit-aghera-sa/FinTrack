// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { TaskDetailView, type TaskDetailApi } from './TaskDetailPage.js';
import { ApiError } from '../../lib/api/index.js';
import type { TaskComment } from '../../models/comment.js';
import type { TeamMemberWithWorkload } from '../../models/member.js';
import { DEFAULT_TASK_PRIORITY, type Task, type TaskUpdate } from '../../models/task.js';

/**
 * The shared label picker reads the label roster from `GET /api/labels` itself,
 * which is a real network call this screen's unit tests must not make. It is
 * stood in for by a tiny stub that reports the selection the screen handed it
 * and offers two ways to change it: attaching an existing label, and creating a
 * brand-new one — which the real picker also reports through `onChange`, so a
 * label created inside the picker is attached to the task being edited.
 */
vi.mock('../labels/index.js', () => ({
  LabelPicker: ({
    selectedIds,
    onChange,
  }: {
    selectedIds: readonly string[];
    onChange: (ids: readonly string[]) => void;
  }): JSX.Element => (
    <div>
      <span data-testid="label-selection">{selectedIds.join(' ')}</span>
      <button
        type="button"
        onClick={() => {
          onChange([...selectedIds, 'label-urgent']);
        }}
      >
        Attach the Urgent label
      </button>
      <button
        type="button"
        onClick={() => {
          onChange([...selectedIds, 'label-spike']);
        }}
      >
        Create the Spike label
      </button>
    </div>
  ),
}));

const MEMBERS: TeamMemberWithWorkload[] = [
  { id: 'member-one', name: 'Priya Natarajan', role: 'Engineering Lead', openTaskCount: 3 },
  { id: 'member-two', name: 'Dan Okafor', role: 'Backend Engineer', openTaskCount: 2 },
];

function makeTask(overrides: Partial<Task> = {}): Task {
  const base: Task = {
    id: 'task-ten',
    title: 'Draft the onboarding email',
    description: 'Write the welcome copy.',
    assigneeId: 'member-one',
    dueDate: '2026-02-18',
    status: 'todo',
    priority: DEFAULT_TASK_PRIORITY,
    createdAt: '2026-02-01T09:00:00.000Z',
  };
  return { ...base, ...overrides };
}

function createStub(task: Task, comments: readonly TaskComment[]) {
  let current: Task = task;
  const thread: TaskComment[] = [...comments];
  return {
    getTask: vi.fn((_id: string): Promise<Task> => Promise.resolve(current)),
    listComments: vi.fn((_id: string): Promise<TaskComment[]> => Promise.resolve([...thread])),
    listMembers: vi.fn((): Promise<TeamMemberWithWorkload[]> => Promise.resolve([...MEMBERS])),
    updateTask: vi.fn((_id: string, patch: TaskUpdate): Promise<Task> => {
      // The stub keeps only the task's own fields; the label set is a write the
      // real backend applies to the join table and echoes back as `labels`.
      current = {
        ...current,
        title: patch.title ?? current.title,
        description: patch.description ?? current.description,
        assigneeId: patch.assigneeId === undefined ? current.assigneeId : patch.assigneeId,
        dueDate: patch.dueDate === undefined ? current.dueDate : patch.dueDate,
        status: patch.status ?? current.status,
        priority: patch.priority ?? current.priority,
      };
      return Promise.resolve(current);
    }),
    addComment: vi.fn((id: string, body: string): Promise<TaskComment> => {
      const created: TaskComment = {
        id: 'comment-new',
        taskId: id,
        body,
        createdAt: '2026-02-05T10:00:00.000Z',
      };
      thread.push(created);
      return Promise.resolve(created);
    }),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TaskDetailView', () => {
  it('saves edits to every editable field through the API client', async () => {
    const stub = createStub(makeTask(), []);
    const onBack = vi.fn();
    const client: TaskDetailApi = stub;

    render(<TaskDetailView taskId="task-ten" onBack={onBack} client={client} />);

    expect(await screen.findByLabelText('Title')).toHaveValue('Draft the onboarding email');
    expect(screen.getByText('Task detail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to board' })).toBeInTheDocument();
    expect(screen.getByTestId('task-detail-status')).toHaveTextContent('To do');
    expect(screen.getByLabelText('Priority')).toHaveValue(DEFAULT_TASK_PRIORITY);

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Draft the onboarding email run-b7' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Welcome copy, reviewed with design.' },
    });
    fireEvent.change(screen.getByLabelText('Assignee'), { target: { value: 'member-two' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-03-02' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'doing' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(stub.updateTask).toHaveBeenCalledTimes(1);
    });
    expect(stub.updateTask).toHaveBeenCalledWith('task-ten', {
      title: 'Draft the onboarding email run-b7',
      description: 'Welcome copy, reviewed with design.',
      assigneeId: 'member-two',
      dueDate: '2026-03-02',
      status: 'doing',
      priority: DEFAULT_TASK_PRIORITY,
      labelIds: [],
    });

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Draft the onboarding email run-b7');
    expect(screen.getByLabelText('Assignee')).toHaveValue('member-two');
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-03-02');
    expect(screen.getByLabelText('Status')).toHaveValue('doing');
    expect(screen.getByTestId('task-detail-status')).toHaveTextContent('Doing');
  });

  it('shows the stored priority and saves a change to it', async () => {
    const stub = createStub(makeTask({ priority: 'High' }), []);
    const client: TaskDetailApi = stub;

    render(<TaskDetailView taskId="task-ten" onBack={vi.fn()} client={client} />);

    expect(await screen.findByLabelText('Priority')).toHaveValue('High');

    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'Low' } });
    expect(screen.getByLabelText('Priority')).toHaveValue('Low');

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(stub.updateTask).toHaveBeenCalledTimes(1);
    });
    expect(stub.updateTask).toHaveBeenCalledWith('task-ten', {
      title: 'Draft the onboarding email',
      description: 'Write the welcome copy.',
      assigneeId: 'member-one',
      dueDate: '2026-02-18',
      status: 'todo',
      priority: 'Low',
      labelIds: [],
    });

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority')).toHaveValue('Low');
  });

  it('offers the labels field for the loaded task', async () => {
    const stub = createStub(makeTask(), []);
    const client: TaskDetailApi = stub;

    render(<TaskDetailView taskId="task-ten" onBack={vi.fn()} client={client} />);

    expect(await screen.findByLabelText('Title')).toHaveValue('Draft the onboarding email');
    expect(screen.getByText('Labels')).toBeInTheDocument();
    expect(screen.getByTestId('label-selection')).toHaveTextContent('');
  });

  it('saves an edited label set as labelIds in the patch', async () => {
    const stub = createStub(makeTask(), []);
    const client: TaskDetailApi = stub;

    render(<TaskDetailView taskId="task-ten" onBack={vi.fn()} client={client} />);

    expect(await screen.findByLabelText('Title')).toHaveValue('Draft the onboarding email');

    fireEvent.click(screen.getByRole('button', { name: 'Attach the Urgent label' }));
    expect(screen.getByTestId('label-selection')).toHaveTextContent('label-urgent');

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(stub.updateTask).toHaveBeenCalledTimes(1);
    });
    expect(stub.updateTask).toHaveBeenCalledWith('task-ten', {
      title: 'Draft the onboarding email',
      description: 'Write the welcome copy.',
      assigneeId: 'member-one',
      dueDate: '2026-02-18',
      status: 'todo',
      priority: DEFAULT_TASK_PRIORITY,
      labelIds: ['label-urgent'],
    });

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    expect(screen.getByTestId('label-selection')).toHaveTextContent('label-urgent');
  });

  it('attaches a label created inside the picker and saves it with the task', async () => {
    const stub = createStub(makeTask(), []);
    const client: TaskDetailApi = stub;

    render(<TaskDetailView taskId="task-ten" onBack={vi.fn()} client={client} />);

    expect(await screen.findByLabelText('Title')).toHaveValue('Draft the onboarding email');

    fireEvent.click(screen.getByRole('button', { name: 'Create the Spike label' }));
    expect(screen.getByTestId('label-selection')).toHaveTextContent('label-spike');

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(stub.updateTask).toHaveBeenCalledWith('task-ten', {
        title: 'Draft the onboarding email',
        description: 'Write the welcome copy.',
        assigneeId: 'member-one',
        dueDate: '2026-02-18',
        status: 'todo',
        priority: DEFAULT_TASK_PRIORITY,
        labelIds: ['label-spike'],
      });
    });
  });

  it('persists a new comment and appends it to the thread', async () => {
    const existing: TaskComment = {
      id: 'comment-one',
      taskId: 'task-ten',
      body: 'Checked the brand tone with Mei.',
      createdAt: '2026-02-02T08:30:00.000Z',
    };
    const stub = createStub(makeTask(), [existing]);
    const client: TaskDetailApi = stub;

    render(<TaskDetailView taskId="task-ten" onBack={vi.fn()} client={client} />);

    expect(await screen.findByText('Checked the brand tone with Mei.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Add a comment'), {
      target: { value: 'Copy approved by Priya.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));

    await waitFor(() => {
      expect(stub.addComment).toHaveBeenCalledWith('task-ten', 'Copy approved by Priya.');
    });

    expect(await screen.findByText('Copy approved by Priya.')).toBeInTheDocument();
    expect(screen.getByText('Checked the brand tone with Mei.')).toBeInTheDocument();
    expect(screen.getByLabelText('Add a comment')).toHaveValue('');
  });

  it('shows a not-found state, with the header and back action, for a missing task', async () => {
    const stub = createStub(makeTask(), []);
    stub.getTask.mockImplementation(
      (): Promise<Task> => Promise.reject(new ApiError(404, 'That task could not be found.')),
    );
    const onBack = vi.fn();
    const client: TaskDetailApi = stub;

    render(<TaskDetailView taskId="task-missing" onBack={onBack} client={client} />);

    expect(await screen.findByText('Task not found')).toBeInTheDocument();
    expect(screen.getByText('Task detail')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to board' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
