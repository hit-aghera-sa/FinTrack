import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../messages/index.js';
import type { SeatInfo, TripDetail } from '../../models/catalogue/index.js';
import {
  BOARDING_PLACEHOLDER_LABEL,
  MAX_SEATS,
  SEAT_BOOKED_NOTICE,
  SEAT_LIMIT_NOTICE,
  boardingOptions,
  boardingPointLabel,
  describeTripError,
  initialBoardingPointId,
  initialSelection,
  orderedSelection,
  parseSeatsParam,
  passengersPath,
  readTripDetail,
  seatCountLabel,
  seatRows,
  seatStateOf,
  seatTakenNotice,
  toggleSeat,
  totalFare,
  tripIdFromPath,
} from './selection.js';

const SEAT_NUMBERS: readonly string[] = [
  'A1',
  'A2',
  'A3',
  'A4',
  'B1',
  'B2',
  'B3',
  'B4',
  'C1',
  'C2',
  'C3',
  'C4',
];

function seat(number: string, isBooked = false): SeatInfo {
  const index = SEAT_NUMBERS.indexOf(number);
  const position = index < 0 ? 0 : index;
  return {
    number,
    row: Math.floor(position / 4) + 1,
    column: (position % 4) + 1,
    isBooked,
  };
}

function seatsFixture(): SeatInfo[] {
  return SEAT_NUMBERS.map((number) => seat(number, number === 'A3'));
}

function tripFixture(): TripDetail {
  return {
    id: 'trip-koyna',
    busName: 'Koyna Travels Volvo',
    busType: 'AC_SLEEPER',
    fromCity: { id: 'city-pune', name: 'Pune' },
    toCity: { id: 'city-mumbai', name: 'Mumbai' },
    departureAt: '2025-03-12T16:00:00.000Z',
    arrivalAt: '2025-03-12T20:30:00.000Z',
    farePerSeat: 850,
    seatsLeft: 11,
    totalSeats: 12,
    seats: seatsFixture(),
    boardingPoints: [
      { id: 'bp-shivajinagar', name: 'Shivajinagar', pickupAt: '2025-03-12T16:00:00.000Z' },
      { id: 'bp-wakad', name: 'Wakad', pickupAt: '21:45' },
    ],
  };
}

describe('tripIdFromPath', () => {
  it('reads the trip from the seat selection address', () => {
    expect(tripIdFromPath('/trips/trip-koyna/seats')).toBe('trip-koyna');
    expect(tripIdFromPath('/trips/trip-koyna/seats/')).toBe('trip-koyna');
  });

  it('is null for any other address', () => {
    expect(tripIdFromPath('/trips/trip-koyna/passengers')).toBeNull();
    expect(tripIdFromPath('/search')).toBeNull();
  });
});

describe('seatStateOf', () => {
  it('calls a booked seat booked, whatever is selected', () => {
    expect(seatStateOf(seat('A3', true), ['A3'])).toBe('booked');
  });

  it('separates the traveller picks from the free seats', () => {
    expect(seatStateOf(seat('A1'), ['A1'])).toBe('selected');
    expect(seatStateOf(seat('A2'), ['A1'])).toBe('available');
  });
});

describe('toggleSeat', () => {
  it('refuses a booked seat and says why', () => {
    const result = toggleSeat(['A1'], seat('A3', true));
    expect(result.seats).toEqual(['A1']);
    expect(result.notice).toBe(SEAT_BOOKED_NOTICE);
  });

  it('adds a free seat and clears any notice', () => {
    const result = toggleSeat([], seat('A1'));
    expect(result.seats).toEqual(['A1']);
    expect(result.notice).toBeNull();
  });

  it('releases a seat that was already picked', () => {
    const result = toggleSeat(['A1', 'A2'], seat('A1'));
    expect(result.seats).toEqual(['A2']);
    expect(result.notice).toBeNull();
  });

  it('refuses a seventh seat with the ceiling notice', () => {
    const six = ['A1', 'A2', 'A4', 'B1', 'B2', 'B3'];
    expect(six).toHaveLength(MAX_SEATS);
    const result = toggleSeat(six, seat('B4'));
    expect(result.seats).toEqual(six);
    expect(result.notice).toBe(SEAT_LIMIT_NOTICE);
  });

  it('still lets a seat go when six are held', () => {
    const six = ['A1', 'A2', 'A4', 'B1', 'B2', 'B3'];
    const result = toggleSeat(six, seat('B3'));
    expect(result.seats).toEqual(['A1', 'A2', 'A4', 'B1', 'B2']);
    expect(result.notice).toBeNull();
  });
});

describe('orderedSelection and seatRows', () => {
  it('orders the picks the way the deck is drawn', () => {
    expect(orderedSelection(seatsFixture(), ['B2', 'A1'])).toEqual(['A1', 'B2']);
  });

  it('groups the deck into rows, left to right', () => {
    const rows = seatRows(seatsFixture());
    expect(rows).toHaveLength(3);
    expect(rows[0]?.row).toBe(1);
    expect(rows[0]?.seats.map((entry) => entry.number)).toEqual(['A1', 'A2', 'A3', 'A4']);
  });
});

describe('fare running total', () => {
  it('multiplies the fare per seat by the seats held', () => {
    expect(totalFare(850, 0)).toBe(0);
    expect(totalFare(850, 1)).toBe(850);
    expect(totalFare(850, 6)).toBe(5100);
  });

  it('names the seat count in words a person reads', () => {
    expect(seatCountLabel(1)).toBe('1 seat');
    expect(seatCountLabel(3)).toBe('3 seats');
  });
});

describe('continue address', () => {
  it('hands the seats and the boarding point to passenger details', () => {
    expect(passengersPath('trip-koyna', ['A1', 'A2'], 'bp-shivajinagar')).toBe(
      '/trips/trip-koyna/passengers?seats=A1,A2&boarding=bp-shivajinagar',
    );
  });
});

describe('returning to the seat map', () => {
  it('reads the seats named in the address', () => {
    expect(parseSeatsParam('?seats=A1,A2')).toEqual(['A1', 'A2']);
    expect(parseSeatsParam('?seats=')).toEqual([]);
  });

  it('keeps only the picks that are still free, capped at the ceiling', () => {
    const trip = tripFixture();
    expect(initialSelection(trip, '?seats=A1,A3,A2')).toEqual(['A1', 'A2']);
    expect(
      initialSelection(trip, '?seats=A1,A2,A4,B1,B2,B3,B4'),
    ).toEqual(['A1', 'A2', 'A4', 'B1', 'B2', 'B3']);
  });

  it('keeps a boarding point this bus still offers', () => {
    const trip = tripFixture();
    expect(initialBoardingPointId(trip, '?boarding=bp-wakad')).toBe('bp-wakad');
    expect(initialBoardingPointId(trip, '?boarding=bp-elsewhere')).toBe('');
  });

  it('shows the catalogue sentence when a seat was taken in the meantime', () => {
    expect(seatTakenNotice('?seatTaken=A2')).toBe(MESSAGES.seatJustBooked('A2'));
    expect(seatTakenNotice('?seats=A1')).toBeNull();
  });
});

describe('boarding point chooser', () => {
  it('shows the pickup time when the pickup is a real instant', () => {
    const trip = tripFixture();
    const first = trip.boardingPoints[0];
    const second = trip.boardingPoints[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;
    expect(boardingPointLabel(first)).toContain('Shivajinagar');
    expect(boardingPointLabel(second)).toBe('Wakad \u00b7 21:45');
  });

  it('offers a placeholder before the bus points', () => {
    const options = boardingOptions(tripFixture().boardingPoints);
    expect(options[0]).toEqual({ value: '', label: BOARDING_PLACEHOLDER_LABEL });
    expect(options).toHaveLength(3);
  });
});

describe('readTripDetail', () => {
  it('reads the trip detail answered by the seat map endpoint', () => {
    const detail = readTripDetail(tripFixture());
    expect(detail?.busName).toBe('Koyna Travels Volvo');
    expect(detail?.seats).toHaveLength(12);
    expect(detail?.seats.filter((entry) => entry.isBooked).map((entry) => entry.number)).toEqual(['A3']);
  });

  it('accepts the detail wrapped as a trip field', () => {
    const detail = readTripDetail({ trip: tripFixture() });
    expect(detail?.id).toBe('trip-koyna');
    expect(detail?.boardingPoints).toHaveLength(2);
  });

  it('refuses a body with no seat map', () => {
    expect(readTripDetail({ id: 'trip-koyna' })).toBeNull();
    expect(readTripDetail(null)).toBeNull();
    expect(readTripDetail('trip-koyna')).toBeNull();
  });
});

describe('describeTripError', () => {
  it('says the connection failed when the backend was unreachable', () => {
    expect(describeTripError(new TypeError('Failed to fetch'))).toBe(MESSAGES.offline);
  });

  it('falls back to the generic sentence for anything unknown', () => {
    expect(describeTripError('boom')).toBe('Could not load the seat map. Please try again.');
  });
});
