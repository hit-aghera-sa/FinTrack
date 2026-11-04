import { parseSearchQuery } from './validation.js';
/** How many next departures the search screen's shortcut shows. */
export const UPCOMING_TRIPS_LIMIT = 4;
function departureMs(trip) {
    const ms = Date.parse(trip.departureAt);
    // An unreadable departure is never silently dropped from the results; it simply sorts last.
    return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}
function compareDeparture(left, right) {
    const a = departureMs(left);
    const b = departureMs(right);
    if (a === b)
        return left.id.localeCompare(right.id);
    return a < b ? -1 : 1;
}
/**
 * The results as the API states them: only the buses that have NOT yet departed, earliest departure
 * first. A bus that left at or before `now` is gone, however it reached this list.
 */
export function onlyUpcoming(trips, now) {
    const cutoff = now.getTime();
    return trips.filter((trip) => departureMs(trip) > cutoff).sort(compareDeparture);
}
export function createSearchService(deps) {
    const clock = deps.now ?? (() => new Date());
    return {
        listCities() {
            return deps.trips.listCities();
        },
        async searchTrips(input) {
            const at = clock();
            const parsed = parseSearchQuery(input, at);
            if (!parsed.ok)
                return { ok: false, failure: parsed.failure };
            const found = await deps.trips.search({
                fromCityId: parsed.query.fromCityId,
                toCityId: parsed.query.toCityId,
                date: parsed.query.date,
                now: at,
            });
            return { ok: true, trips: onlyUpcoming(found, at) };
        },
        async listUpcomingTrips() {
            const at = clock();
            const found = await deps.trips.listUpcoming({ now: at, limit: UPCOMING_TRIPS_LIMIT });
            return onlyUpcoming(found, at).slice(0, UPCOMING_TRIPS_LIMIT);
        },
    };
}
