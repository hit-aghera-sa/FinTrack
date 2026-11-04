// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MESSAGES } from '../../messages/index.js';
import type { BookingRecord } from '../../models/bookings/index.js';
import type { TripDetail } from '../../models/catalogue/index.js';
import { PassengerDetailsScreen } from './PassengerDetailsScreen';

const TRIP: TripDetail = {
  id: 'trip-morning-star',
  busName: 'Morning Star Travels',
  busType: 'AC_SEATER',
  fromCity: { id: 'city-pune', name: 'Pune' },
  toCity: { id: 'city-mumbai', name: 'Mumbai' },
  departureAt: '2031-03-04T03:30:00.000Z',
  arrivalAt: '2031-03-04T08:00:00.000Z',
  farePerSeat: 650,
  seatsLeft: 12,
  totalSeats: 30,
  seats: [
    { number: 'A1', row: 1, column: 1, isBooked: false },
    { number: 'A2', row: 1, column: 2, isBooked: false },
  ],
  boardingPoints: [{ id: 'bp-shivaji', name: 'Shivajinagar', pickupAt: '2031-03-04T03:10:00.000Z' }],
};

const BOOKING: BookingRecord = {
  id: 'BB-10452',
  userId: 'user-demo',
  tripId: TRIP.id,
  busName: TRIP.busName,
  busType: TRIP.busType,
  fromCityName: 'Pune',
  toCityName: 'Mumbai',
  departureAt: TRIP.departureAt,
  arrivalAt: TRIP.arrivalAt,
  boardingPointName: 'Shivajinagar',
  seatNumbers: ['A1', 'A2'],
  passengers: [
    { seatNumber: 'A1', name: 'Alex QA', age: 29, gender: 'FEMALE' },
    { seatNumber: 'A2', name: 'Priya Nair', age: 34, gender: 'MALE' },
  ],
  farePerSeat: 650,
  totalFare: 1300,
  status: 'BOOKED',
  canCancel: true,
  createdAt: '2031-03-01T06:00:00.000Z',
  cancelledAt: null,
};

interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly body: string | null;
}

const recorded: RecordedCall[] = [];
const originalFetch: typeof globalThis.fetch = globalThis.fetch;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installFetch(handler: (method: string) => Response): void {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = typeof init?.method === 'string' ? init.method : 'GET';
    recorded.push({ url, method, body: typeof init?.body === 'string' ? init.body : null });
    return handler(method);
  };
}

function openAt(path: string): void {
  window.history.replaceState({}, '', path);
}

async function fillEveryPassenger(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByText('Booking summary')).toBeInTheDocument();
  });

  const names = screen.getAllByRole('textbox');
  const ages = screen.getAllByRole('spinbutton');
  const genders = screen.getAllByRole('combobox');

  fireEvent.change(names[0], { target: { value: 'Alex QA' } });
  fireEvent.change(ages[0], { target: { value: '29' } });
  fireEvent.change(genders[0], { target: { value: 'FEMALE' } });
  fireEvent.change(names[1], { target: { value: 'Priya Nair' } });
  fireEvent.change(ages[1], { target: { value: '34' } });
  fireEvent.change(genders[1], { target: { value: 'MALE' } });
}

afterEach(() => {
  cleanup();
  recorded.length = 0;
  globalThis.fetch = originalFetch;
  openAt('/');
});

describe('PassengerDetailsScreen', () => {
  it('asks for seats first when the query string carries none', () => {
    openAt('/trips/trip-morning-star/passengers');
    render(<PassengerDetailsScreen />);

    expect(screen.getByTestId('passenger-details-booking-summary-screen-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Passenger details' })).toBeInTheDocument();
    expect(screen.getByText('No seats chosen yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose seats' })).toBeInTheDocument();
    expect(recorded).toHaveLength(0);
  });

  it('collects one passenger per seat, summarises the booking and creates it', async () => {
    openAt('/trips/trip-morning-star/passengers?seats=A1,A2&boarding=bp-shivaji');
    installFetch((method) => (method === 'POST' ? json(201, BOOKING) : json(200, TRIP)));

    render(<PassengerDetailsScreen />);
    await fillEveryPassenger();

    expect(screen.getByText('Seat A1')).toBeInTheDocument();
    expect(screen.getByText('Seat A2')).toBeInTheDocument();
    expect(screen.getByText('Morning Star Travels · AC Seater')).toBeInTheDocument();
    expect(screen.getByText('A1, A2')).toBeInTheDocument();
    expect(screen.getByText('₹650')).toBeInTheDocument();
    expect(screen.getByText('₹1,300')).toBeInTheDocument();
    expect(screen.getByText('04/03/2031')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/bookings/BB-10452/confirmed');
    });

    const created = recorded.find((call) => call.method === 'POST');
    expect(created?.url).toBe('/api/bookings');
    expect(created?.body).toContain('"tripId":"trip-morning-star"');
    expect(created?.body).toContain('"boardingPointId":"bp-shivaji"');
    expect(created?.body).toContain('"seatNumber":"A1"');
    expect(created?.body).toContain('"name":"Priya Nair"');
    expect(created?.body).toContain('"age":29');
  });

  it('refuses to send an incomplete form', async () => {
    openAt('/trips/trip-morning-star/passengers?seats=A1,A2&boarding=bp-shivaji');
    installFetch((method) => (method === 'POST' ? json(201, BOOKING) : json(200, TRIP)));

    render(<PassengerDetailsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Booking summary')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));

    await waitFor(() => {
      expect(screen.getAllByText('Enter the passenger name.')).toHaveLength(2);
    });
    expect(recorded.some((call) => call.method === 'POST')).toBe(false);
  });

  it('books nothing and offers the refreshed seat map when a seat was just taken', async () => {
    openAt('/trips/trip-morning-star/passengers?seats=A1,A2&boarding=bp-shivaji');
    installFetch((method) =>
      method === 'POST'
        ? json(409, {
            error: {
              code: 'SEAT_TAKEN',
              message: 'Sorry, seat A2 was just booked. Please choose another seat.',
            },
          })
        : json(200, TRIP),
    );

    render(<PassengerDetailsScreen />);
    await fillEveryPassenger();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));

    await waitFor(() => {
      expect(screen.getByText(MESSAGES.seatJustBooked('A2'))).toBeInTheDocument();
    });
    expect(screen.queryByText('Booking summary')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Choose another seat' }));
    expect(window.location.pathname).toBe('/trips/trip-morning-star/seats');
  });

  it('explains a trip that could not be loaded and offers another attempt', async () => {
    openAt('/trips/trip-morning-star/passengers?seats=A1&boarding=bp-shivaji');
    installFetch(() => json(503, { error: { code: 'unavailable', message: 'Bus details are unavailable.' } }));

    render(<PassengerDetailsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Bus details are unavailable.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
