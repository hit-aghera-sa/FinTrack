import { useState } from 'react';
import { Link, navigate } from '../../../router';
import { Alert, Button, EmptyState, Spinner } from '../../../ui/index.js';
import { MESSAGES } from '../../../messages/index.js';
import { formatINR } from '../../../format/index.js';
import type { BookingRecord } from '../../../models/bookings/index.js';
import {
  MY_BOOKINGS_TABS,
  SEARCH_PATH,
  bookingSubline,
  bookingTitle,
  statusBadgeClass,
  statusLabel,
  tabFromSearch,
  ticketPathFor,
  type MyBookingsTab,
  type MyBookingsTabId,
} from './my-bookings-list.js';
import { LOAD_FAILED_MESSAGE, useMyBookings } from './useMyBookings.js';
import { MY_BOOKINGS_STYLES } from './styles.js';

/** The hook the acceptance suite waits for. */
export const MY_BOOKINGS_TEST_ID = 'my-bookings-screens-my-bookings-list-tab-split-page';

const EMPTY_HINT = 'Your tickets will appear here as soon as you book a bus.';

const TAB_EMPTY: Record<MyBookingsTabId, { title: string; message: string }> = {
  upcoming: {
    title: 'No upcoming journeys.',
    message: 'A trip you book stays here until its bus departs.',
  },
  past: {
    title: 'No past or cancelled bookings.',
    message: 'Journeys you have travelled and bookings you cancel appear here.',
  },
};

function goToSearch(): void {
  navigate(SEARCH_PATH);
}

function BookingRow({ booking }: { booking: BookingRecord }): JSX.Element {
  return (
    <li className="list-row" data-testid="my-bookings-screens-my-bookings-list-tab-split-row">
      <div className="list-row-text">
        <span className="list-row-title mybookings-row-title-link">
          <Link to={ticketPathFor(booking.id)}>{bookingTitle(booking)}</Link>
        </span>
        <span className="list-row-sub mybookings-row-sub">{bookingSubline(booking)}</span>
      </div>
      <span className={statusBadgeClass(booking.status)}>{statusLabel(booking.status)}</span>
      <span className="mybookings-row-amount">
        <span className="mybookings-row-amount-label">To pay</span>
        <span className="text-strong">{formatINR(booking.totalFare)}</span>
      </span>
    </li>
  );
}

/**
 * THE MY BOOKINGS SCREEN — the traveller's own bookings at `/bookings`, in two tabs.
 *
 * **Upcoming** holds the buses that have not departed, soonest first; **Past & cancelled** holds the
 * departed buses and the cancelled bookings, newest first. Every row states the booking ID, the
 * route, the travel date, the departure time, the boarding point, the seat numbers, the passenger
 * names, the total fare still to pay and the status — Booked, Cancelled or Completed — and links
 * through to that booking's ticket.
 *
 * It renders only its own content: the shell draws whatever frame the route table asks for.
 */
export function MyBookingsScreen(): JSX.Element {
  const { status, upcoming, past, error, reload } = useMyBookings();
  const [tab, setTab] = useState<MyBookingsTabId>(() => tabFromSearch(window.location.search));

  const rows = tab === 'upcoming' ? upcoming : past;
  const total = upcoming.length + past.length;
  const countFor = (id: MyBookingsTabId): number => (id === 'upcoming' ? upcoming.length : past.length);

  let body: JSX.Element;
  if (status === 'loading') {
    body = (
      <div className="mybookings-state">
        <Spinner label="Loading your bookings…" />
      </div>
    );
  } else if (status === 'error') {
    body = (
      <div className="mybookings-state" data-testid="my-bookings-screens-my-bookings-list-tab-split-error">
        <Alert kind="error">{error ?? LOAD_FAILED_MESSAGE}</Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  } else if (total === 0) {
    body = (
      <div data-testid="my-bookings-screens-my-bookings-list-tab-split-empty">
        <EmptyState
          title={MESSAGES.noBookings}
          message={EMPTY_HINT}
          action={<Button onClick={goToSearch}>Search buses</Button>}
        />
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div data-testid="my-bookings-screens-my-bookings-list-tab-split-tab-empty">
        <EmptyState title={TAB_EMPTY[tab].title} message={TAB_EMPTY[tab].message} />
      </div>
    );
  } else {
    body = (
      <ul className="list-rows mybookings-rows" data-testid="my-bookings-screens-my-bookings-list-tab-split-list">
        {rows.map((booking: BookingRecord) => (
          <BookingRow key={booking.id} booking={booking} />
        ))}
      </ul>
    );
  }

  return (
    <div className="mybookings-screen" data-testid={MY_BOOKINGS_TEST_ID}>
      <style>{MY_BOOKINGS_STYLES}</style>

      <div className="page-header">
        <div>
          <div className="page-eyebrow">Your trips</div>
          <h1 className="page-title">My bookings</h1>
          <p className="page-description">Review upcoming journeys and past or cancelled bookings.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" onClick={goToSearch}>
            Search buses
          </Button>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="My bookings">
        {MY_BOOKINGS_TABS.map((descriptor: MyBookingsTab) => (
          <button
            key={descriptor.id}
            type="button"
            className="tab"
            role="tab"
            aria-selected={tab === descriptor.id}
            data-testid={`my-bookings-screens-my-bookings-list-tab-split-tab-${descriptor.id}`}
            onClick={() => setTab(descriptor.id)}
          >
            {descriptor.label} <span className="tab-count">{countFor(descriptor.id)}</span>
          </button>
        ))}
      </div>

      {body}
    </div>
  );
}

export default MyBookingsScreen;
