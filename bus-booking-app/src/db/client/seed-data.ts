import type { PrismaClient } from '@prisma/client';
import { buildSeatGrid, totalFareFor } from '../../models/common/index.js';

/**
 * THE SAMPLE DATA OF THIS APP, written straight through the Prisma client with literal values.
 *
 * It imports no repository: the seed must keep working whatever the repository lanes do. It also
 * NEVER deletes accounts — the platform's first admin already exists when the seed runs, so users are
 * upserted and only the seed's OWN buses, trips, seats and bookings are cleared and rewritten.
 */

/** Password / answer hashes are produced by the seed entry (bcrypt) and handed in. */
export interface SeedCredentials {
  readonly demoPasswordHash: string;
  readonly demoSecurityAnswerHash: string;
}

export interface SeedSummary {
  readonly cities: number;
  readonly buses: number;
  readonly trips: number;
  readonly seats: number;
  readonly bookings: number;
  readonly demoMobileNumber: string;
}

export type SeedBookingStatus = 'Booked' | 'Cancelled' | 'Completed';
export type SeedBookingOwner = 'demo' | 'other' | 'admin';

export interface SeedBoardingPointRow {
  readonly id: string;
  readonly name: string;
  readonly pickupAt: string;
}

export interface SeedBusRow {
  readonly id: string;
  readonly name: string;
  /** AC/Non-AC × Seater/Sleeper, exactly as it is shown to travellers. */
  readonly busType: string;
  readonly seatRows: number;
  readonly seatColumns: number;
  readonly boardingPoints: readonly SeedBoardingPointRow[];
}

export interface SeedTripRow {
  readonly id: string;
  readonly busId: string;
  readonly fromCity: string;
  readonly toCity: string;
  readonly departureAt: Date;
  readonly arrivalAt: Date;
  readonly farePerSeat: number;
}

export interface SeedPassengerRow {
  readonly seatNumber: string;
  readonly name: string;
  readonly age: number;
  readonly gender: string;
}

export interface SeedBookingRow {
  readonly id: string;
  readonly tripId: string;
  readonly boardingPointId: string;
  readonly owner: SeedBookingOwner;
  readonly status: SeedBookingStatus;
  /** False for a cancelled booking: its seats are released, the seat numbers stay on its passengers. */
  readonly holdsSeats: boolean;
  readonly createdHoursAgo: number;
  readonly cancelledHoursAgo?: number;
  readonly passengers: readonly SeedPassengerRow[];
}

export interface SeedTravellerRow {
  readonly fullName: string;
  readonly mobileNumber: string;
  readonly securityQuestionId: string;
  readonly password: string;
  readonly securityAnswer: string;
}

/** The demo traveller every screenshot and manual walk-through signs in as. */
export const DEMO_TRAVELLER: SeedTravellerRow = {
  fullName: 'Aisha Kapoor',
  mobileNumber: '9876543210',
  securityQuestionId: 'mothers-first-name',
  password: 'Travel@123',
  securityAnswer: 'Meera',
};

/** A second sample traveller, who holds the seats of the sold-out trip. */
export const OTHER_TRAVELLER: SeedTravellerRow = {
  fullName: 'Nikhil Rao',
  mobileNumber: '9811122233',
  securityQuestionId: 'favourite-food',
  password: 'Travel@123',
  securityAnswer: 'Poha',
};

/** Security answers are compared case-insensitively, so the seed hashes the normalised form. */
export function normaliseSecurityAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

export const SEED_CITY_NAMES: readonly string[] = ['Mumbai', 'Pune', 'Nashik', 'Goa', 'Nagpur', 'Aurangabad'];

export const SEED_BUSES: readonly SeedBusRow[] = [
  {
    id: 'bus-shree-travels',
    name: 'Shree Travels',
    busType: 'AC Sleeper',
    seatRows: 9,
    seatColumns: 4,
    boardingPoints: [
      { id: 'bp-shree-dadar', name: 'Dadar, near TT Circle', pickupAt: '9:00 PM' },
      { id: 'bp-shree-sion', name: 'Sion Circle', pickupAt: '9:20 PM' },
    ],
  },
  {
    id: 'bus-neeta-travels',
    name: 'Neeta Travels',
    busType: 'AC Seater',
    seatRows: 10,
    seatColumns: 4,
    boardingPoints: [
      { id: 'bp-neeta-nashik-road', name: 'Nashik Road', pickupAt: '6:00 AM' },
      { id: 'bp-neeta-cidco', name: 'CIDCO Chowk', pickupAt: '6:10 AM' },
    ],
  },
  {
    id: 'bus-vrl-travels',
    name: 'VRL Travels',
    busType: 'Non-AC Sleeper',
    seatRows: 8,
    seatColumns: 4,
    boardingPoints: [
      { id: 'bp-vrl-borivali', name: 'Borivali East', pickupAt: '9:30 PM' },
      { id: 'bp-vrl-panvel', name: 'Panvel Bypass', pickupAt: '10:30 PM' },
    ],
  },
  {
    id: 'bus-purple-line',
    name: 'Purple Line',
    busType: 'Non-AC Seater',
    seatRows: 3,
    seatColumns: 4,
    boardingPoints: [
      { id: 'bp-purple-swargate', name: 'Swargate', pickupAt: '7:00 AM' },
      { id: 'bp-purple-wakad', name: 'Wakad Bridge', pickupAt: '7:30 AM' },
    ],
  },
  {
    id: 'bus-orange-travels',
    name: 'Orange Travels',
    busType: 'AC Sleeper',
    seatRows: 9,
    seatColumns: 4,
    boardingPoints: [
      { id: 'bp-orange-andheri', name: 'Andheri East', pickupAt: '10:45 PM' },
      { id: 'bp-orange-thane', name: 'Thane, Nitin Junction', pickupAt: '11:15 PM' },
    ],
  },
];

export const TRIP_IDS = {
  upcoming: 'trip-pune-mumbai-upcoming',
  departingSoon: 'trip-nashik-pune-soon',
  departed: 'trip-mumbai-goa-departed',
  soldOut: 'trip-pune-nagpur-soldout',
  later: 'trip-mumbai-nashik-later',
} as const;

function addHours(from: Date, hours: number): Date {
  return new Date(from.getTime() + Math.round(hours * 3600000));
}

function addMinutes(from: Date, minutes: number): Date {
  return new Date(from.getTime() + minutes * 60000);
}

/** The travel date of a departure: midnight UTC of that calendar day. */
function travelDateOf(departureAt: Date): Date {
  return new Date(Date.UTC(departureAt.getUTCFullYear(), departureAt.getUTCMonth(), departureAt.getUTCDate()));
}

/**
 * The five sample trips, positioned around `now`: an upcoming one, one departing inside the hour
 * (so it cannot be cancelled), one that has already departed (Completed bookings), a sold-out one,
 * and one further out.
 */
export function buildTripSchedule(now: Date): readonly SeedTripRow[] {
  return [
    {
      id: TRIP_IDS.upcoming,
      busId: 'bus-shree-travels',
      fromCity: 'Pune',
      toCity: 'Mumbai',
      departureAt: addHours(now, 26),
      arrivalAt: addHours(now, 33.5),
      farePerSeat: 600,
    },
    {
      id: TRIP_IDS.departingSoon,
      busId: 'bus-neeta-travels',
      fromCity: 'Nashik',
      toCity: 'Pune',
      departureAt: addMinutes(now, 40),
      arrivalAt: addHours(now, 4.5),
      farePerSeat: 450,
    },
    {
      id: TRIP_IDS.departed,
      busId: 'bus-vrl-travels',
      fromCity: 'Mumbai',
      toCity: 'Goa',
      departureAt: addHours(now, -50),
      arrivalAt: addHours(now, -39),
      farePerSeat: 800,
    },
    {
      id: TRIP_IDS.soldOut,
      busId: 'bus-purple-line',
      fromCity: 'Pune',
      toCity: 'Nagpur',
      departureAt: addHours(now, 52),
      arrivalAt: addHours(now, 63),
      farePerSeat: 550,
    },
    {
      id: TRIP_IDS.later,
      busId: 'bus-orange-travels',
      fromCity: 'Mumbai',
      toCity: 'Nashik',
      departureAt: addHours(now, 44),
      arrivalAt: addHours(now, 49),
      farePerSeat: 500,
    },
  ];
}

export const SEED_BOOKINGS: readonly SeedBookingRow[] = [
  {
    id: 'BB-10452',
    tripId: TRIP_IDS.upcoming,
    boardingPointId: 'bp-shree-dadar',
    owner: 'demo',
    status: 'Booked',
    holdsSeats: true,
    createdHoursAgo: 48,
    passengers: [
      { seatNumber: 'A1', name: 'Ramesh Kulkarni', age: 34, gender: 'Male' },
      { seatNumber: 'A2', name: 'Sita Kulkarni', age: 31, gender: 'Female' },
    ],
  },
  {
    id: 'BB-10455',
    tripId: TRIP_IDS.departingSoon,
    boardingPointId: 'bp-neeta-nashik-road',
    owner: 'demo',
    status: 'Booked',
    holdsSeats: true,
    createdHoursAgo: 20,
    passengers: [{ seatNumber: 'B3', name: 'Asha Patil', age: 28, gender: 'Female' }],
  },
  {
    id: 'BB-10448',
    tripId: TRIP_IDS.departed,
    boardingPointId: 'bp-vrl-borivali',
    owner: 'demo',
    status: 'Completed',
    holdsSeats: true,
    createdHoursAgo: 96,
    passengers: [
      { seatNumber: 'C1', name: 'Vikram Rao', age: 41, gender: 'Male' },
      { seatNumber: 'C2', name: 'Neha Rao', age: 38, gender: 'Female' },
    ],
  },
  {
    id: 'BB-10432',
    tripId: TRIP_IDS.later,
    boardingPointId: 'bp-orange-andheri',
    owner: 'demo',
    status: 'Cancelled',
    holdsSeats: false,
    createdHoursAgo: 60,
    cancelledHoursAgo: 12,
    passengers: [
      { seatNumber: 'D1', name: 'Omkar Joshi', age: 30, gender: 'Male' },
      { seatNumber: 'D2', name: 'Priya Joshi', age: 29, gender: 'Female' },
    ],
  },
  {
    id: 'BB-10470',
    tripId: TRIP_IDS.soldOut,
    boardingPointId: 'bp-purple-swargate',
    owner: 'other',
    status: 'Booked',
    holdsSeats: true,
    createdHoursAgo: 30,
    passengers: [
      { seatNumber: 'A1', name: 'Kiran Desai', age: 44, gender: 'Male' },
      { seatNumber: 'A2', name: 'Meena Desai', age: 42, gender: 'Female' },
      { seatNumber: 'A3', name: 'Sanjay Pawar', age: 36, gender: 'Male' },
      { seatNumber: 'A4', name: 'Lata Pawar', age: 33, gender: 'Female' },
      { seatNumber: 'B1', name: 'Imran Shaikh', age: 27, gender: 'Male' },
      { seatNumber: 'B2', name: 'Farida Shaikh', age: 25, gender: 'Female' },
    ],
  },
  {
    id: 'BB-10471',
    tripId: TRIP_IDS.soldOut,
    boardingPointId: 'bp-purple-wakad',
    owner: 'other',
    status: 'Booked',
    holdsSeats: true,
    createdHoursAgo: 26,
    passengers: [
      { seatNumber: 'B3', name: 'Rahul Kadam', age: 31, gender: 'Male' },
      { seatNumber: 'B4', name: 'Swapnil More', age: 29, gender: 'Male' },
      { seatNumber: 'C1', name: 'Anita Bhosale', age: 48, gender: 'Female' },
      { seatNumber: 'C2', name: 'Deepak Bhosale', age: 51, gender: 'Male' },
      { seatNumber: 'C3', name: 'Shruti Jain', age: 23, gender: 'Female' },
      { seatNumber: 'C4', name: 'Harsh Jain', age: 26, gender: 'Male' },
    ],
  },
  {
    id: 'BB-10500',
    tripId: TRIP_IDS.upcoming,
    boardingPointId: 'bp-shree-sion',
    owner: 'admin',
    status: 'Booked',
    holdsSeats: true,
    createdHoursAgo: 6,
    passengers: [
      { seatNumber: 'E1', name: 'Alex QA', age: 36, gender: 'Male' },
      { seatNumber: 'E2', name: 'Riya QA', age: 32, gender: 'Female' },
    ],
  },
];

/** Every booking id the seed owns — the only bookings it is allowed to clear by id. */
export const SEED_BOOKING_IDS: readonly string[] = SEED_BOOKINGS.map((booking) => booking.id);

function busById(busId: string): SeedBusRow {
  const bus = SEED_BUSES.find((candidate) => candidate.id === busId);
  if (bus === undefined) throw new Error(`Seed data references unknown bus ${busId}`);
  return bus;
}

function tripById(trips: readonly SeedTripRow[], tripId: string): SeedTripRow {
  const trip = trips.find((candidate) => candidate.id === tripId);
  if (trip === undefined) throw new Error(`Seed data references unknown trip ${tripId}`);
  return trip;
}

function cityId(cityIdByName: Map<string, string>, name: string): string {
  const id = cityIdByName.get(name);
  if (id === undefined) throw new Error(`Seed data references unknown city ${name}`);
  return id;
}

/**
 * Write the sample data. Idempotent: run it as often as you like.
 *
 * `now` is a parameter rather than a hidden read of the clock so the schedule can be reproduced in
 * tests; production passes nothing and gets the real current time.
 */
export async function seedDatabase(
  client: PrismaClient,
  credentials: SeedCredentials,
  now: Date = new Date(),
): Promise<SeedSummary> {
  const trips = buildTripSchedule(now);
  const tripIds = trips.map((trip) => trip.id);
  const busIds = SEED_BUSES.map((bus) => bus.id);

  // Cities are shared with anything an operator may have added, so match on the name and keep the
  // id the database already has.
  const cityIdByName = new Map<string, string>();
  for (const name of SEED_CITY_NAMES) {
    const city = await client.city.upsert({ where: { name }, update: {}, create: { name } });
    cityIdByName.set(name, city.id);
  }

  // Clear ONLY the seed's own sample rows (and anything booked onto its sample trips). No account is
  // ever touched here.
  await client.booking.deleteMany({
    where: { OR: [{ id: { in: [...SEED_BOOKING_IDS] } }, { tripId: { in: tripIds } }] },
  });
  await client.seat.deleteMany({ where: { tripId: { in: tripIds } } });
  await client.trip.deleteMany({ where: { id: { in: tripIds } } });
  await client.boardingPoint.deleteMany({ where: { busId: { in: busIds } } });
  await client.bus.deleteMany({ where: { id: { in: busIds } } });

  for (const bus of SEED_BUSES) {
    await client.bus.create({
      data: {
        id: bus.id,
        name: bus.name,
        busType: bus.busType,
        seatRows: bus.seatRows,
        seatColumns: bus.seatColumns,
        totalSeats: bus.seatRows * bus.seatColumns,
        boardingPoints: {
          create: bus.boardingPoints.map((point) => ({ id: point.id, name: point.name, pickupAt: point.pickupAt })),
        },
      },
    });
  }

  let seatTotal = 0;
  for (const trip of trips) {
    const bus = busById(trip.busId);
    await client.trip.create({
      data: {
        id: trip.id,
        busId: bus.id,
        fromCityId: cityId(cityIdByName, trip.fromCity),
        toCityId: cityId(cityIdByName, trip.toCity),
        travelDate: travelDateOf(trip.departureAt),
        departureAt: trip.departureAt,
        arrivalAt: trip.arrivalAt,
        farePerSeat: trip.farePerSeat,
        seatRows: bus.seatRows,
        seatColumns: bus.seatColumns,
        totalSeats: bus.seatRows * bus.seatColumns,
      },
    });

    const grid = buildSeatGrid(bus.seatRows, bus.seatColumns);
    await client.seat.createMany({
      data: grid.map((seat) => ({
        id: `${trip.id}-${seat.seatNumber}`,
        tripId: trip.id,
        seatNumber: seat.seatNumber,
        rowIndex: seat.rowIndex,
        columnIndex: seat.columnIndex,
      })),
    });
    seatTotal += grid.length;
  }

  const demo = await client.user.upsert({
    where: { mobileNumber: DEMO_TRAVELLER.mobileNumber },
    update: {
      fullName: DEMO_TRAVELLER.fullName,
      passwordHash: credentials.demoPasswordHash,
      securityQuestionId: DEMO_TRAVELLER.securityQuestionId,
      securityAnswerHash: credentials.demoSecurityAnswerHash,
      failedLoginCount: 0,
      lockedUntil: null,
      failedResetCount: 0,
      resetBlockedUntil: null,
    },
    create: {
      fullName: DEMO_TRAVELLER.fullName,
      mobileNumber: DEMO_TRAVELLER.mobileNumber,
      passwordHash: credentials.demoPasswordHash,
      securityQuestionId: DEMO_TRAVELLER.securityQuestionId,
      securityAnswerHash: credentials.demoSecurityAnswerHash,
    },
  });

  const other = await client.user.upsert({
    where: { mobileNumber: OTHER_TRAVELLER.mobileNumber },
    update: {
      fullName: OTHER_TRAVELLER.fullName,
      passwordHash: credentials.demoPasswordHash,
      securityQuestionId: OTHER_TRAVELLER.securityQuestionId,
      securityAnswerHash: credentials.demoSecurityAnswerHash,
    },
    create: {
      fullName: OTHER_TRAVELLER.fullName,
      mobileNumber: OTHER_TRAVELLER.mobileNumber,
      passwordHash: credentials.demoPasswordHash,
      securityQuestionId: OTHER_TRAVELLER.securityQuestionId,
      securityAnswerHash: credentials.demoSecurityAnswerHash,
    },
  });

  // The platform's first account already exists when the seed runs: give it a real upcoming booking
  // so /bookings and /profile open live data for whoever signs in with it.
  const existing = await client.user.findFirst({
    where: { mobileNumber: { notIn: [demo.mobileNumber, other.mobileNumber] } },
    orderBy: { createdAt: 'asc' },
  });

  const userIdByOwner: Record<SeedBookingOwner, string | null> = {
    demo: demo.id,
    other: other.id,
    admin: existing === null ? null : existing.id,
  };

  let bookingTotal = 0;
  for (const booking of SEED_BOOKINGS) {
    const userId = userIdByOwner[booking.owner];
    if (userId === null) continue;

    const trip = tripById(trips, booking.tripId);
    const seatNumbers = booking.passengers.map((passenger) => passenger.seatNumber);

    await client.booking.create({
      data: {
        id: booking.id,
        userId,
        tripId: trip.id,
        boardingPointId: booking.boardingPointId,
        status: booking.status,
        seatCount: booking.passengers.length,
        farePerSeat: trip.farePerSeat,
        totalFare: totalFareFor(booking.passengers.length, trip.farePerSeat),
        createdAt: addHours(now, -booking.createdHoursAgo),
        cancelledAt: booking.cancelledHoursAgo === undefined ? null : addHours(now, -booking.cancelledHoursAgo),
        passengers: {
          create: booking.passengers.map((passenger) => ({
            seatNumber: passenger.seatNumber,
            name: passenger.name,
            age: passenger.age,
            gender: passenger.gender,
          })),
        },
      },
    });

    if (booking.holdsSeats) {
      await client.seat.updateMany({
        where: { tripId: trip.id, seatNumber: { in: seatNumbers } },
        data: { bookingId: booking.id },
      });
    }
    bookingTotal += 1;
  }

  return {
    cities: SEED_CITY_NAMES.length,
    buses: SEED_BUSES.length,
    trips: trips.length,
    seats: seatTotal,
    bookings: bookingTotal,
    demoMobileNumber: demo.mobileNumber,
  };
}
