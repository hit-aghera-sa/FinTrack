// src/features/search/form/UpcomingDepartures.tsx
//
// THE "DEPARTING SOON" SHORTCUT on /search.
//
// Before a traveller has chosen a route, the search screen offers the next buses to leave as real
// links straight to their seat map, so the catalogue is reachable from the screen the app opens on
// and a bus can be opened without filling the form first. It is a nicety: when the shortcut cannot
// be read it is simply not shown, and the search form above is untouched.
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../api/index.js';
import { formatDate, formatTime } from '../../../format/index.js';
import type { TripSummary } from '../../../models/catalogue/index.js';
import { Link } from '../../../router';
import {
  seatsBadgeClass,
  seatsLeftLabel,
  toTripList,
  upcomingEarliestFirst,
} from '../results/results-order.js';
import './UpcomingDepartures.css';

/** `GET /api/trips/upcoming` — the next departures of any route, earliest first. */
export const UPCOMING_TRIPS_PATH = '/trips/upcoming';

/** The seat map of one bus. */
export function upcomingSeatMapPath(tripId: string): string {
  return `/trips/${encodeURIComponent(tripId)}/seats`;
}

export function UpcomingDepartures(): JSX.Element | null {
  const [trips, setTrips] = useState<readonly TripSummary[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    const load = async (): Promise<void> => {
      try {
        const payload = await apiFetch<unknown>(UPCOMING_TRIPS_PATH, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setTrips(upcomingEarliestFirst(toTripList(payload), new Date()));
      } catch {
        // No shortcut rather than a broken one: the search form stays the way in.
      }
    };

    void load();
    return () => {
      controller.abort();
    };
  }, []);

  if (trips.length === 0) return null;

  return (
    <section
      className="card upcoming-departures"
      aria-labelledby="upcoming-departures-title"
      data-testid="search-upcoming-departures"
    >
      <div className="card-body">
        <h2 className="upcoming-title" id="upcoming-departures-title">
          Departing soon
        </h2>
        <p className="page-description">Open the seat map of the next buses to leave.</p>
        <ul className="upcoming-list">
          {trips.map((trip) => (
            <li className="upcoming-item" key={trip.id}>
              <Link className="upcoming-link" to={upcomingSeatMapPath(trip.id)}>
                {trip.busName}
              </Link>
              <span className="upcoming-route">
                {trip.fromCity.name} to {trip.toCity.name}
              </span>
              <span className="upcoming-when">
                {formatDate(trip.departureAt)}, {formatTime(trip.departureAt)}
              </span>
              <span className={seatsBadgeClass(trip.seatsLeft)}>{seatsLeftLabel(trip.seatsLeft)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default UpcomingDepartures;
