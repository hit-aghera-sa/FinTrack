import { PayOnBoardingNotice } from '../../booking-confirmation/PayOnBoardingNotice';
import { CancelBookingButton } from '../../cancel-booking/CancelBookingButton';
import { formatDate, formatTime } from '../../../format/index.js';
import type { BookingRecord, PassengerInput } from '../../../models/bookings/index.js';
import {
  EMPTY_VALUE,
  TICKET_TEST_IDS,
  arrivalLabel,
  busLabel,
  canCancelNow,
  cancelNoteFor,
  farePerSeatLabel,
  passengerMetaLabel,
  routeLabel,
  seatListLabel,
  statusBadgeClass,
  statusLabel,
} from './ticket-view.js';
import './ticket.css';

export interface BookingTicketCardProps {
  /** The booking being shown, or null while it has not arrived (the labels still read). */
  booking: BookingRecord | null;
  /** Called with the cancelled booking and the confirmation sentence. */
  onCancelled: (booking: BookingRecord, message: string) => void;
}

/**
 * ONE BOOKING, laid out large enough for bus staff to read off the traveller's screen: the bus and
 * route, the travel date and departure time, the boarding point, every seat with its passenger, the
 * per-booking status and the amount still to be handed over on boarding.
 *
 * The cancel action appears only while cancellation is still allowed for this booking; otherwise the
 * footer says why it is not.
 */
export function BookingTicketCard({ booking, onCancelled }: BookingTicketCardProps): JSX.Element {
  return (
    <div className="card" data-testid={TICKET_TEST_IDS.card}>
      <div className="card-header">
        <div className="card-heading">
          <div className="card-icon">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="7" width="18" height="12" rx="2"></rect>
              <path d="M3 11h18"></path>
            </svg>
          </div>
          <div>
            <div className="card-title">{booking === null ? 'Your ticket' : busLabel(booking)}</div>
            <div className="card-description">
              {booking === null
                ? 'The bus, route and travel date of this booking appear here.'
                : `${routeLabel(booking)} · ${formatDate(booking.departureAt)}`}
            </div>
          </div>
        </div>
        {booking === null ? null : (
          <span className={statusBadgeClass(booking.status)}>{statusLabel(booking.status)}</span>
        )}
      </div>

      <div className="card-body">
        <dl className="detail-list">
          <div>
            <dt>Booking ID</dt>
            <dd data-testid={TICKET_TEST_IDS.bookingId}>{booking === null ? EMPTY_VALUE : booking.id}</dd>
          </div>
          <div>
            <dt>Travel date</dt>
            <dd>{booking === null ? EMPTY_VALUE : formatDate(booking.departureAt)}</dd>
          </div>
          <div>
            <dt>Departure</dt>
            <dd>{booking === null ? EMPTY_VALUE : formatTime(booking.departureAt)}</dd>
          </div>
          <div>
            <dt>Arrival</dt>
            <dd>{booking === null ? EMPTY_VALUE : arrivalLabel(booking)}</dd>
          </div>
          <div>
            <dt>Boarding point</dt>
            <dd>{booking === null ? EMPTY_VALUE : booking.boardingPointName}</dd>
          </div>
          <div>
            <dt>Seats</dt>
            <dd>{booking === null ? EMPTY_VALUE : seatListLabel(booking.seatNumbers)}</dd>
          </div>
          <div>
            <dt>Fare per seat</dt>
            <dd>{booking === null ? EMPTY_VALUE : farePerSeatLabel(booking)}</dd>
          </div>
          <div className="is-wide">
            <dt>Passengers</dt>
            <dd>
              {booking === null ? (
                EMPTY_VALUE
              ) : (
                <ul className="ticket-passengers" data-testid={TICKET_TEST_IDS.passengers}>
                  {booking.passengers.map((passenger: PassengerInput) => (
                    <li className="ticket-passenger" key={passenger.seatNumber}>
                      <span className="ticket-seat">{passenger.seatNumber}</span>
                      <span className="ticket-passenger-name">{passenger.name}</span>
                      <span className="ticket-passenger-meta">{passengerMetaLabel(passenger)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>

        {booking === null ? null : (
          <div className="ticket-notice" data-testid={TICKET_TEST_IDS.amount}>
            <PayOnBoardingNotice totalFare={booking.totalFare} />
          </div>
        )}
      </div>

      <div className="card-footer">
        {booking === null ? null : canCancelNow(booking) ? (
          <div data-testid={TICKET_TEST_IDS.cancel}>
            <CancelBookingButton booking={booking} onCancelled={onCancelled} />
          </div>
        ) : (
          <p className="ticket-cancel-note" data-testid={TICKET_TEST_IDS.cancelNote}>
            {cancelNoteFor(booking)}
          </p>
        )}
      </div>
    </div>
  );
}

export default BookingTicketCard;
