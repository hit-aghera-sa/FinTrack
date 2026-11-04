import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  SelectField,
  Spinner,
  Tabs,
  TextField,
} from './index';

const noop = (): void => undefined;
const noopWith = (_value: string): void => undefined;

describe('Button', () => {
  it('draws the primary variant as a real button by default', () => {
    const html = renderToStaticMarkup(<Button onClick={noop}>Search buses</Button>);
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('class="button button-primary"');
    expect(html).toContain('Search buses');
  });

  it('honours the variant and the submit type', () => {
    const html = renderToStaticMarkup(
      <Button variant="danger" type="submit">
        Cancel booking
      </Button>,
    );
    expect(html).toContain('class="button button-danger"');
    expect(html).toContain('type="submit"');
  });

  it('blocks a second press while loading and says it is busy in words', () => {
    const html = renderToStaticMarkup(
      <Button loading onClick={noop}>
        Book seats
      </Button>,
    );
    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Working');
  });

  it('is disabled when asked', () => {
    const html = renderToStaticMarkup(<Button disabled>Sold out</Button>);
    expect(html).toContain('disabled');
    expect(html).not.toContain('aria-busy');
  });
});

describe('TextField', () => {
  it('labels its input and shows no error when there is none', () => {
    const html = renderToStaticMarkup(
      <TextField label="Full name" name="fullName" value="Aisha Kapoor" onChange={noopWith} />,
    );
    expect(html).toContain('for="field-fullName"');
    expect(html).toContain('id="field-fullName"');
    expect(html).toContain('Full name');
    expect(html).toContain('value="Aisha Kapoor"');
    expect(html).not.toContain('aria-invalid');
    expect(html).not.toContain('role="alert"');
  });

  it('asks a phone for the numeric keypad on a mobile number', () => {
    const html = renderToStaticMarkup(
      <TextField label="Mobile number" name="mobile" type="tel" value="" maxLength={10} onChange={noopWith} />,
    );
    const attributes = html.toLowerCase();
    expect(html).toContain('type="tel"');
    expect(attributes).toContain('inputmode="numeric"');
    expect(attributes).toContain('maxlength="10"');
  });

  it('reports an error in words, wired to the input', () => {
    const html = renderToStaticMarkup(
      <TextField
        label="Mobile number"
        name="mobile"
        type="tel"
        value="12345"
        error="Enter a valid 10-digit mobile number"
        onChange={noopWith}
      />,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="field-mobile-error"');
    expect(html).toContain('id="field-mobile-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Enter a valid 10-digit mobile number');
    expect(html).toContain('has-error');
  });

  it('passes date bounds to the platform date picker', () => {
    const html = renderToStaticMarkup(
      <TextField
        label="Date"
        name="travelDate"
        type="date"
        value="2024-06-12"
        min="2024-06-01"
        max="2024-07-01"
        onChange={noopWith}
      />,
    );
    expect(html).toContain('type="date"');
    expect(html).toContain('min="2024-06-01"');
    expect(html).toContain('max="2024-07-01"');
  });
});

describe('SelectField', () => {
  it('renders every option against a labelled control', () => {
    const html = renderToStaticMarkup(
      <SelectField
        label="From"
        name="from"
        value="pune"
        onChange={noopWith}
        options={[
          { value: 'pune', label: 'Pune' },
          { value: 'mumbai', label: 'Mumbai' },
        ]}
      />,
    );
    expect(html).toContain('for="field-from"');
    expect(html).toContain('<select');
    expect(html).toContain('value="pune"');
    expect(html).toContain('Pune');
    expect(html).toContain('Mumbai');
  });

  it('marks the field required and shows its error', () => {
    const html = renderToStaticMarkup(
      <SelectField
        label="Security question"
        name="question"
        value=""
        required
        error="Choose a security question"
        onChange={noopWith}
        options={[{ value: 'mother', label: "What is your mother's first name?" }]}
      />,
    );
    expect(html).toContain('required');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Choose a security question');
  });
});

describe('Alert', () => {
  it('announces an error and names the kind in words', () => {
    const html = renderToStaticMarkup(<Alert kind="error">Mobile number or password is incorrect.</Alert>);
    expect(html).toContain('notice-danger');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Error:');
    expect(html).toContain('Mobile number or password is incorrect.');
  });

  it('uses the success and info strips for the other kinds', () => {
    const success = renderToStaticMarkup(<Alert kind="success">Booking confirmed</Alert>);
    const info = renderToStaticMarkup(<Alert kind="info">From and To cannot be the same city.</Alert>);
    expect(success).toContain('notice-success');
    expect(success).toContain('role="status"');
    expect(success).toContain('Success:');
    expect(info).toContain('notice-info');
    expect(info).toContain('Information:');
  });
});

describe('Tabs', () => {
  it('marks the active tab with aria-selected as well as a style', () => {
    const html = renderToStaticMarkup(
      <Tabs
        tabs={[
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'past', label: 'Past & cancelled' },
        ]}
        activeId="past"
        onChange={noopWith}
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('Upcoming');
    expect(html).toContain('Past &amp; cancelled');
  });
});

describe('Card', () => {
  it('is a plain surface without an action', () => {
    const html = renderToStaticMarkup(<Card testId="ticket-card">Shree Travels</Card>);
    expect(html).toContain('class="card"');
    expect(html).toContain('data-testid="ticket-card"');
    expect(html).not.toContain('<button');
  });

  it('becomes one focusable button when it can be pressed', () => {
    const html = renderToStaticMarkup(
      <Card testId="trip-card" onClick={noop}>
        Pune – Mumbai
      </Card>,
    );
    expect(html).toContain('<button');
    expect(html).toContain('ui-card-action');
    expect(html).toContain('Pune – Mumbai');
  });

  it('disables the pressable card when asked', () => {
    const html = renderToStaticMarkup(
      <Card onClick={noop} disabled>
        Sold out
      </Card>,
    );
    expect(html).toContain('disabled');
  });
});

describe('ConfirmDialog', () => {
  it('renders nothing while it is closed', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open={false}
        title="Cancel this booking?"
        confirmLabel="Yes, cancel"
        cancelLabel="No, keep it"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(html).toBe('');
  });

  it('asks the question with two worded answers when open', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open
        title="Cancel this booking?"
        confirmLabel="Yes, cancel"
        cancelLabel="No, keep it"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="ui-confirm-dialog-title"');
    expect(html).toContain('Cancel this booking?');
    expect(html).toContain('Yes, cancel');
    expect(html).toContain('No, keep it');
  });

  it('blocks both answers while it is busy', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open
        busy
        title="Sign out of every device?"
        confirmLabel="Yes, sign out"
        cancelLabel="No"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(html.match(/disabled/g)?.length).toBe(2);
    expect(html).toContain('aria-busy="true"');
  });
});

describe('Spinner', () => {
  it('shows words beside the ring by default', () => {
    const html = renderToStaticMarkup(<Spinner />);
    expect(html).toContain('role="status"');
    expect(html).toContain('Loading');
  });

  it('takes its own label', () => {
    const html = renderToStaticMarkup(<Spinner label="Searching buses…" />);
    expect(html).toContain('Searching buses…');
  });
});

describe('EmptyState', () => {
  it('comes from the app\u2019s one shared empty state', () => {
    const html = renderToStaticMarkup(<EmptyState title="No buses found" message="Try another date." />);
    expect(html).toContain('empty-state');
    expect(html).toContain('No buses found');
    expect(html).toContain('Try another date.');
  });
});
