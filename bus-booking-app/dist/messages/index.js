import { formatINR } from '../format/index.js';
export const MESSAGES = {
    duplicateMobile: 'An account with this mobile number already exists. Please log in.',
    passwordMismatch: 'Passwords do not match.',
    loginIncorrect: 'Mobile number or password is incorrect.',
    accountLocked: 'Too many attempts. Please try again after 15 minutes.',
    wrongSecurityAnswer: 'That answer is not correct.',
    resetBlocked: 'Too many attempts. Password reset for this mobile number is blocked for 1 hour.',
    sameCity: 'From and To cannot be the same city.',
    noBuses: 'No buses found for this route on this date.',
    noBookings: 'You have no bookings yet.',
    offline: 'No internet connection. Please check and try again.',
    passwordChanged: 'Your password has been changed.',
    soldOut: 'Sold out',
    cancelConfirmTitle: 'Cancel this booking?',
    cancelConfirmYes: 'Yes, cancel',
    cancelConfirmNo: 'No',
    cancelNotAllowed: 'This booking can no longer be cancelled.',
    currentPasswordIncorrect: 'Your current password is incorrect.',
    welcome: (name) => `Welcome, ${name}! Your account is ready.`,
    bookingCancelled: (bookingId) => `Your booking ${bookingId} has been cancelled.`,
    seatJustBooked: (seatNumber) => `Sorry, seat ${seatNumber} was just booked. Please choose another seat.`,
};
/**
 * The pay-on-boarding sentence, with the total handed over formatted the one approved way:
 * `payOnBoardingMessage(1200)` is `Pay ₹1,200 in cash or UPI to the bus staff when boarding.`
 *
 * No money moves through the product, so this sentence is the whole of "payment" a traveller sees.
 */
export function payOnBoardingMessage(totalFare) {
    return `Pay ${formatINR(totalFare)} in cash or UPI to the bus staff when boarding.`;
}
