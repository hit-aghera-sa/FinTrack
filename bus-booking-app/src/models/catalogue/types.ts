/**
 * THE TRAVEL CATALOGUE DOMAIN — cities, trips, seat maps and boarding points — declared ONCE for the
 * whole app.
 *
 * Every lane (search API, seat map API, booking creation, and the screens behind them) imports these
 * types from `src/models/catalogue` instead of re-declaring them, so one change to the shape of a trip
 * is one change in the product.
 *
 * Types only: no React, no Prisma, no fetching. The implementation of `TripRepository` lives in
 * `src/db/catalogue`.
 */

/** A city a traveller can board at or travel to. */
export interface City {
  id: string;
  name: string;
}

/** AC/Non-AC × Seater/Sleeper — the four kinds of bus this product sells. */
export type BusType = 'AC_SEATER' | 'AC_SLEEPER' | 'NON_AC_SEATER' | 'NON_AC_SLEEPER';

/**
 * One seat of a trip's seat map.
 *
 * `row` and `column` are the seat's position in the layout grid (both 1-based), so a screen can draw
 * the map without parsing the seat number. `isBooked` is true when an active booking holds the seat.
 */
export interface SeatInfo {
  number: string;
  row: number;
  column: number;
  isBooked: boolean;
}

/**
 * A pickup point of the bus running a trip.
 *
 * `pickupAt` is an ISO-8601 instant whenever the datastore holds a full timestamp for the pickup;
 * when it only holds a clock time that cannot be placed on the travel day, the stored text is passed
 * through unchanged so the screen can still show it.
 */
export interface BoardingPoint {
  id: string;
  name: string;
  pickupAt: string;
}

/**
 * One trip as a search result: everything the results list shows, with the seat counts already
 * derived (`seatsLeft === 0` is the sold-out case).
 *
 * `departureAt` / `arrivalAt` are ISO-8601 instants; screens format them in India time through
 * `src/format`. `farePerSeat` is whole rupees.
 */
export interface TripSummary {
  id: string;
  busName: string;
  busType: BusType;
  fromCity: City;
  toCity: City;
  departureAt: string;
  arrivalAt: string;
  farePerSeat: number;
  seatsLeft: number;
  totalSeats: number;
}

/** A trip with its full seat map (in layout order) and its boarding points. */
export interface TripDetail extends TripSummary {
  seats: SeatInfo[];
  boardingPoints: BoardingPoint[];
}

/**
 * What a bus search asks for: a route, a calendar day (`YYYY-MM-DD`, read in India time) and the
 * instant the search is being made, so a trip that has already left is never offered.
 */
export interface TripSearchParams {
  fromCityId: string;
  toCityId: string;
  date: string;
  now: Date;
}

/**
 * What the "departing soon" shortcut asks for: the next departures across every route, from the
 * instant of the request, at most `limit` of them.
 */
export interface UpcomingTripsParams {
  now: Date;
  limit: number;
}

/** The catalogue's read surface. Implemented by `tripRepository` in `src/db/catalogue`. */
export interface TripRepository {
  /** Every city, ordered by name. */
  listCities(): Promise<City[]>;
  /** Trips on the route that depart after `now` on the requested India-time calendar day. */
  search(params: TripSearchParams): Promise<TripSummary[]>;
  /** The next departures of any route after `now`, earliest first, at most `limit` of them. */
  listUpcoming(params: UpcomingTripsParams): Promise<TripSummary[]>;
  /** The trip with its seat map and boarding points, or null when no such trip exists. */
  findDetail(tripId: string): Promise<TripDetail | null>;
}
