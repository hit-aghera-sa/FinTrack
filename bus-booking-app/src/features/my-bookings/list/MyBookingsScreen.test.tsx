// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MESSAGES } from '../../../messages/index.js';
import { DEFAULT_BUS_TYPE } from '../../../models/catalogue/index.js';
import type { BookingRecord } from '../../../models/bookings/index.js';
import { MY_BOOKINGS_TEST_ID, MyBookingsScreen } from './MyBookingsScreen';

function booking(overrides: Partial<BookingRecord> & { id: string }): BookingRecord {
  return {
    userId: 'traveller-a',
    tripId: 'trip-a',
    busName: 'Deccan Express',
    busType: DEFAULT_BUS_TYPE,
    fromCityName: 'Pune',
    toCityName: 'Mumbai',
    departureAt: new Date(Date.now() + 86_400_000).toISOString(),
    arrivalAt: new Date(Date.now() + 100_000_000).toISOString(),
    boardingPointName: 'Dadar',
    seatNumbers: ['A1'],
    passengers: [{ seatNumber: 'A1', name: 'Asha Patil', age: 31, gender: 'FEMALE' }],
    farePerSeat: 600,
    totalFare: 600,
    status: 'BOOKED',
    canCancel: true,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    cancelledAt: null,
    ...overrides,
    id: overrides.id,
  };
}

/** A fetch that answers the one GET this screen makes with the given JSON body. */
function stubBookings(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(body)),
      }),
    ),
  );
}

function rowTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.list-row-title')).map((node) => node.textContent ?? '');
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MyBookingsScreen', () => {
  it('shows the no-bookings message with a Search buses button', async () => {
    stubBookings({ upcoming: [], past: [] });

    render(<MyBookingsScreen />);

    expect(await screen.findByText(MESSAGES.noBookings)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Search buses' }).length).toBeGreaterThan(0);
    expect(screen.getByTestId(MY_BOOKINGS_TEST_ID)).toBeInTheDocument();
  });

  it('puts a cancelled booking under Past & cancelled, not Upcoming', async () => {
    const upcoming = booking({ id: 'BB-10452' });
    const cancelled = booking({
      id: 'BB-10460',
      status: 'CANCELLED',
      canCancel: false,
      cancelledAt: new Date(Date.now() - 3_600_000).toISOString(),
    });
    stubBookings({ upcoming: [upcoming, cancelled], past: [] });

    const { container } = render(<MyBookingsScreen />);

    expect(await screen.findByText(/BB-10452/)).toBeInTheDocument();
    expect(rowTitles(container)).toHaveLength(1);

    fireEvent.click(screen.getByTestId('my-bookings-screens-my-bookings-list-tab-split-tab-past'));

    expect(screen.getByText(/BB-10460/)).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(rowTitles(container)).toHaveLength(1);
  });

  it('lists Upcoming soonest first and Past & cancelled newest first', async () => {
    const sooner = booking({
      id: 'BB-10455',
      departureAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const later = booking({
      id: 'BB-10470',
      departureAt: new Date(Date.now() + 864_000_000).toISOString(),
    });
    const oldTrip = booking({
      id: 'BB-10300',
      status: 'COMPLETED',
      departureAt: new Date(Date.now() - 864_000_000).toISOString(),
      arrivalAt: new Date(Date.now() - 860_000_000).toISOString(),
    });
    const recentTrip = booking({
      id: 'BB-10400',
      status: 'COMPLETED',
      departureAt: new Date(Date.now() - 86_400_000).toISOString(),
      arrivalAt: new Date(Date.now() - 82_000_000).toISOString(),
    });
    stubBookings({ upcoming: [later, sooner], past: [oldTrip, recentTrip] });

    const { container } = render(<MyBookingsScreen />);

    expect(await screen.findByText(/BB-10455/)).toBeInTheDocument();
    expect(rowTitles(container)[0]).toContain('BB-10455');
    expect(rowTitles(container)[1]).toContain('BB-10470');

    fireEvent.click(screen.getByTestId('my-bookings-screens-my-bookings-list-tab-split-tab-past'));

    expect(rowTitles(container)[0]).toContain('BB-10400');
    expect(rowTitles(container)[1]).toContain('BB-10300');
  });
});
