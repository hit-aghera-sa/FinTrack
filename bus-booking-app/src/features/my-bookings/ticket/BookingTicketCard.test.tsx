// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { formatINR } from '../../../format/index.js';
import { MESSAGES } from '../../../messages/index.js';
import type { BookingRecord } from '../../../models/bookings/index.js';
import { BookingTicketCard } from './BookingTicketCard';
import { EMPTY_VALUE, TICKET_TEST_IDS } from './ticket-view.js';

afterEach(() => {
  cleanup();
});

const noop = (): void => undefined;

function bookingFixture(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: 'BB-10452',
    userId: 'account-ticket-spec',
    tripId: 'trip-ticket-spec',
    busName: 'Shree Travels',
    busType: 'AC_SLEEPER',
    fromCityName: 'Pune',
    toCityName: 'Mumbai',
    departureAt: '2024-06-12T16:00:00.000Z',
    arrivalAt: '2024-06-12T23:30:00.000Z',
    boardingPointName: 'Dadar, near TT Circle',
    seatNumbers: ['A1', 'A2'],
    passengers: [
      { seatNumber: 'A1', name: 'Ramesh Kulkarni', age: 34, gender: 'MALE' },
      { seatNumber: 'A2', name: 'Sita Kulkarni', age: 31, gender: 'FEMALE' },
    ],
    farePerSeat: 600,
    totalFare: 1200,
    status: 'BOOKED',
    canCancel: true,
    createdAt: '2024-06-01T10:00:00.000Z',
    cancelledAt: null,
    ...overrides,
  };
}

describe('the amount to pay on boarding', () => {
  it('states the total the bus staff must be handed', () => {
    render(<BookingTicketCard booking={bookingFixture()} onCancelled={noop} />);

    const notice = screen.getByTestId(TICKET_TEST_IDS.amount);
    expect(notice.textContent ?? '').toContain(formatINR(1200));
  });
});

describe('the conditional cancel affordance', () => {
  it('offers the cancel action while cancellation is still allowed', () => {
    render(<BookingTicketCard booking={bookingFixture()} onCancelled={noop} />);

    expect(screen.queryByTestId(TICKET_TEST_IDS.cancel)).not.toBeNull();
    expect(screen.queryByTestId(TICKET_TEST_IDS.cancelNote)).toBeNull();
  });

  it('withholds it, with a reason, once the booking is cancelled', () => {
    const cancelled = bookingFixture({
      status: 'CANCELLED',
      canCancel: false,
      cancelledAt: '2024-06-10T09:00:00.000Z',
    });
    const { container } = render(<BookingTicketCard booking={cancelled} onCancelled={noop} />);

    expect(screen.queryByTestId(TICKET_TEST_IDS.cancel)).toBeNull();
    const note = screen.getByTestId(TICKET_TEST_IDS.cancelNote);
    expect(note.textContent ?? '').toContain(MESSAGES.bookingCancelled('BB-10452'));
    expect(container.textContent ?? '').toContain('Cancelled');
  });

  it('withholds it inside the cancellation cut-off', () => {
    render(<BookingTicketCard booking={bookingFixture({ canCancel: false })} onCancelled={noop} />);

    expect(screen.queryByTestId(TICKET_TEST_IDS.cancel)).toBeNull();
    const note = screen.getByTestId(TICKET_TEST_IDS.cancelNote);
    expect(note.textContent ?? '').toBe(MESSAGES.cancelNotAllowed);
  });
});

describe('the ticket before its booking arrives', () => {
  it('still names every field the bus staff look for', () => {
    const { container } = render(<BookingTicketCard booking={null} onCancelled={noop} />);
    const text = container.textContent ?? '';

    expect(text).toContain('Booking ID');
    expect(text).toContain('Boarding point');
    expect(text).toContain(EMPTY_VALUE);
    expect(screen.queryByTestId(TICKET_TEST_IDS.amount)).toBeNull();
  });

  it('lists each seat with its passenger once the booking is there', () => {
    render(<BookingTicketCard booking={bookingFixture()} onCancelled={noop} />);

    const passengers = screen.getByTestId(TICKET_TEST_IDS.passengers);
    const text = passengers.textContent ?? '';
    expect(text).toContain('A1');
    expect(text).toContain('Ramesh Kulkarni');
    expect(text).toContain('34 years');
    expect(text).toContain('Sita Kulkarni');
  });
});
