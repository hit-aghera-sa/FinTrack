/**
 * Fare presentation for the Bus Booking App.
 *
 * Fares are exchanged as whole-rupee integers and displayed in whole rupees with the ₹ symbol and a
 * digit separator — `₹1,250`. Grouping follows Indian convention (the last three digits, then pairs:
 * `₹1,20,000`). The grouping is done here rather than through a locale formatter so the output cannot
 * drift with the platform's locale data.
 */
/** The rupee sign used everywhere a fare is shown. */
export const RUPEE_SIGN = '₹';
/** Digits grouped Indian-style: three at the end, then pairs. `120000` → `1,20,000`. */
function groupIndianDigits(digits) {
    if (digits.length <= 3)
        return digits;
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}
/**
 * A whole-rupee amount as it is shown to a traveller — `formatINR(1250)` is `₹1,250`.
 *
 * Paise are never displayed, so a fractional value is rounded to the nearest rupee. A value that is
 * not a finite number renders as `₹0` rather than `₹NaN`.
 */
export function formatINR(rupees) {
    if (!Number.isFinite(rupees))
        return `${RUPEE_SIGN}0`;
    const whole = Math.round(rupees);
    const sign = whole < 0 ? '-' : '';
    return `${sign}${RUPEE_SIGN}${groupIndianDigits(String(Math.abs(whole)))}`;
}
