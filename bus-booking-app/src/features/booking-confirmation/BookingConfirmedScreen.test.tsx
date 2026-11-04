// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MESSAGES } from '../../messages/index.js';
import type { BookingRecord } from '../../models/bookings/index.js';
import { BookingConfirmedScreen } from './BookingConfirmedScreen';

const BOOKING: BookingRecord = {
  id: 'BB-10452',
  userId: 'account-demo',
  tripId: 'trip-demo',
  busName: 'Shree Travels',
  busType: 'AC_SLEEPER',
  fromCityName: 'Pune',
  toCityName: 'Mumbai',
  departureAt: '2024-06-12T16:00:00.000Z',
  arrivalAt: '2024-06-12T20:30:00.000Z',
  boardingPointName: 'Dadar East',
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
};

/** A minimal stand-in for the one Response surface `apiFetch` reads: ok, status and text(). */
function jsonResponse(body: unknown, status: number): Response {
  const payload = JSON.stringify(body);
  const stub = {
    ok: status >= 200 && status < 300,
    status,
    text: (): Promise<string> => Promise.resolve(payload),
  };
  return stub as unknown as Response;
}

beforeEach(() => {
  window.history.pushState({}, '', '/bookings/BB-10452/confirmed');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

describe('BookingConfirmedScreen', () => {
  it('shows the ticket read from the API, with the pay-on-boarding sentence', async () => {
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL): Promise<Response> => Promise.resolve(jsonResponse(BOOKING, 200)),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<BookingConfirmedScreen />);

    expect(await screen.findByText('BB-10452')).not.toBeNull();
    expect(screen.getByText('Booking confirmed')).not.toBeNull();
    expect(screen.getByText('Booking ID')).not.toBeNull();
    expect(screen.getByText('Boarding point')).not.toBeNull();
    expect(screen.getByText('Dadar East')).not.toBeNull();
    expect(screen.getByText('A1, A2')).not.toBeNull();
    expect(screen.getByText('A1 · Ramesh Kulkarni (34, Male)')).not.toBeNull();
    expect(
      screen.getByText('Pay ₹1,200 in cash or UPI to the bus staff when boarding.'),
    ).not.toBeNull();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/bookings/BB-10452');
  });

  it('offers the two ways on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((): Promise<Response> => Promise.resolve(jsonResponse(BOOKING, 200))),
    );

    render(<BookingConfirmedScreen />);
    await screen.findByText('BB-10452');

    expect(screen.getByRole('link', { name: 'View my bookings' }).getAttribute('href')).toBe('/bookings');
    expect(screen.getByRole('link', { name: 'Search buses' }).getAttribute('href')).toBe('/search');
  });

  it('tells the traveller when the backend could not be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((): Promise<Response> => Promise.reject(new TypeError('Failed to fetch'))),
    );

    render(<BookingConfirmedScreen />);

    expect(await screen.findByText(MESSAGES.offline)).not.toBeNull();
  });

  it('explains a booking the account does not have', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (): Promise<Response> =>
          Promise.resolve(
            jsonResponse({ error: { code: 'not_found', message: 'Booking not found.' } }, 404),
          ),
      ),
    );

    render(<BookingConfirmedScreen />);

    expect(
      await screen.findByText('We could not find that booking. Open My bookings to see your tickets.'),
    ).not.toBeNull();
  });
});
