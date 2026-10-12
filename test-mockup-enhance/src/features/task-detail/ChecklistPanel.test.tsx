// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ChecklistPanelView } from './ChecklistPanel.js';
import type { ChecklistClient } from './checklistClient.js';
import { ApiError } from '../../lib/api/index.js';
import type { ChecklistItem } from '../../models/checklist/index.js';

const TASK_ID = 'task-ten';

/** The label the panel's submit button carries. */
const ADD_LABEL = 'Add subtask';

/**
 * The add-item input, queried as the form control it is.
 *
 * The panel carries TWO required accessible names containing "checklist
 * item": this input ("Checklist item") and the progress element
 * ("N of M checklist items done"). Querying by role picks out the input alone.
 */
function itemInput(): HTMLElement {
  return screen.getByRole('textbox', { name: /checklist item/i });
}

function makeItem(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  const base: ChecklistItem = {
    id: 'checklist-one',
    taskId: TASK_ID,
    title: 'Draft the Alex QA brief',
    done: false,
    position: 1,
    createdAt: '2026-03-01T09:00:00.000Z',
  };
  return { ...base, ...overrides };
}

/** An in-memory stub implementing the whole checklist client surface. */
function createStub(seed: readonly ChecklistItem[] = []) {
  let rows: ChecklistItem[] = seed.map((row: ChecklistItem): ChecklistItem => ({ ...row }));
  let sequence = rows.length;

  return {
    listItems: vi.fn(
      (): Promise<ChecklistItem[]> =>
        Promise.resolve(rows.map((row: ChecklistItem): ChecklistItem => ({ ...row }))),
    ),
    addItem: vi.fn((taskId: string, title: string): Promise<ChecklistItem> => {
      sequence += 1;
      const created: ChecklistItem = {
        id: `checklist-run-${String(sequence)}`,
        taskId,
        title,
        done: false,
        position: sequence,
        createdAt: '2026-03-02T09:00:00.000Z',
      };
      rows = [...rows, created];
      return Promise.resolve({ ...created });
    }),
    setDone: vi.fn((taskId: string, itemId: string, done: boolean): Promise<ChecklistItem> => {
      const found = rows.find((row: ChecklistItem): boolean => row.id === itemId);
      if (found === undefined) {
        return Promise.reject(new ApiError(404, 'That checklist item does not exist.'));
      }
      const next: ChecklistItem = { ...found, done };
      rows = rows.map((row: ChecklistItem): ChecklistItem => (row.id === itemId ? next : row));
      return Promise.resolve({ ...next });
    }),
    removeItem: vi.fn((taskId: string, itemId: string): Promise<void> => {
      rows = rows.filter((row: ChecklistItem): boolean => row.id !== itemId);
      return Promise.resolve();
    }),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChecklistPanel', () => {
  it('puts the add form, the list and a separate progress element inside the panel root', async () => {
    const stub = createStub([makeItem({ done: true })]);
    const client: ChecklistClient = stub;

    render(<ChecklistPanelView taskId={TASK_ID} client={client} />);

    const panel = await screen.findByTestId('task-checklist');
    const progress = screen.getByTestId('checklist-progress');

    // The progress text is NOT the element the panel testid resolves to.
    expect(progress).not.toBe(panel);
    expect(panel).toContainElement(progress);
    expect(progress).toHaveTextContent('1/1');
    expect(progress).toHaveAttribute('aria-label', '1 of 1 checklist items done');

    // The panel is headed "Subtasks".
    expect(within(panel).getByRole('heading', { name: 'Subtasks' })).toBeInTheDocument();

    const input = within(panel).getByRole('textbox', { name: /checklist item/i });
    expect(input).toHaveAttribute('type', 'text');
    expect(within(panel).getByRole('button', { name: ADD_LABEL })).toBeInTheDocument();
    expect(
      within(panel).getByRole('checkbox', { name: 'Draft the Alex QA brief' }),
    ).toBeChecked();
  });

  it('says what will appear when the checklist is empty', async () => {
    const client: ChecklistClient = createStub([]);

    render(<ChecklistPanelView taskId={TASK_ID} client={client} />);

    expect(
      await screen.findByText(/No checklist items yet\./),
    ).toBeInTheDocument();
    expect(screen.getByTestId('checklist-progress')).toHaveTextContent('0/0');
  });

  it('adds an item optimistically and persists it', async () => {
    const stub = createStub([makeItem()]);
    const client: ChecklistClient = stub;

    render(<ChecklistPanelView taskId={TASK_ID} client={client} />);

    await screen.findByRole('checkbox', { name: 'Draft the Alex QA brief' });

    fireEvent.change(itemInput(), {
      target: { value: 'Review with Priya Lunch' },
    });
    fireEvent.click(screen.getByRole('button', { name: ADD_LABEL }));

    // It is on screen straight away, before the write has answered.
    expect(screen.getByRole('checkbox', { name: 'Review with Priya Lunch' })).toBeInTheDocument();

    await waitFor(() => {
      expect(stub.addItem).toHaveBeenCalledWith(TASK_ID, 'Review with Priya Lunch');
    });

    await waitFor(() => {
      expect(screen.getByTestId('checklist-progress')).toHaveTextContent('0/2');
    });
    expect(screen.getByTestId('checklist-progress')).toHaveAttribute(
      'aria-label',
      '0 of 2 checklist items done',
    );
    expect(itemInput()).toHaveValue('');
  });

  it('refuses an empty title and writes nothing', async () => {
    const stub = createStub([]);
    const client: ChecklistClient = stub;

    render(<ChecklistPanelView taskId={TASK_ID} client={client} />);
    await screen.findByTestId('task-checklist');

    fireEvent.change(itemInput(), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: ADD_LABEL }));

    expect(await screen.findByText('Enter a checklist item.')).toBeInTheDocument();
    expect(stub.addItem).not.toHaveBeenCalled();
  });

  it('ticks an item, saving done and re-rendering immediately', async () => {
    const stub = createStub([makeItem()]);
    const client: ChecklistClient = stub;

    render(<ChecklistPanelView taskId={TASK_ID} client={client} />);

    const checkbox = await screen.findByRole('checkbox', { name: 'Draft the Alex QA brief' });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    expect(screen.getByRole('checkbox', { name: 'Draft the Alex QA brief' })).toBeChecked();
    await waitFor(() => {
      expect(stub.setDone).toHaveBeenCalledWith(TASK_ID, 'checklist-one', true);
    });
    await waitFor(() => {
      expect(screen.getByTestId('checklist-progress')).toHaveTextContent('1/1');
    });
  });

  it('unticks an item again', async () => {
    const stub = createStub([makeItem({ done: true })]);
    const client: ChecklistClient = stub;

    render(<ChecklistPanelView taskId={TASK_ID} client={client} />);

    const checkbox = await screen.findByRole('checkbox', { name: 'Draft the Alex QA brief' });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(stub.setDone).toHaveBeenCalledWith(TASK_ID, 'checklist-one', false);
    });
    await waitFor(() => {
      expect(screen.getByTestId('checklist-progress')).toHaveTextContent('0/1');
    });
  });

  it('deletes an item from the list, with no confirmation step', async () => {
    const stub = createStub([
      makeItem(),
      makeItem({ id: 'checklist-two', title: 'Review with Priya Lunch', position: 2 }),
    ]);
    const client: ChecklistClient = stub;

    render(<ChecklistPanelView taskId={TASK_ID} client={client} />);

    await screen.findByRole('checkbox', { name: 'Draft the Alex QA brief' });
    const rows = screen.getAllByTestId('checklist-item');
    expect(rows).toHaveLength(2);

    const first = rows[0];
    expect(first).toBeDefined();
    if (first === undefined) {
      throw new Error('The first checklist row is missing.');
    }
    fireEvent.click(within(first).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(stub.removeItem).toHaveBeenCalledWith(TASK_ID, 'checklist-one');
    });
    await waitFor(() => {
      expect(screen.queryByRole('checkbox', { name: 'Draft the Alex QA brief' })).toBeNull();
    });
    expect(screen.getByRole('checkbox', { name: 'Review with Priya Lunch' })).toBeInTheDocument();
    expect(screen.getByTestId('checklist-progress')).toHaveTextContent('0/1');
  });

  it('puts a failed add back in the box and says what went wrong', async () => {
    const stub = createStub([]);
    stub.addItem.mockImplementation(
      (): Promise<ChecklistItem> =>
        Promise.reject(new ApiError(400, 'A checklist item title is required.')),
    );
    const client: ChecklistClient = stub;

    render(<ChecklistPanelView taskId={TASK_ID} client={client} />);
    await screen.findByTestId('task-checklist');

    fireEvent.change(itemInput(), {
      target: { value: 'Review with Priya Lunch' },
    });
    fireEvent.click(screen.getByRole('button', { name: ADD_LABEL }));

    expect(await screen.findByText('A checklist item title is required.')).toBeInTheDocument();
    await waitFor(() => {
      expect(itemInput()).toHaveValue('Review with Priya Lunch');
    });
    expect(screen.getByTestId('checklist-progress')).toHaveTextContent('0/0');
  });

  it('shows the server message when the checklist cannot be loaded', async () => {
    const stub = createStub([]);
    stub.listItems.mockImplementation(
      (): Promise<ChecklistItem[]> =>
        Promise.reject(new ApiError(500, 'The checklist store is unavailable.')),
    );
    const client: ChecklistClient = stub;

    render(<ChecklistPanelView taskId={TASK_ID} client={client} />);

    expect(await screen.findByText('The checklist store is unavailable.')).toBeInTheDocument();
    // The panel, its form and its progress element are still there to use.
    expect(screen.getByTestId('task-checklist')).toBeInTheDocument();
    expect(itemInput()).toBeInTheDocument();
    expect(screen.getByTestId('checklist-progress')).toHaveTextContent('0/0');
  });
});
