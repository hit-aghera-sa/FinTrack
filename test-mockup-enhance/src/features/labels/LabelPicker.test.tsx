// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LabelPicker } from './LabelPicker.js';
import type { LabelApi } from './labelsClient.js';
import { DEFAULT_LABEL_COLOR, type Label, type NewLabel } from './labels.js';
import { ApiError } from '../../lib/api/index.js';

const DESIGN: Label = { id: 'label-design', name: 'Design', color: 'primary' };
const BUG: Label = { id: 'label-bug', name: 'Bug', color: 'danger' };

interface HostProps {
  readonly client: LabelApi;
  readonly initial?: readonly string[];
}

/** The picker as a screen uses it: the selection lives in the surrounding form. */
function Host({ client, initial = [] }: HostProps): JSX.Element {
  const [selected, setSelected] = useState<string[]>([...initial]);
  return <LabelPicker selectedIds={selected} onChange={setSelected} client={client} />;
}

function pressed(name: string): string | null {
  return screen.getByRole('button', { name }).getAttribute('aria-pressed');
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LabelPicker', () => {
  it('toggles an existing label on and off for the task', async () => {
    const createLabel = vi.fn(
      (input: NewLabel): Promise<Label> =>
        Promise.resolve({ id: 'label-new', name: input.name, color: input.color }),
    );
    const client: LabelApi = {
      listLabels: vi.fn((): Promise<Label[]> => Promise.resolve([DESIGN, BUG])),
      createLabel,
    };

    render(<Host client={client} />);

    const toggle = await screen.findByRole('button', { name: 'Design label' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(pressed('Design label')).toBe('true');
    });
    // The chosen label is shown as a chip with a remove action.
    expect(screen.getByRole('button', { name: 'Remove Design' })).not.toBeNull();
    expect(pressed('Bug label')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Design' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Remove Design' })).toBeNull();
    });
    expect(pressed('Design label')).toBe('false');
    expect(createLabel).not.toHaveBeenCalled();
  });

  it('creates a new label from the inline control and selects it', async () => {
    const createLabel = vi.fn(
      (input: NewLabel): Promise<Label> =>
        Promise.resolve({ id: 'label-research', name: input.name, color: input.color }),
    );
    const client: LabelApi = {
      listLabels: vi.fn((): Promise<Label[]> => Promise.resolve([DESIGN])),
      createLabel,
    };

    render(<Host client={client} />);

    expect(await screen.findByRole('button', { name: 'Design label' })).not.toBeNull();

    fireEvent.change(screen.getByLabelText('New label name'), {
      target: { value: '  Research  ' },
    });
    fireEvent.change(screen.getByLabelText('Label colour'), { target: { value: 'success' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));

    await waitFor(() => {
      expect(createLabel).toHaveBeenCalledWith({ name: 'Research', color: 'success' });
    });

    // It joins the list, it is selected, and the create control is cleared.
    expect(await screen.findByRole('button', { name: 'Remove Research' })).not.toBeNull();
    await waitFor(() => {
      expect(pressed('Research label')).toBe('true');
    });
    expect((screen.getByLabelText('New label name') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Label colour') as HTMLSelectElement).value).toBe(
      DEFAULT_LABEL_COLOR,
    );
  });

  it('reports a duplicate name from the server inline and selects nothing', async () => {
    const createLabel = vi.fn(
      (_input: NewLabel): Promise<Label> =>
        Promise.reject(new ApiError(409, 'A label called "Design" already exists.')),
    );
    const client: LabelApi = {
      listLabels: vi.fn((): Promise<Label[]> => Promise.resolve([BUG])),
      createLabel,
    };

    render(<Host client={client} />);

    expect(await screen.findByRole('button', { name: 'Bug label' })).not.toBeNull();

    fireEvent.change(screen.getByLabelText('New label name'), { target: { value: 'Design' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));

    await waitFor(() => {
      expect(createLabel).toHaveBeenCalledWith({ name: 'Design', color: DEFAULT_LABEL_COLOR });
    });

    expect(
      await screen.findByText('A label called "Design" already exists.'),
    ).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Design' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Design label' })).toBeNull();
    // The typed name is kept so it can be corrected.
    expect((screen.getByLabelText('New label name') as HTMLInputElement).value).toBe('Design');
  });

  it('refuses a blank name without calling the API', async () => {
    const createLabel = vi.fn(
      (input: NewLabel): Promise<Label> =>
        Promise.resolve({ id: 'label-blank', name: input.name, color: input.color }),
    );
    const client: LabelApi = {
      listLabels: vi.fn((): Promise<Label[]> => Promise.resolve([DESIGN])),
      createLabel,
    };

    render(<Host client={client} />);

    expect(await screen.findByRole('button', { name: 'Design label' })).not.toBeNull();

    fireEvent.change(screen.getByLabelText('New label name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));

    expect(await screen.findByText('Enter a name for the new label.')).not.toBeNull();
    expect(createLabel).not.toHaveBeenCalled();
  });

  it('says so inline when the labels cannot be loaded, and still offers the create control', async () => {
    const client: LabelApi = {
      listLabels: vi.fn(
        (): Promise<Label[]> => Promise.reject(new ApiError(500, 'The labels are unavailable.')),
      ),
      createLabel: vi.fn(
        (input: NewLabel): Promise<Label> =>
          Promise.resolve({ id: 'label-after-failure', name: input.name, color: input.color }),
      ),
    };

    render(<Host client={client} />);

    expect(await screen.findByText('The labels are unavailable.')).not.toBeNull();
    expect(screen.getByLabelText('New label name')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Add label' })).not.toBeNull();
  });
});
