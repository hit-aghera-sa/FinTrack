/** Every booking id in this app reads `BB-` followed by five digits, e.g. `BB-10452`. */
export const BOOKING_ID_PREFIX = 'BB-';
/** The exact shape of a booking id. No flags, so it is safe to share. */
export const BOOKING_ID_PATTERN = /^BB-\d{5}$/;
const MIN_SERIAL = 1;
const MAX_SERIAL = 99999;
/**
 * Render a booking serial as the app's booking id: `formatBookingId(10452) === 'BB-10452'`.
 *
 * @throws RangeError when the serial cannot be shown as five digits.
 */
export function formatBookingId(serial) {
    if (!Number.isInteger(serial) || serial < MIN_SERIAL || serial > MAX_SERIAL) {
        throw new RangeError(`Booking serial must be an integer between ${MIN_SERIAL} and ${MAX_SERIAL}`);
    }
    return BOOKING_ID_PREFIX + String(serial).padStart(5, '0');
}
/** True when `value` is a booking id of the app's own shape. */
export function isBookingId(value) {
    return typeof value === 'string' && BOOKING_ID_PATTERN.test(value);
}
