import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api/index.js';
import { PageHeader } from '../../components/PageHeader';
import { formatDate, formatINR, formatTime } from '../../format/index.js';
import { BUS_TYPE_LABELS } from '../../models/catalogue/index.js';
import type { SeatInfo, TripDetail } from '../../models/catalogue/index.js';
import { navigate, usePathname } from '../../router';
import { Alert, Button, EmptyState, SelectField, Spinner } from '../../ui/index.js';
import {
  BOARDING_REQUIRED_NOTICE,
  MIN_SEATS,
  NO_BOARDING_POINTS_NOTICE,
  NO_SEATS_MESSAGE,
  NO_SEATS_TITLE,
  SEAT_STATE_LABELS,
  SEAT_STATE_MARKS,
  SELECT_SEATS_NOTICE,
  TRIP_NOT_FOUND_MESSAGE,
  boardingOptions,
  describeTripError,
  initialBoardingPointId,
  initialSelection,
  orderedSelection,
  passengersPath,
  readTripDetail,
  seatCountLabel,
  seatRows,
  seatStateOf,
  seatTakenNotice,
  toggleSeat,
  totalFare,
  type SeatCellState,
} from './selection.js';
import './seat-selection.css';

/** Every state of the deck, in the order the legend lists them. */
const LEGEND_STATES: readonly SeatCellState[] = ['available', 'booked', 'selected'];

/** The screen's query string, read at load so a returning traveller keeps their picks. */
function currentSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search;
}

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * THE SEAT SELECTION SCREEN — `/trips/:tripId/seats`.
 *
 * The seat map is fetched fresh from `GET /api/trips/:tripId` every time the screen opens, so what a
 * traveller taps is the server's state at load time. Available seats are white, booked seats are grey
 * and not selectable, and this traveller's picks are green (each state also carrying a word and a
 * mark). At most six seats go into one booking; a seventh pick is refused with a notice. The boarding
 * point is chosen from the list configured for that bus, the total fare runs along beside the
 * selection, and Continue hands both over to passenger details.
 */
export function SeatSelectionScreen(): JSX.Element {
  const pathname = usePathname();
  const tripId = useMemo(() => tripIdOf(pathname), [pathname]);

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [boardingPointId, setBoardingPointId] = useState('');

  useEffect(() => {
    if (tripId === null) {
      setStatus('error');
      setTrip(null);
      setError(TRIP_NOT_FOUND_MESSAGE);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setStatus('loading');
    setError(null);

    apiFetch<unknown>(`/trips/${encodeURIComponent(tripId)}`, { signal: controller.signal })
      .then((payload: unknown) => {
        if (!active) return;
        const detail = readTripDetail(payload);
        if (detail === null) {
          setStatus('error');
          setTrip(null);
          setError(TRIP_NOT_FOUND_MESSAGE);
          return;
        }
        const search = currentSearch();
        setTrip(detail);
        setSelected(initialSelection(detail, search));
        setBoardingPointId(initialBoardingPointId(detail, search));
        setNotice(seatTakenNotice(search));
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setStatus('error');
        setTrip(null);
        setError(describeTripError(cause));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [tripId]);

  const rows = useMemo(() => (trip === null ? [] : seatRows(trip.seats)), [trip]);
  const ordered = useMemo(() => (trip === null ? [] : orderedSelection(trip.seats, selected)), [trip, selected]);

  const points = trip === null ? [] : trip.boardingPoints;
  const requiresBoarding = points.length > 0;
  const total = trip === null ? 0 : totalFare(trip.farePerSeat, ordered.length);
  const canContinue =
    trip !== null && ordered.length >= MIN_SEATS && (!requiresBoarding || boardingPointId !== '');

  const facts: ReadonlyArray<{ label: string; value: string }> =
    trip === null
      ? []
      : [
          { label: 'Bus type', value: BUS_TYPE_LABELS[trip.busType] },
          { label: 'Route', value: `${trip.fromCity.name} \u2192 ${trip.toCity.name}` },
          { label: 'Travel date', value: formatDate(trip.departureAt) },
          { label: 'Departure', value: formatTime(trip.departureAt) },
          { label: 'Fare per seat', value: formatINR(trip.farePerSeat) },
        ];

  const handleSeat = (seat: SeatInfo): void => {
    const result = toggleSeat(selected, seat);
    setSelected(result.seats);
    setNotice(result.notice);
  };

  const handleBoardingChange = (value: string): void => {
    setBoardingPointId(value);
    setNotice(null);
  };

  const handleContinue = (): void => {
    if (trip === null || tripId === null) return;
    if (ordered.length < MIN_SEATS) {
      setNotice(SELECT_SEATS_NOTICE);
      return;
    }
    if (requiresBoarding && boardingPointId === '') {
      setNotice(BOARDING_REQUIRED_NOTICE);
      return;
    }
    navigate(passengersPath(tripId, ordered, boardingPointId));
  };

  return (
    <div className="seat-selection" data-testid="seat-selection-screen-page">
      <PageHeader
        title="Select seats"
        description={
          trip === null
            ? 'Choose up to six seats and your boarding point.'
            : `${trip.busName} \u00b7 ${BUS_TYPE_LABELS[trip.busType]}`
        }
      />

      {error !== null ? (
        <div data-testid="seat-selection-screen-error">
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}

      {notice !== null ? (
        <div data-testid="seat-selection-screen-notice">
          <Alert kind="info">{notice}</Alert>
        </div>
      ) : null}

      {trip !== null ? (
        <section className="seat-selection-trip" aria-label="Bus details">
          <h2 className="seat-selection-trip-name" data-testid="seat-selection-screen-bus">
            {trip.busName}
          </h2>
          <dl className="seat-selection-facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="seat-selection-fact-label">{fact.label}</dt>
                <dd className="seat-selection-fact-value">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="seat-selection-map" aria-label="Seat map">
        <h2 className="seat-selection-section-title">Seat map</h2>
        <ul className="seat-selection-legend">
          {LEGEND_STATES.map((state) => (
            <li key={state} className="seat-selection-legend-item">
              <span className={`seat-selection-swatch is-${state}`} aria-hidden="true">
                {SEAT_STATE_MARKS[state]}
              </span>
              {SEAT_STATE_LABELS[state]}
            </li>
          ))}
        </ul>

        {status === 'loading' ? <Spinner label="Loading the seat map" /> : null}

        {status === 'ready' && rows.length === 0 ? (
          <EmptyState title={NO_SEATS_TITLE} message={NO_SEATS_MESSAGE} />
        ) : null}

        {rows.length > 0 ? (
          <div className="seat-selection-deck" data-testid="seat-selection-screen-deck">
            {rows.map((row) => (
              <div className="seat-selection-row" key={`seat-row-${row.row}`}>
                {row.seats.map((seat) => {
                  const state = seatStateOf(seat, selected);
                  return (
                    <button
                      key={seat.number}
                      type="button"
                      className={`seat-selection-seat is-${state}`}
                      data-testid={`seat-selection-screen-seat-${seat.number}`}
                      aria-pressed={state === 'selected'}
                      aria-label={`Seat ${seat.number}, ${SEAT_STATE_LABELS[state]}`}
                      disabled={seat.isBooked}
                      onClick={() => handleSeat(seat)}
                    >
                      <span>{seat.number}</span>
                      <span className="seat-selection-seat-mark" aria-hidden="true">
                        {SEAT_STATE_MARKS[state]}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="seat-selection-boarding" aria-label="Boarding point">
        <h2 className="seat-selection-section-title">Boarding point</h2>
        <SelectField
          label="Boarding point"
          name="boardingPointId"
          value={boardingPointId}
          onChange={handleBoardingChange}
          options={boardingOptions(points)}
          required={requiresBoarding}
          disabled={!requiresBoarding}
        />
        {status === 'ready' && !requiresBoarding ? (
          <p className="seat-selection-hint">{NO_BOARDING_POINTS_NOTICE}</p>
        ) : null}
      </section>

      <section className="seat-selection-summary" aria-label="Fare summary">
        <p className="seat-selection-chosen" data-testid="seat-selection-screen-seats">
          Selected seats: <strong>{ordered.length === 0 ? 'none yet' : ordered.join(', ')}</strong>
        </p>
        <p className="seat-selection-total" data-testid="seat-selection-screen-total">
          Total fare <strong>{formatINR(total)}</strong> for {seatCountLabel(ordered.length)}
        </p>
        <div className="seat-selection-actions">
          <Button onClick={handleContinue} disabled={!canContinue}>
            Continue
          </Button>
        </div>
      </section>
    </div>
  );
}

/** Kept beside the component so the screen needs no props: the trip is in its own address. */
function tripIdOf(pathname: string): string | null {
  const match = /^\/trips\/([^/]+)\/seats\/?$/.exec(pathname);
  if (match === null) return null;
  const raw = match[1] ?? '';
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const id = decoded.trim();
  return id === '' ? null : id;
}

export default SeatSelectionScreen;
