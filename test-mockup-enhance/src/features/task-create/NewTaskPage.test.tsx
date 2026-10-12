// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NewTaskPage, type NewTaskApi } from './NewTaskPage.js';
import type { TeamMemberWithWorkload } from '../../models/member.js';
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  TASK_PRIORITIES,
  type NewTask,
  type Task,
} from '../../models/task.js';

/**
 * The shared label picker loads the label roster from `GET /api/labels` itself,
 * which is a real network call this screen's unit tests must not make. It is
 * stood in for by a tiny stub that reports the current selection and offers two
 * ways to change it: attaching an existing label, and creating a brand-new one
 * (which the real picker also reports through `onChange`, so the new label is
 * attached to the task being created straight away).
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
  { id: 'member-priya', name: 'Priya Natarajan', role: 'Engineering Lead', openTaskCount: 3 },
  { id: 'member-dan', name: 'Dan Okafor', role: 'Backend Engineer', openTaskCount: 2 },
];

/** The task the stubbed backend answers with for a create call. */
function taskFrom(input: NewTask): Task {
  return {
    id: 'task-run-b7',
    title: input.title,
    description: input.description ?? '',
    assigneeId: input.assigneeId ?? null,
    dueDate: input.dueDate ?? null,
    status: input.status ?? DEFAULT_TASK_STATUS,
    priority: input.priority ?? DEFAULT_TASK_PRIORITY,
    createdAt: '2026-02-01T09:00:00.000Z',
  };
}

afterEach(() => {
  cleanup();
});

describe('NewTaskPage', () => {
  it('reports a blank title inline, keeps the default status and does not submit', async () => {
    const listMembers = vi.fn(() => Promise.resolve(MEMBERS));
    const createTask = vi.fn((input: NewTask) => Promise.resolve(taskFrom(input)));
    const onCreated = vi.fn();
    const onCancel = vi.fn();
    const api: NewTaskApi = { listMembers, createTask };

    render(<NewTaskPage onCreated={onCreated} onCancel={onCancel} api={api} />);

    // The assignee select is restricted to the roster loaded from the API.
    expect(await screen.findByRole('option', { name: 'Priya Natarajan' })).not.toBeNull();

    const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
    expect(statusSelect.value).toBe(DEFAULT_TASK_STATUS);

    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));

    expect(await screen.findByText('Enter a title for the task.')).not.toBeNull();
    expect(createTask).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('offers the three priorities and starts on Medium', async () => {
    const listMembers = vi.fn(() => Promise.resolve(MEMBERS));
    const createTask = vi.fn((input: NewTask) => Promise.resolve(taskFrom(input)));
    const api: NewTaskApi = { listMembers, createTask };

    render(<NewTaskPage onCreated={vi.fn()} onCancel={vi.fn()} api={api} />);

    const prioritySelect = (await screen.findByLabelText('Priority')) as HTMLSelectElement;
    expect(prioritySelect.value).toBe(DEFAULT_TASK_PRIORITY);
    expect(prioritySelect.value).toBe('Medium');
    expect(
      Array.from(prioritySelect.options).map((option: HTMLOptionElement): string => option.value),
    ).toEqual([...TASK_PRIORITIES]);
  });

  it('offers the labels field and starts with nothing attached', async () => {
    const listMembers = vi.fn(() => Promise.resolve(MEMBERS));
    const createTask = vi.fn((input: NewTask) => Promise.resolve(taskFrom(input)));
    const api: NewTaskApi = { listMembers, createTask };

    render(<NewTaskPage onCreated={vi.fn()} onCancel={vi.fn()} api={api} />);

    expect(await screen.findByRole('option', { name: 'Priya Natarajan' })).not.toBeNull();
    expect(screen.getByText('Labels')).not.toBeNull();
    expect(screen.getByTestId('label-selection').textContent).toBe('');
  });

  it('sends the default priority and no labels when the form is saved unchanged', async () => {
    const listMembers = vi.fn(() => Promise.resolve(MEMBERS));
    const createTask = vi.fn((input: NewTask) => Promise.resolve(taskFrom(input)));
    const onCreated = vi.fn();
    const api: NewTaskApi = { listMembers, createTask };

    render(<NewTaskPage onCreated={onCreated} onCancel={vi.fn()} api={api} />);
    expect(await screen.findByRole('option', { name: 'Priya Natarajan' })).not.toBeNull();

    fireEvent.change(screen.getByLabelText(/^Title/), {
      target: { value: 'Plan the Alex QA walkthrough' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith({
        title: 'Plan the Alex QA walkthrough',
        description: '',
        assigneeId: null,
        dueDate: null,
        status: DEFAULT_TASK_STATUS,
        priority: DEFAULT_TASK_PRIORITY,
        labelIds: [],
      });
    });
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('task-run-b7');
    });
  });

  it('sends a non-default priority chosen in the form', async () => {
    const listMembers = vi.fn(() => Promise.resolve(MEMBERS));
    const createTask = vi.fn((input: NewTask) => Promise.resolve(taskFrom(input)));
    const api: NewTaskApi = { listMembers, createTask };

    render(<NewTaskPage onCreated={vi.fn()} onCancel={vi.fn()} api={api} />);
    expect(await screen.findByRole('option', { name: 'Priya Natarajan' })).not.toBeNull();

    fireEvent.change(screen.getByLabelText(/^Title/), {
      target: { value: 'Escalate the Priya Lunch handover' },
    });
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'High' } });

    expect((screen.getByLabelText('Priority') as HTMLSelectElement).value).toBe('High');

    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith({
        title: 'Escalate the Priya Lunch handover',
        description: '',
        assigneeId: null,
        dueDate: null,
        status: DEFAULT_TASK_STATUS,
        priority: 'High',
        labelIds: [],
      });
    });
  });

  it('sends the labels attached in the picker as labelIds', async () => {
    const listMembers = vi.fn(() => Promise.resolve(MEMBERS));
    const createTask = vi.fn((input: NewTask) => Promise.resolve(taskFrom(input)));
    const api: NewTaskApi = { listMembers, createTask };

    render(<NewTaskPage onCreated={vi.fn()} onCancel={vi.fn()} api={api} />);
    expect(await screen.findByRole('option', { name: 'Priya Natarajan' })).not.toBeNull();

    fireEvent.change(screen.getByLabelText(/^Title/), {
      target: { value: 'Label the Alex QA walkthrough' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Attach the Urgent label' }));

    expect(screen.getByTestId('label-selection').textContent).toBe('label-urgent');

    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith({
        title: 'Label the Alex QA walkthrough',
        description: '',
        assigneeId: null,
        dueDate: null,
        status: DEFAULT_TASK_STATUS,
        priority: DEFAULT_TASK_PRIORITY,
        labelIds: ['label-urgent'],
      });
    });
  });

  it('attaches a label created from inside the picker to the new task', async () => {
    const listMembers = vi.fn(() => Promise.resolve(MEMBERS));
    const createTask = vi.fn((input: NewTask) => Promise.resolve(taskFrom(input)));
    const api: NewTaskApi = { listMembers, createTask };

    render(<NewTaskPage onCreated={vi.fn()} onCancel={vi.fn()} api={api} />);
    expect(await screen.findByRole('option', { name: 'Priya Natarajan' })).not.toBeNull();

    fireEvent.change(screen.getByLabelText(/^Title/), {
      target: { value: 'Spike the Priya Lunch import' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create the Spike label' }));

    expect(screen.getByTestId('label-selection').textContent).toBe('label-spike');

    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith({
        title: 'Spike the Priya Lunch import',
        description: '',
        assigneeId: null,
        dueDate: null,
        status: DEFAULT_TASK_STATUS,
        priority: DEFAULT_TASK_PRIORITY,
        labelIds: ['label-spike'],
      });
    });
  });

  it('creates the task from the filled form and reports the new id', async () => {
    const listMembers = vi.fn(() => Promise.resolve(MEMBERS));
    const createTask = vi.fn((input: NewTask) => Promise.resolve(taskFrom(input)));
    const onCreated = vi.fn();
    const onCancel = vi.fn();
    const api: NewTaskApi = { listMembers, createTask };

    render(<NewTaskPage onCreated={onCreated} onCancel={onCancel} api={api} />);
    expect(await screen.findByRole('option', { name: 'Dan Okafor' })).not.toBeNull();

    fireEvent.change(screen.getByLabelText(/^Title/), {
      target: { value: '  Draft the launch checklist  ' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Collect the steps for release day.' },
    });
    fireEvent.change(screen.getByLabelText('Assignee'), { target: { value: 'member-dan' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-03-04' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'doing' } });
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'Low' } });
    fireEvent.click(screen.getByRole('button', { name: 'Attach the Urgent label' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledTimes(1);
    });
    expect(createTask).toHaveBeenCalledWith({
      title: 'Draft the launch checklist',
      description: 'Collect the steps for release day.',
      assigneeId: 'member-dan',
      dueDate: '2026-03-04',
      status: 'doing',
      priority: 'Low',
      labelIds: ['label-urgent'],
    });
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('task-run-b7');
    });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('raises onCancel without creating anything', async () => {
    const listMembers = vi.fn(() => Promise.resolve(MEMBERS));
    const createTask = vi.fn((input: NewTask) => Promise.resolve(taskFrom(input)));
    const onCreated = vi.fn();
    const onCancel = vi.fn();
    const api: NewTaskApi = { listMembers, createTask };

    render(<NewTaskPage onCreated={onCreated} onCancel={onCancel} api={api} />);
    expect(await screen.findByRole('option', { name: 'Priya Natarajan' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(createTask).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('shows the roster failure but still allows an unassigned task to be saved', async () => {
    const listMembers = vi.fn(() => Promise.reject(new Error('Members unavailable')));
    const createTask = vi.fn((input: NewTask) => Promise.resolve(taskFrom(input)));
    const onCreated = vi.fn();
    const onCancel = vi.fn();
    const api: NewTaskApi = { listMembers, createTask };

    render(<NewTaskPage onCreated={onCreated} onCancel={onCancel} api={api} />);

    expect(await screen.findByText('Members unavailable')).not.toBeNull();

    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Review the roster outage' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith({
        title: 'Review the roster outage',
        description: '',
        assigneeId: null,
        dueDate: null,
        status: DEFAULT_TASK_STATUS,
        priority: DEFAULT_TASK_PRIORITY,
        labelIds: [],
      });
    });
  });
});
