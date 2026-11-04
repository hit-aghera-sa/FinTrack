import { describe, it, expect } from 'vitest';
import { MESSAGES, payOnBoardingMessage } from './index.js';

describe('MESSAGES', () => {
  it('carries the approved account sentences', () => {
    expect(MESSAGES.duplicateMobile).toBe('An account with this mobile number already exists. Please log in.');
    expect(MESSAGES.passwordMismatch).toBe('Passwords do not match.');
    expect(MESSAGES.loginIncorrect).toBe('Mobile number or password is incorrect.');
    expect(MESSAGES.accountLocked).toBe('Too many attempts. Please try again after 15 minutes.');
    expect(MESSAGES.passwordChanged).toBe('Your password has been changed.');
    expect(MESSAGES.currentPasswordIncorrect).toBe('Your current password is incorrect.');
  });

  it('carries the approved password-reset sentences', () => {
    expect(MESSAGES.wrongSecurityAnswer).toBe('That answer is not correct.');
    expect(MESSAGES.resetBlocked).toBe(
      'Too many attempts. Password reset for this mobile number is blocked for 1 hour.',
    );
  });

  it('carries the approved search and booking sentences', () => {
    expect(MESSAGES.sameCity).toBe('From and To cannot be the same city.');
    expect(MESSAGES.noBuses).toBe('No buses found for this route on this date.');
    expect(MESSAGES.noBookings).toBe('You have no bookings yet.');
    expect(MESSAGES.soldOut).toBe('Sold out');
  });

  it('carries the cancellation dialog words and outcomes', () => {
    expect(MESSAGES.cancelConfirmTitle).toBe('Cancel this booking?');
    expect(MESSAGES.cancelConfirmYes).toBe('Yes, cancel');
    expect(MESSAGES.cancelConfirmNo).toBe('No');
    expect(MESSAGES.cancelNotAllowed).toBe('This booking can no longer be cancelled.');
  });

  it('carries the connectivity sentence', () => {
    expect(MESSAGES.offline).toBe('No internet connection. Please check and try again.');
  });

  it('builds the welcome greeting around the traveller name', () => {
    expect(MESSAGES.welcome('Aisha Kapoor')).toBe('Welcome, Aisha Kapoor! Your account is ready.');
  });

  it('names the booking reference in the cancellation confirmation', () => {
    expect(MESSAGES.bookingCancelled('BB-10452')).toBe('Your booking BB-10452 has been cancelled.');
  });

  it('names the lost seat in the seat-taken sentence', () => {
    expect(MESSAGES.seatJustBooked('A1')).toBe('Sorry, seat A1 was just booked. Please choose another seat.');
  });
});

describe('payOnBoardingMessage', () => {
  it('formats the total as whole rupees', () => {
    expect(payOnBoardingMessage(1200)).toBe('Pay ₹1,200 in cash or UPI to the bus staff when boarding.');
  });

  it('works for a single-seat fare', () => {
    expect(payOnBoardingMessage(600)).toBe('Pay ₹600 in cash or UPI to the bus staff when boarding.');
  });

  it('groups a large total Indian-style', () => {
    expect(payOnBoardingMessage(120000)).toBe('Pay ₹1,20,000 in cash or UPI to the bus staff when boarding.');
  });
});
