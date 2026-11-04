import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AddTaskForm } from './AddTaskForm.js';
import { COPY } from '../../models/index.js';

const noopValue = (): void => {};
const noopSubmit = (): void => {};

function markup(value: string, pending = false): string {
  return renderToStaticMarkup(
    <AddTaskForm
      value={value}
      onValueChange={noopValue}
      onSubmit={noopSubmit}
      pending={pending}
    />,
  );
}

describe('<AddTaskForm />', () => {
  it('renders the composer input and Add button with the shared copy', () => {
    const html = markup('');
    expect(html).toContain('id="new-task-title"');
    expect(html).toContain(`placeholder="${COPY.composer.placeholder}"`);
    expect(html).toContain(COPY.composer.submit);
    expect(html).toContain('class="btn btn-primary controls-add__submit"');
    expect(html).toContain('type="submit"');
  });

  it('keeps the controls interactive for an empty title so the owner can reject it', () => {
    // The lane's stylesheet ships inline beside the markup and contains `[disabled]`
    // rules, so the assertion targets the rendered ATTRIBUTE, not the bare substring.
    expect(markup('')).not.toContain('disabled=""');
    expect(markup('   ')).not.toContain('disabled=""');
  });

  it('keeps the controls interactive for an over-long title so the owner can reject it', () => {
    expect(markup('x'.repeat(101))).not.toContain('disabled=""');
  });

  it('disables the input and the button only while a write is pending', () => {
    const html = markup('Alex QA run-b7', true);
    expect(html.match(/disabled=""/g) ?? []).toHaveLength(2);
  });

  it('is a controlled input bound to the value it is given', () => {
    expect(markup('Priya Lunch prep')).toContain('value="Priya Lunch prep"');
  });

  it('labels the field for assistive technology without showing the label twice', () => {
    const html = markup('');
    expect(html).toContain('class="controls-visually-hidden"');
    expect(html).toContain(COPY.composer.label);
    expect(html).toContain(`aria-label="${COPY.composer.heading}"`);
  });

  it('ships its stylesheet beside the markup', () => {
    const html = markup('');
    expect(html).toContain('<style>');
    expect(html).toContain('.controls-add');
  });
});
