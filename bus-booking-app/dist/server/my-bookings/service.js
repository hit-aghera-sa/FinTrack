import { splitBookings } from './split.js';
export function createMyBookingsService(deps) {
    const clock = deps.now ?? (() => new Date());
    return {
        async list(userId) {
            const now = clock();
            const bookings = await deps.bookings.listByUser(userId, now);
            return splitBookings(bookings, now);
        },
        async ticket(bookingId, userId) {
            const now = clock();
            const booking = await deps.bookings.findByIdForUser(bookingId, userId, now);
            if (booking === null)
                return { ok: false, code: 'not_found' };
            return { ok: true, booking };
        },
    };
}
