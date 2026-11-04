// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MESSAGES } from '../../messages/index.js';
import type { BookingRecord } from '../../models/bookings/index.js';
import { CancelBookingButton } from './CancelBookingButton';

/** The slice of a Response the API client actually reads. */
interface FakeResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

function respond(status: number, body: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: (): Promise<string> => Promise.resolve(JSON.stringify(body)),
  };
}

function bookingFixture(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: 'BB-10452',
    userId: 'traveller-ananya',
    tripId: 'trip-blue-line',
    busName: 'Sharma Travels',
    busType: 'AC_SLEEPER',
    fromCityName: 'Pune',
    toCityName: 'Mumbai',
    departureAt: '2025-03-14T15:30:00.000Z',
    arrivalAt: '2025-03-14T20:00:00.000Z',
    boardingPointName: 'Shivajinagar',
    seatNumbers: ['A1'],
    passengers: [{ seatNumber: 'A1', name: 'Ananya Rao', age: 29, gender: 'FEMALE' }],
    farePerSeat: 650,
    totalFare: 650,
    status: 'BOOKED',
    canCancel: true,
    createdAt: '2025-03-10T09:00:00.000Z',
    cancelledAt: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CancelBookingButton', () => {
  it('renders nothing at all inside the last hour before departure', () => {
    const { container } = render(
      <CancelBookingButton booking={bookingFixture({ canCancel: false })} onCancelled={() => undefined} />,
    );
    expect(container.innerHTML).toBe('');
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('renders nothing for a booking that is already cancelled', () => {
    const cancelled = bookingFixture({
      status: 'CANCELLED',
      canCancel: false,
      cancelledAt: '2025-03-12T06:00:00.000Z',
    });
    const { container } = render(<CancelBookingButton booking={cancelled} onCancelled={() => undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for a completed journey', () => {
    const { container } = render(
      <CancelBookingButton
        booking={bookingFixture({ status: 'COMPLETED', canCancel: false })}
        onCancelled={() => undefined}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('offers the Cancel control for an upcoming booking', () => {
    render(<CancelBookingButton booking={bookingFixture()} onCancelled={() => undefined} />);
    expect(screen.getByTestId('cancel-booking-confirmation-flow-page')).not.toBeNull();
    expect(screen.getByText('Cancel')).not.toBeNull();
    expect(screen.queryByText(MESSAGES.cancelConfirmTitle)).toBeNull();
  });

  it('cancels the whole booking once the traveller confirms, and hands back the message', async () => {
    const cancelled = bookingFixture({
      status: 'CANCELLED',
      canCancel: false,
      cancelledAt: '2025-03-12T06:00:00.000Z',
    });
    const fetchMock = vi.fn((_input: unknown, _init?: unknown): Promise<FakeResponse> =>
      Promise.resolve(respond(200, cancelled)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const handled: Array<{ booking: BookingRecord; message: string }> = [];
    const onCancelled = (booking: BookingRecord, message: string): void => {
      handled.push({ booking, message });
    };

    render(<CancelBookingButton booking={bookingFixture()} onCancelled={onCancelled} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText(MESSAGES.cancelConfirmTitle)).not.toBeNull();

    fireEvent.click(screen.getByText(MESSAGES.cancelConfirmYes));

    await waitFor(() => {
      expect(handled).toHaveLength(1);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe('/api/bookings/BB-10452/cancel');
    expect(handled[0]?.message).toBe('Your booking BB-10452 has been cancelled.');
    expect(handled[0]?.booking.status).toBe('CANCELLED');
    expect(handled[0]?.booking.canCancel).toBe(false);
  });

  it('calls nothing when the traveller answers No', async () => {
    const fetchMock = vi.fn((_input: unknown, _init?: unknown): Promise<FakeResponse> =>
      Promise.resolve(respond(200, bookingFixture())),
    );
    vi.stubGlobal('fetch', fetchMock);

    const handled: string[] = [];
    render(
      <CancelBookingButton
        booking={bookingFixture()}
        onCancelled={(_booking: BookingRecord, message: string) => {
          handled.push(message);
        }}
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText(MESSAGES.cancelConfirmNo));

    await waitFor(() => {
      expect(screen.queryByText(MESSAGES.cancelConfirmTitle)).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(handled).toHaveLength(0);
    expect(screen.getByText('Cancel')).not.toBeNull();
  });

  it('shows the refusal sentence when the backend declines the cancellation', async () => {
    const fetchMock = vi.fn((_input: unknown, _init?: unknown): Promise<FakeResponse> =>
      Promise.resolve(respond(409, { error: { code: 'TOO_LATE', message: MESSAGES.cancelNotAllowed } })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const handled: string[] = [];
    render(
      <CancelBookingButton
        booking={bookingFixture()}
        onCancelled={(_booking: BookingRecord, message: string) => {
          handled.push(message);
        }}
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText(MESSAGES.cancelConfirmYes));

    await waitFor(() => {
      expect(screen.getByText(MESSAGES.cancelNotAllowed)).not.toBeNull();
    });
    expect(handled).toHaveLength(0);
  });

  it('shows the no-internet sentence when the request never reaches the backend', async () => {
    const fetchMock = vi.fn((_input: unknown, _init?: unknown): Promise<FakeResponse> =>
      Promise.reject(new TypeError('Failed to fetch')),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<CancelBookingButton booking={bookingFixture()} onCancelled={() => undefined} />);

    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText(MESSAGES.cancelConfirmYes));

    await waitFor(() => {
      expect(screen.getByText(MESSAGES.offline)).not.toBeNull();
    });
  });
});
