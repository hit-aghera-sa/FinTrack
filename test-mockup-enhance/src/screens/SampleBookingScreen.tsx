import { useState, type FormEvent, type ReactElement } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { SelectField, TextAreaField, TextField } from '../components/Field';
import { requestBooking, SAMPLE_SERVICES } from '../data/sampleData';
import { Link } from '../router';

type Errors = Partial<Record<'name' | 'email' | 'service' | 'date', string>>;

/**
 * SAMPLE - the booking form: the shared fields, their validation messages, a notice when sending fails,
 * and a thank-you once sent. The frame draws this page's heading from its route label. Not part of a
 * real site; a real booking form posts to the site's own API.
 */
export function SampleBookingScreen(): ReactElement {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState<{ name: string; service: string } | null>(null);

  const options = SAMPLE_SERVICES.map((s) => ({ value: s.title, label: `${s.title} (${s.eyebrow ?? ''})` }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const found: Errors = {};
    if (name.trim() === '') found.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) found.email = 'Enter a valid email address.';
    if (service === '') found.service = 'Choose a service.';
    if (date === '') found.date = 'Choose a date.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      const saved = requestBooking({ name: name.trim(), email: email.trim(), service, date, notes: notes.trim() });
      setSent({ name: saved.name.split(' ')[0] ?? saved.name, service: saved.service.toLowerCase() });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Your request could not be sent. Please try again.');
    }
  };

  if (sent) {
    return (
      <div className="booking">
        <Card title="Request received">
          <p>
            Thanks, {sent.name}. We will confirm your {sent.service} within one working day.
          </p>
          <p className="text-sm text-muted">
            A copy has gone to your email.{' '}
            <Link className="text-link" to="/">
              Back to the home page
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="booking">
      <Card>
        <form className="form" aria-label="Book a session" noValidate onSubmit={handleSubmit}>
          {failure ? (
            <p className="notice notice-danger" role="alert">
              {failure}
            </p>
          ) : null}
          <div className="form-row">
            <TextField label="Your name" required autoComplete="name" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
            <TextField label="Email" type="email" required autoComplete="email" value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <SelectField label="Service" required value={service} options={options} placeholder="Choose a service" error={errors.service} onChange={(e) => setService(e.target.value)} />
            <TextField label="Preferred date" type="date" required value={date} error={errors.date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <TextAreaField label="Anything we should know?" hint="Location, number of people, what the pictures are for." value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="form-actions">
            <Button type="submit" variant="primary">
              Request this slot
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
