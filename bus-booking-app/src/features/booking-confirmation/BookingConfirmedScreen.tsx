import { useEffect, useState } from 'react';
import { Link, usePathname } from '../../router';
import { Alert, Spinner } from '../../ui';
import { apiFetch } from '../../api/index.js';
import { formatDate, formatINR, formatTime } from '../../format/index.js';
import { busTypeLabel } from '../../models/catalogue/index.js';
import type { BookingRecord, PassengerInput } from '../../models/bookings/index.js';
import { PayOnBoardingNotice } from './PayOnBoardingNotice';
import {
  BOOKING_NOT_FOUND_MESSAGE,
  MY_BOOKINGS_PATH,
  SEARCH_PATH,
  bookingIdFromPath,
  bookingTicketRequestPath,
  describeBookingError,
  passengerLabel,
  seatListLabel,
} from './booking-path.js';
import './styles.css';

/**
 * THE BOOKING CONFIRMED SCREEN at `/bookings/:bookingId/confirmed`.
 *
 * Reached straight after a booking is created, and re-openable later from any link or a reload: the
 * booking reference comes from the URL and the ticket itself from `GET /api/bookings/:bookingId`, so
 * nothing is carried in memory between screens.
 *
 * It renders the booking ID (`BB-#####`), the bus, the travel date and departure time, the boarding
 * point, the seats and their passengers, the fares, and — prominently — the pay-on-boarding sentence,
 * with the two ways on: My bookings and a fresh search.
 */
type LoadStatus = 'loading' | 'ready' | 'error';

export function BookingConfirmedScreen(): JSX.Element {
  const pathname = usePathname();
  const bookingId = bookingIdFromPath(pathname);
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (bookingId === null) {
      setBooking(null);
      setStatus('error');
      setMessage(BOOKING_NOT_FOUND_MESSAGE);
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    setMessage('');

    apiFetch<BookingRecord>(bookingTicketRequestPath(bookingId), { signal: controller.signal })
      .then((record: BookingRecord) => {
        if (controller.signal.aborted) return;
        setBooking(record);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setBooking(null);
        setStatus('error');
        setMessage(describeBookingError(error));
      });

    return () => {
      controller.abort();
    };
  }, [bookingId]);

  return (
    <section
      className="empty-state bc-confirmed"
      data-screen="/bookings/:bookingId/confirmed"
      data-testid="booking-confirmed-pay-on-boarding-screen-page"
    >
      <span className="empty-state-art bc-art" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" focusable="false">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>

      <h1 className="empty-state-title">Booking confirmed</h1>

      {status === 'loading' ? (
        <div className="bc-state" data-testid="booking-confirmed-pay-on-boarding-screen-loading">
          <Spinner label="Loading your ticket" />
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="bc-state" data-testid="booking-confirmed-pay-on-boarding-screen-error">
          <Alert kind="error">{message}</Alert>
        </div>
      ) : null}

      {status === 'ready' && booking !== null ? (
        <>
          <p className="bc-message">
            Your seats are reserved. Show this ticket to the bus staff when boarding.
          </p>

          <dl className="bc-details" data-testid="booking-confirmed-pay-on-boarding-screen-details">
            <div className="bc-detail">
              <dt>Booking ID</dt>
              <dd className="text-strong">{booking.id}</dd>
            </div>
            <div className="bc-detail">
              <dt>Bus</dt>
              <dd>{`${booking.busName} · ${busTypeLabel(booking.busType)}`}</dd>
            </div>
            <div className="bc-detail">
              <dt>Route</dt>
              <dd>{`${booking.fromCityName} → ${booking.toCityName}`}</dd>
            </div>
            <div className="bc-detail">
              <dt>Travel date</dt>
              <dd>{formatDate(booking.departureAt)}</dd>
            </div>
            <div className="bc-detail">
              <dt>Departure time</dt>
              <dd>{formatTime(booking.departureAt)}</dd>
            </div>
            <div className="bc-detail">
              <dt>Boarding point</dt>
              <dd>{booking.boardingPointName}</dd>
            </div>
            <div className="bc-detail">
              <dt>Seats</dt>
              <dd>{seatListLabel(booking.seatNumbers)}</dd>
            </div>
            <div className="bc-detail">
              <dt>Passengers</dt>
              <dd>
                <ul className="bc-passengers">
                  {booking.passengers.map((passenger: PassengerInput) => (
                    <li key={passenger.seatNumber}>{passengerLabel(passenger)}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div className="bc-detail">
              <dt>Fare per seat</dt>
              <dd>{formatINR(booking.farePerSeat)}</dd>
            </div>
            <div className="bc-detail">
              <dt>Total fare</dt>
              <dd>{formatINR(booking.totalFare)}</dd>
            </div>
          </dl>

          <PayOnBoardingNotice totalFare={booking.totalFare} />
        </>
      ) : null}

      <nav className="empty-state-action bc-actions" aria-label="After your booking">
        <Link to={MY_BOOKINGS_PATH}>View my bookings</Link>
        <Link to={SEARCH_PATH}>Search buses</Link>
      </nav>
    </section>
  );
}

export default BookingConfirmedScreen;
