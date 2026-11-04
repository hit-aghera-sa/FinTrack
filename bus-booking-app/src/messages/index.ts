import { formatINR } from '../format/index.js';

/**
 * THE MESSAGE CATALOGUE — the single place every user-facing sentence in the app is written.
 *
 * The web client and the server both read these strings, so an error body and the sentence a traveller
 * sees are the same words. Nothing here is a template to be re-typed in a screen: a sentence that
 * carries a value is a builder function, so the value is formatted the one approved way.
 *
 * All notification is on-screen only — no email, no SMS.
 */
export interface MessageCatalogue {
  /** Sign-up refused because the mobile number is already an account. */
  readonly duplicateMobile: string;
  /** The two password fields differ. */
  readonly passwordMismatch: string;
  /** Unknown mobile number or wrong password — deliberately the same sentence for both. */
  readonly loginIncorrect: string;
  /** Five consecutive failed log-ins; the account is locked for 15 minutes. */
  readonly accountLocked: string;
  /** The security answer given does not match. */
  readonly wrongSecurityAnswer: string;
  /** Five wrong security answers; password reset is blocked for 1 hour. */
  readonly resetBlocked: string;
  /** The search form has the same city in From and To. */
  readonly sameCity: string;
  /** The search found no bus on that route and date. */
  readonly noBuses: string;
  /** The traveller has never made a booking. */
  readonly noBookings: string;
  /** The backend could not be reached. */
  readonly offline: string;
  /** A password change succeeded. */
  readonly passwordChanged: string;
  /** Badge/label for a trip with no seat left. */
  readonly soldOut: string;
  /** Heading of the cancellation confirmation dialog. */
  readonly cancelConfirmTitle: string;
  /** The dialog's confirming button. */
  readonly cancelConfirmYes: string;
  /** The dialog's dismissing button. */
  readonly cancelConfirmNo: string;
  /** Cancellation refused: inside the last hour, or already cancelled or completed. */
  readonly cancelNotAllowed: string;
  /** The current password given for a profile change or account deletion is wrong. */
  readonly currentPasswordIncorrect: string;
  /** Greeting shown immediately after sign-up. */
  readonly welcome: (name: string) => string;
  /** Confirmation after a booking is cancelled, naming the human booking reference. */
  readonly bookingCancelled: (bookingId: string) => string;
  /** A chosen seat was taken between seat selection and confirmation. */
  readonly seatJustBooked: (seatNumber: string) => string;
}

export const MESSAGES: MessageCatalogue = {
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
  welcome: (name: string): string => `Welcome, ${name}! Your account is ready.`,
  bookingCancelled: (bookingId: string): string => `Your booking ${bookingId} has been cancelled.`,
  seatJustBooked: (seatNumber: string): string =>
    `Sorry, seat ${seatNumber} was just booked. Please choose another seat.`,
};

/**
 * The pay-on-boarding sentence, with the total handed over formatted the one approved way:
 * `payOnBoardingMessage(1200)` is `Pay ₹1,200 in cash or UPI to the bus staff when boarding.`
 *
 * No money moves through the product, so this sentence is the whole of "payment" a traveller sees.
 */
export function payOnBoardingMessage(totalFare: number): string {
  return `Pay ${formatINR(totalFare)} in cash or UPI to the bus staff when boarding.`;
}
