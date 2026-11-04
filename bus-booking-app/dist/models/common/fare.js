/**
 * Fares are whole rupees throughout this app, and a booking's total is always derived — never a
 * number the client sends.
 */
export function totalFareFor(seatCount, farePerSeat) {
    if (!Number.isInteger(seatCount) || seatCount < 0) {
        throw new RangeError('Seat count must be a non-negative integer');
    }
    if (!Number.isInteger(farePerSeat) || farePerSeat < 0) {
        throw new RangeError('Fare per seat must be a non-negative whole number of rupees');
    }
    return seatCount * farePerSeat;
}
