import { useCallback, useState } from 'react';
import { navigate, usePathname } from '../../../router';
import { Alert, Spinner } from '../../../ui/index.js';
import type { BookingRecord } from '../../../models/bookings/index.js';
import { BookingTicketCard } from './BookingTicketCard';
import { useBookingTicket } from './useBookingTicket.js';
import { MY_BOOKINGS_PATH, TICKET_TEST_IDS, bookingIdFromPathname } from './ticket-view.js';
import './ticket.css';

/**
 * THE BOOKING TICKET SCREEN at `/bookings/:bookingId`.
 *
 * It reads the booking from the address itself, so the screen survives a reload and a shared link,
 * loads it from `GET /api/bookings/:bookingId` and shows one booking in full. A booking that does not
 * exist — or belongs to another traveller — reads as one sentence; a failure to reach the backend
 * reads as the catalogue's no-internet sentence; and the cancel action is offered only while
 * cancellation is still allowed, after which the screen shows the Cancelled status straight away.
 */
export function BookingTicketScreen(): JSX.Element {
  const pathname = usePathname();
  const bookingId = bookingIdFromPathname(pathname);
  const ticket = useBookingTicket(bookingId);
  const { replaceBooking } = ticket;
  const [cancelledMessage, setCancelledMessage] = useState<string | null>(null);

  const handleCancelled = useCallback(
    (cancelled: BookingRecord, message: string): void => {
      replaceBooking(cancelled);
      setCancelledMessage(message);
    },
    [replaceBooking],
  );

  const goToMyBookings = useCallback((): void => {
    navigate(MY_BOOKINGS_PATH);
  }, []);

  return (
    <div className="ticket-view" data-testid={TICKET_TEST_IDS.page}>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Ticket</div>
          <h1 className="page-title">Ticket</h1>
          <p className="page-description">Show this screen to the bus staff when boarding.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="button button-secondary" onClick={goToMyBookings}>
            Back
          </button>
        </div>
      </div>

      {ticket.status === 'loading' ? (
        <div className="ticket-state" data-testid={TICKET_TEST_IDS.loading}>
          <Spinner label="Loading this ticket…" />
        </div>
      ) : null}

      {cancelledMessage === null ? null : (
        <div className="ticket-state" data-testid={TICKET_TEST_IDS.cancelled}>
          <Alert kind="success">{cancelledMessage}</Alert>
        </div>
      )}

      {ticket.message === null ? null : (
        <div className="ticket-state" data-testid={TICKET_TEST_IDS.message}>
          <Alert kind="error">{ticket.message}</Alert>
        </div>
      )}

      <BookingTicketCard booking={ticket.booking} onCancelled={handleCancelled} />
    </div>
  );
}

export default BookingTicketScreen;
