import { useCallback, useEffect, useState } from 'react';
import { apiFetch, isAbortError } from '../../../api/index.js';
import type { BookingRecord } from '../../../models/bookings/index.js';
import {
  BOOKING_NOT_FOUND_MESSAGE,
  describeTicketError,
  isMissingTicket,
  ticketRequestPath,
} from './ticket-view.js';

/**
 * THE TICKET'S DATA, loaded from the app's own backend.
 *
 * The screen never fetches itself: it asks this hook for the booking named by the URL and renders
 * whichever state comes back. A cancellation hands the updated booking straight back through
 * `replaceBooking`, so the screen reflects the Cancelled status without a second round trip.
 */
export type BookingTicketStatus = 'loading' | 'ready' | 'missing' | 'error';

export interface BookingTicketState {
  readonly status: BookingTicketStatus;
  readonly booking: BookingRecord | null;
  /** The sentence to show when the ticket could not be loaded, else null. */
  readonly message: string | null;
  readonly replaceBooking: (booking: BookingRecord) => void;
  readonly reload: () => void;
}

export function useBookingTicket(bookingId: string | null): BookingTicketState {
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [status, setStatus] = useState<BookingTicketStatus>(bookingId === null ? 'missing' : 'loading');
  const [message, setMessage] = useState<string | null>(bookingId === null ? BOOKING_NOT_FOUND_MESSAGE : null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (bookingId === null) {
      setBooking(null);
      setStatus('missing');
      setMessage(BOOKING_NOT_FOUND_MESSAGE);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setStatus('loading');
    setMessage(null);

    apiFetch<BookingRecord>(ticketRequestPath(bookingId), { signal: controller.signal })
      .then((record: BookingRecord) => {
        if (!active) return;
        setBooking(record);
        setStatus('ready');
        setMessage(null);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setBooking(null);
        setStatus(isMissingTicket(error) ? 'missing' : 'error');
        setMessage(describeTicketError(error));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [bookingId, attempt]);

  const replaceBooking = useCallback((next: BookingRecord): void => {
    setBooking(next);
    setStatus('ready');
    setMessage(null);
  }, []);

  const reload = useCallback((): void => {
    setAttempt((previous: number) => previous + 1);
  }, []);

  return { status, booking, message, replaceBooking, reload };
}
