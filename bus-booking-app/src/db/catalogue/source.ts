/**
 * THE CATALOGUE'S READ SEAM.
 *
 * `createTripRepository` holds the product rules (which trips are still on offer today, how seats-left
 * is derived, in what order a seat map is drawn) and reads rows through this interface. The Prisma /
 * PostgreSQL implementation is `createPrismaCatalogueSource`; the repository's own specs implement it
 * with fixtures, so the rules are verified without a database.
 *
 * Rows are deliberately close to what a datastore returns: real `Date` instants and the bus type
 * spelled however it is stored. Turning those into the shared domain types is the repository's job.
 */

export interface CityRow {
  readonly id: string;
  readonly name: string;
}

export interface TripRow {
  readonly id: string;
  readonly busName: string;
  /** The bus type EXACTLY as the datastore spells it, e.g. `AC Sleeper`. */
  readonly busType: string;
  readonly fromCity: CityRow;
  readonly toCity: CityRow;
  readonly departureAt: Date;
  readonly arrivalAt: Date;
  readonly farePerSeat: number;
}

export interface SeatRow {
  readonly tripId: string;
  readonly number: string;
  readonly row: number;
  readonly column: number;
  readonly isBooked: boolean;
}

export interface BoardingPointRow {
  readonly id: string;
  readonly name: string;
  /** An ISO-8601 instant when one could be derived, otherwise the stored pickup text. */
  readonly pickupAt: string;
}

/**
 * A route to list trips for. The calendar-day and "already departed" rules live in the repository.
 *
 * Both ends are optional: left out, the source lists the trips of every route, which is how the
 * "departing soon" shortcut on the search screen is built.
 */
export interface TripSearchQuery {
  readonly fromCityId?: string;
  readonly toCityId?: string;
}

export interface CatalogueDataSource {
  listCities(): Promise<CityRow[]>;
  listTrips(query: TripSearchQuery): Promise<TripRow[]>;
  findTrip(tripId: string): Promise<TripRow | null>;
  /** Every seat of every named trip, with `isBooked` already settled. */
  listSeats(tripIds: readonly string[]): Promise<SeatRow[]>;
  listBoardingPoints(tripId: string): Promise<BoardingPointRow[]>;
}
