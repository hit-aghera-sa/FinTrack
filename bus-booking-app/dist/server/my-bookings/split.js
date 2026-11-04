/** An ISO-8601 instant as milliseconds, treating unreadable text as the epoch rather than NaN. */
export function instantMs(iso) {
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? 0 : ms;
}
/**
 * True when the booking belongs on the Upcoming tab: a live booking on a bus that has not left yet.
 * A cancelled booking is never upcoming, even when its bus is still ahead.
 */
export function isUpcoming(booking, now) {
    if (booking.status === 'CANCELLED')
        return false;
    return instantMs(booking.departureAt) > now.getTime();
}
/** Soonest departure first; a shared departure is settled by the older booking first. */
export function compareSoonestFirst(a, b) {
    const byDeparture = instantMs(a.departureAt) - instantMs(b.departureAt);
    if (byDeparture !== 0)
        return byDeparture;
    return instantMs(a.createdAt) - instantMs(b.createdAt);
}
/** Newest departure first; a shared departure is settled by the newer booking first. */
export function compareNewestFirst(a, b) {
    const byDeparture = instantMs(b.departureAt) - instantMs(a.departureAt);
    if (byDeparture !== 0)
        return byDeparture;
    return instantMs(b.createdAt) - instantMs(a.createdAt);
}
/** One account's bookings as the two ordered tabs the My bookings screen draws. */
export function splitBookings(bookings, now) {
    const upcoming = bookings.filter((booking) => isUpcoming(booking, now));
    const past = bookings.filter((booking) => !isUpcoming(booking, now));
    upcoming.sort(compareSoonestFirst);
    past.sort(compareNewestFirst);
    return { upcoming, past };
}
