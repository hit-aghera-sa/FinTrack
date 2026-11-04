import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { UNEXPECTED_MESSAGE, apiFetch } from '../../api/index.js';
import { PageHeader } from '../../components/PageHeader';
import { payOnBoardingMessage } from '../../messages/index.js';
import type { BookingRecord } from '../../models/bookings/index.js';
import type { TripDetail } from '../../models/catalogue/index.js';
import { matchPath, navigate, usePathname } from '../../router';
import { Alert, Button, EmptyState, SelectField, Spinner, TextField } from '../../ui/index.js';
import {
  BOOKINGS_REQUEST_PATH,
  PASSENGER_DETAILS_ROUTE,
  SEARCH_PATH,
  bookingConfirmedPath,
  currentSearch,
  parsePassengerQuery,
  seatMapPath,
  tripDetailRequestPath,
} from './query.js';
import { PASSENGER_DETAILS_STYLES } from './styles.js';
import {
  boardingPointFor,
  boardingPointLabel,
  describeBookingError,
  isSeatTakenError,
  seatTakenMessage,
  summaryRows,
  totalFare,
} from './summary.js';
import {
  GENDER_SELECT_OPTIONS,
  PASSENGER_AGE_MAX,
  PASSENGER_AGE_MIN,
  PASSENGER_NAME_MAX_LENGTH,
  emptyPassengerForm,
  hasPassengerErrors,
  noPassengerErrors,
  toPassengerInputs,
  validatePassenger,
  type PassengerField,
  type PassengerFormErrors,
  type PassengerFormValues,
} from './validation.js';

/** How far the trip's own details have got. */
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

const NO_BOARDING_POINT_MESSAGE = 'This bus has no boarding point to pick up from. Please choose another bus.';

function withField(form: PassengerFormValues, field: PassengerField, value: string): PassengerFormValues {
  if (field === 'name') return { ...form, name: value };
  if (field === 'age') return { ...form, age: value };
  return { ...form, gender: value };
}

function clearField(errors: PassengerFormErrors, field: PassengerField): PassengerFormErrors {
  if (field === 'name') return { ...errors, name: null };
  if (field === 'age') return { ...errors, age: null };
  return { ...errors, gender: null };
}

/**
 * THE PASSENGER DETAILS & BOOKING SUMMARY SCREEN (`/trips/:tripId/passengers`).
 *
 * The chosen seats and the boarding point arrive in this screen's own query string
 * (`?seats=A1,A2&boarding=bp-shivaji`); the bus, its fare and its boarding points are read from
 * `GET /api/trips/:tripId`. One name / age / gender form is collected per seat, the summary states
 * bus, travel date, departure time, boarding point, seat numbers, fare per seat and total fare, and
 * Confirm booking creates the booking with `POST /api/bookings`.
 *
 * Seats are never held during selection: if one was taken in between, the whole booking fails, the
 * seat-just-booked sentence is shown, and the traveller is offered the refreshed seat map.
 */
export function PassengerDetailsScreen(): JSX.Element {
  const pathname = usePathname();
  const params = matchPath(PASSENGER_DETAILS_ROUTE, pathname);
  const routeTripId = params === null ? undefined : params.tripId;
  const tripId = typeof routeTripId === 'string' && routeTripId !== '' ? routeTripId : null;

  const [search] = useState<string>(currentSearch);
  const query = useMemo(() => parsePassengerQuery(search), [search]);
  const seats = query.seats;

  const [forms, setForms] = useState<PassengerFormValues[]>(() => seats.map((seat) => emptyPassengerForm(seat)));
  const [errors, setErrors] = useState<PassengerFormErrors[]>(() => seats.map(() => noPassengerErrors()));

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<number>(0);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const seatCount = seats.length;

  useEffect(() => {
    if (tripId === null || seatCount === 0) return undefined;

    let active = true;
    const controller = new AbortController();
    setStatus('loading');
    setLoadError(null);

    apiFetch<TripDetail>(tripDetailRequestPath(tripId), { signal: controller.signal })
      .then((detail: TripDetail) => {
        if (!active) return;
        setTrip(detail);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(describeBookingError(error));
        setStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [tripId, seatCount, attempt]);

  const boardingPoint = useMemo(
    () => (trip === null ? null : boardingPointFor(trip, query.boardingPointId)),
    [trip, query.boardingPointId],
  );

  const updateField = (index: number, field: PassengerField, value: string): void => {
    setForms((current) => current.map((form, at) => (at === index ? withField(form, field, value) : form)));
    setErrors((current) => current.map((item, at) => (at === index ? clearField(item, field) : item)));
  };

  const errorsAt = (index: number): PassengerFormErrors => errors[index] ?? noPassengerErrors();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (trip === null || tripId === null || submitting) return;

    const checked = forms.map((form) => validatePassenger(form));
    setErrors(checked);
    setSubmitError(null);
    if (checked.some((item) => hasPassengerErrors(item))) return;

    if (boardingPoint === null) {
      setSubmitError(NO_BOARDING_POINT_MESSAGE);
      return;
    }

    setSubmitting(true);
    apiFetch<BookingRecord>(BOOKINGS_REQUEST_PATH, {
      method: 'POST',
      body: {
        tripId,
        boardingPointId: boardingPoint.id,
        passengers: toPassengerInputs(forms),
      },
    })
      .then((booking: BookingRecord) => {
        navigate(bookingConfirmedPath(booking.id));
      })
      .catch((error: unknown) => {
        setSubmitting(false);
        if (isSeatTakenError(error)) {
          setConflict(seatTakenMessage(error, seats));
          return;
        }
        setSubmitError(describeBookingError(error));
      });
  };

  let content: JSX.Element;

  if (tripId === null) {
    content = (
      <div className="pd-section">
        <Alert kind="error">We could not tell which bus this booking is for. Please search again.</Alert>
        <div className="pd-actions">
          <Button variant="secondary" onClick={() => navigate(SEARCH_PATH)}>
            Back to search
          </Button>
        </div>
      </div>
    );
  } else if (seatCount === 0) {
    content = (
      <EmptyState
        title="No seats chosen yet"
        message="Pick your seats and a boarding point on the seat map, then come back here to add a passenger for every seat."
        action={<Button onClick={() => navigate(seatMapPath(tripId))}>Choose seats</Button>}
      />
    );
  } else if (conflict !== null) {
    content = (
      <div className="pd-section" data-testid="passenger-details-booking-summary-screen-conflict">
        <Alert kind="error">{conflict}</Alert>
        <p className="pd-note">
          Nothing was booked and nothing is owed. Open the seat map again for an up-to-date view of the bus.
        </p>
        <div className="pd-actions">
          <Button onClick={() => navigate(seatMapPath(tripId))}>Choose another seat</Button>
        </div>
      </div>
    );
  } else if (status === 'error') {
    content = (
      <div className="pd-section">
        <Alert kind="error">{loadError ?? UNEXPECTED_MESSAGE}</Alert>
        <div className="pd-actions">
          <Button variant="secondary" onClick={() => setAttempt((count) => count + 1)}>
            Try again
          </Button>
        </div>
      </div>
    );
  } else if (status !== 'ready' || trip === null) {
    content = <Spinner label="Loading your trip…" />;
  } else {
    const rows = summaryRows(trip, seats, boardingPointLabel(boardingPoint));
    content = (
      <form className="pd-form" aria-label="Passenger details and booking summary" onSubmit={handleSubmit} noValidate>
        <section className="pd-section" aria-labelledby="pd-travellers-title">
          <h2 className="pd-section-title" id="pd-travellers-title">
            Who is travelling?
          </h2>
          <div className="pd-seat-list">
            {forms.map((form, index) => (
              <div
                className="pd-seat-card"
                key={form.seatNumber}
                data-testid={`passenger-details-booking-summary-screen-seat-${form.seatNumber}`}
              >
                <h3 className="pd-seat-heading">Seat {form.seatNumber}</h3>
                <div className="pd-seat-fields">
                  <TextField
                    label={`Name (seat ${form.seatNumber})`}
                    name={`passenger-name-${form.seatNumber}`}
                    value={form.name}
                    onChange={(value: string) => updateField(index, 'name', value)}
                    error={errorsAt(index).name}
                    required
                    maxLength={PASSENGER_NAME_MAX_LENGTH}
                    placeholder="Name as on ID"
                    disabled={submitting}
                  />
                  <TextField
                    label={`Age (seat ${form.seatNumber})`}
                    name={`passenger-age-${form.seatNumber}`}
                    value={form.age}
                    onChange={(value: string) => updateField(index, 'age', value)}
                    type="number"
                    min={String(PASSENGER_AGE_MIN)}
                    max={String(PASSENGER_AGE_MAX)}
                    error={errorsAt(index).age}
                    required
                    disabled={submitting}
                  />
                  <SelectField
                    label={`Gender (seat ${form.seatNumber})`}
                    name={`passenger-gender-${form.seatNumber}`}
                    value={form.gender}
                    onChange={(value: string) => updateField(index, 'gender', value)}
                    options={GENDER_SELECT_OPTIONS}
                    error={errorsAt(index).gender}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className="pd-section"
          aria-labelledby="pd-summary-title"
          data-testid="passenger-details-booking-summary-screen-summary"
        >
          <h2 className="pd-section-title" id="pd-summary-title">
            Booking summary
          </h2>
          <dl className="pd-summary">
            {rows.map((row) => (
              <div className={row.emphasis === true ? 'pd-summary-row is-total' : 'pd-summary-row'} key={row.key}>
                <dt className="pd-summary-label">{row.label}</dt>
                <dd className="pd-summary-value">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="pd-note">{payOnBoardingMessage(totalFare(trip.farePerSeat, seatCount))}</p>
          {submitError !== null ? <Alert kind="error">{submitError}</Alert> : null}
          <div className="pd-actions">
            <Button type="submit" loading={submitting} disabled={submitting}>
              Confirm booking
            </Button>
            <Button variant="secondary" disabled={submitting} onClick={() => navigate(seatMapPath(tripId))}>
              Change seats
            </Button>
          </div>
        </section>
      </form>
    );
  }

  return (
    <section className="pd-screen" data-testid="passenger-details-booking-summary-screen-page">
      <style>{PASSENGER_DETAILS_STYLES}</style>
      <PageHeader
        title="Passenger details"
        description="Add a traveller for every seat you chose, check the summary, then confirm your booking."
      />
      {content}
    </section>
  );
}

export default PassengerDetailsScreen;
