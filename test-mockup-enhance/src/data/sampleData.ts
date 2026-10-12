import type { Feature } from '../components/FeatureGrid';

/**
 * SAMPLE DATA - for the four sample pages only. Not part of a site built on this starter: a real site
 * keeps its bookings behind its own API and database.
 */
export const SAMPLE_SERVICES: Feature[] = [
  { eyebrow: 'From £120', title: 'Portrait session', text: 'An hour in the studio or on location, with ten edited photographs.' },
  { eyebrow: 'From £450', title: 'Brand photography', text: 'A half day with your team and your space, for the website and social media.' },
  { eyebrow: 'From £900', title: 'Event coverage', text: 'A full day at your launch, conference or celebration, delivered within a week.' },
];

export const SAMPLE_STEPS: Feature[] = [
  { eyebrow: 'Step 1', title: 'Request a slot', text: 'Pick a service and a date on the booking page.' },
  { eyebrow: 'Step 2', title: 'We confirm', text: 'You hear back within one working day with the details.' },
  { eyebrow: 'Step 3', title: 'The session', text: 'Edited files arrive within a week of the day.' },
];

export type BookingStatus = 'requested' | 'confirmed' | 'done';

export interface SampleBooking {
  id: string;
  name: string;
  email: string;
  service: string;
  date: string;
  status: BookingStatus;
  notes: string;
}

let bookings: SampleBooking[] = [
  { id: 'b-1', name: 'Asha Rao', email: 'asha@example.com', service: 'Portrait session', date: '2026-10-14', status: 'confirmed', notes: '' },
  { id: 'b-2', name: 'Tom Okafor', email: 'tom@example.com', service: 'Brand photography', date: '2026-10-21', status: 'requested', notes: 'Prefers mornings.' },
  { id: 'b-3', name: 'Lena Nakamura', email: 'lena@example.com', service: 'Event coverage', date: '2026-09-30', status: 'done', notes: '' },
];

export function listBookings(): SampleBooking[] {
  return [...bookings];
}

export function requestBooking(input: Omit<SampleBooking, 'id' | 'status'>): SampleBooking {
  const saved: SampleBooking = { ...input, id: 'b-' + Date.now().toString(36), status: 'requested' };
  bookings = [saved, ...bookings];
  return saved;
}
