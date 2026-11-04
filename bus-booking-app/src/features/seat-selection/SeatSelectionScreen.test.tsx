// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatINR } from '../../format/index.js';
import type { SeatInfo, TripDetail } from '../../models/catalogue/index.js';
import { SeatSelectionScreen } from './SeatSelectionScreen';
import { SEAT_LIMIT_NOTICE } from './selection.js';

const SEAT_NUMBERS: readonly string[] = [
  'A1',
  'A2',
  'A3',
  'A4',
  'B1',
  'B2',
  'B3',
  'B4',
  'C1',
  'C2',
  'C3',
  'C4',
];

const FARE_PER_SEAT = 850;

function seatsFixture(): SeatInfo[] {
  return SEAT_NUMBERS.map((number, index) => ({
    number,
    row: Math.floor(index / 4) + 1,
    column: (index % 4) + 1,
    isBooked: number === 'A3',
  }));
}

function tripFixture(): TripDetail {
  return {
    id: 'trip-koyna',
    busName: 'Koyna Travels Volvo',
    busType: 'AC_SLEEPER',
    fromCity: { id: 'city-pune', name: 'Pune' },
    toCity: { id: 'city-mumbai', name: 'Mumbai' },
    departureAt: '2025-03-12T16:00:00.000Z',
    arrivalAt: '2025-03-12T20:30:00.000Z',
    farePerSeat: FARE_PER_SEAT,
    seatsLeft: 11,
    totalSeats: 12,
    seats: seatsFixture(),
    boardingPoints: [
      { id: 'bp-shivajinagar', name: 'Shivajinagar', pickupAt: '2025-03-12T16:00:00.000Z' },
      { id: 'bp-wakad', name: 'Wakad', pickupAt: '2025-03-12T16:40:00.000Z' },
    ],
  };
}

function seatButton(number: string): HTMLElement {
  return screen.getByTestId(`seat-selection-screen-seat-${number}`);
}

async function openScreen(): Promise<void> {
  render(<SeatSelectionScreen />);
  await screen.findByTestId('seat-selection-screen-deck');
}

beforeEach(() => {
  window.history.replaceState({}, '', '/trips/trip-koyna/seats');
  const body = JSON.stringify(tripFixture());
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('SeatSelectionScreen', () => {
  it('shows the bus, the seat map and the boarding point chooser', async () => {
    await openScreen();

    expect(screen.getByTestId('seat-selection-screen-page')).toBeInTheDocument();
    expect(screen.getByText('Select seats')).toBeInTheDocument();
    expect(screen.getAllByText('Boarding point').length).toBeGreaterThan(0);
    expect(screen.getByTestId('seat-selection-screen-bus')).toHaveTextContent('Koyna Travels Volvo');
    expect(screen.getByText('12/03/2025')).toBeInTheDocument();
    expect(seatButton('A1')).toBeInTheDocument();
  });

  it('draws a booked seat grey and refuses to select it', async () => {
    await openScreen();

    const booked = seatButton('A3');
    expect(booked).toBeDisabled();
    expect(booked.className).toContain('is-booked');
    expect(booked).toHaveAttribute('aria-label', 'Seat A3, Booked');

    fireEvent.click(booked);

    expect(booked).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('seat-selection-screen-seats')).toHaveTextContent('none yet');
  });

  it('allows six seats and refuses a seventh with a notice', async () => {
    await openScreen();

    for (const number of ['A1', 'A2', 'A4', 'B1', 'B2', 'B3']) {
      fireEvent.click(seatButton(number));
    }

    expect(seatButton('A1')).toHaveAttribute('aria-pressed', 'true');
    expect(seatButton('A1').className).toContain('is-selected');
    expect(screen.getByTestId('seat-selection-screen-total')).toHaveTextContent(formatINR(FARE_PER_SEAT * 6));

    const seventh = seatButton('B4');
    fireEvent.click(seventh);

    expect(seventh).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('seat-selection-screen-notice')).toHaveTextContent(SEAT_LIMIT_NOTICE);
    expect(screen.getByTestId('seat-selection-screen-total')).toHaveTextContent(formatINR(FARE_PER_SEAT * 6));
  });

  it('keeps a running total of the fare as seats are picked and released', async () => {
    await openScreen();

    fireEvent.click(seatButton('A1'));
    expect(screen.getByTestId('seat-selection-screen-total')).toHaveTextContent(formatINR(FARE_PER_SEAT));

    fireEvent.click(seatButton('A2'));
    expect(screen.getByTestId('seat-selection-screen-total')).toHaveTextContent(formatINR(FARE_PER_SEAT * 2));
    expect(screen.getByTestId('seat-selection-screen-seats')).toHaveTextContent('A1, A2');

    fireEvent.click(seatButton('A1'));
    expect(screen.getByTestId('seat-selection-screen-total')).toHaveTextContent(formatINR(FARE_PER_SEAT));
  });

  it('continues to passenger details with the seats and the boarding point', async () => {
    await openScreen();

    const continueButton = screen.getByRole('button', { name: /Continue/ });

    fireEvent.click(continueButton);
    expect(window.location.pathname).toBe('/trips/trip-koyna/seats');

    fireEvent.click(seatButton('A1'));

    const select = document.querySelector('select');
    if (select === null) throw new Error('the boarding point chooser was not rendered');
    fireEvent.change(select, { target: { value: 'bp-shivajinagar' } });

    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    expect(window.location.pathname).toBe('/trips/trip-koyna/passengers');
    expect(window.location.search).toBe('?seats=A1&boarding=bp-shivajinagar');
  });
});
