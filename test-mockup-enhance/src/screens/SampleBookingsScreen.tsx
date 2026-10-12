import type { ReactElement } from 'react';
import { Badge, type BadgeTone } from '../components/Badge';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { listBookings, type SampleBooking } from '../data/sampleData';

const toneOf = (status: SampleBooking['status']): BadgeTone =>
  status === 'confirmed' ? 'success' : status === 'requested' ? 'warning' : 'neutral';

const COLUMNS: DataTableColumn<SampleBooking>[] = [
  { key: 'name', header: 'Name', cell: (b) => b.name },
  { key: 'email', header: 'Email', cell: (b) => b.email },
  { key: 'service', header: 'Service', cell: (b) => b.service },
  { key: 'date', header: 'Date', cell: (b) => b.date },
  { key: 'status', header: 'Status', cell: (b) => <Badge tone={toneOf(b.status)}>{b.status}</Badge> },
];

/**
 * SAMPLE - the private area: the bookings that came in, as a table. With `ACCOUNT` set this page (not
 * marked public) is reachable only signed in. Not part of a real site.
 */
export function SampleBookingsScreen(): ReactElement {
  const bookings = listBookings();
  if (bookings.length === 0) {
    return <EmptyState title="No bookings yet" message="Requests from the booking page appear here." />;
  }
  return <DataTable caption="Bookings" columns={COLUMNS} rows={bookings} rowKey={(b) => b.id} />;
}
