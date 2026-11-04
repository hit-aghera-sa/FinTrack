import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../messages/index.js';
import { NOT_SIGNED_IN_MESSAGE } from '../auth/index.js';
import { createAccountDeletionService, type AccountDeletionService } from './service.js';
import { CURRENT_PASSWORD_REQUIRED_MESSAGE } from './validation.js';
import type {
  AccountDeletionStore,
  AccountPurgeSummary,
  BookingTimingRecord,
  DeletionAccount,
  DeletionBookingReader,
  DeletionSessionReader,
  DeletionUserStore,
} from './types.js';

const CORRECT_PASSWORD = 'Winter-Trip-42';
const PASSWORD_HASH = 'hash-of-Winter-Trip-42';
const MOBILE = '9876500011';
const NOW = new Date('2024-06-12T06:00:00.000Z');

interface FakeAccount extends DeletionAccount {
  readonly mobile: string;
}

interface World {
  readonly service: AccountDeletionService;
  readonly purged: string[];
  findByMobile(mobile: string): FakeAccount | null;
}

function createWorld(bookings: readonly BookingTimingRecord[] = [], sessionCount = 1): World {
  const accounts = new Map<string, FakeAccount>();
  accounts.set('traveller-1', { id: 'traveller-1', passwordHash: PASSWORD_HASH, mobile: MOBILE });
  const purged: string[] = [];

  const users: DeletionUserStore = {
    async findById(id: string): Promise<DeletionAccount | null> {
      return accounts.get(id) ?? null;
    },
  };

  const bookingReader: DeletionBookingReader = {
    async listByUser(_userId: string, _now: Date): Promise<readonly BookingTimingRecord[]> {
      return bookings;
    },
  };

  const sessionReader: DeletionSessionReader = {
    async listActiveByUser(_userId: string): Promise<readonly unknown[]> {
      return Array.from({ length: sessionCount }, (_value: unknown, index: number) => ({
        id: `session-${index}`,
      }));
    },
  };

  const store: AccountDeletionStore = {
    async purgeAccount(userId: string): Promise<AccountPurgeSummary> {
      purged.push(userId);
      accounts.delete(userId);
      return {
        releasedSeats: 3,
        deletedPassengers: 3,
        deletedBookings: 2,
        revokedSessions: sessionCount,
        deletedUser: true,
      };
    },
  };

  const service = createAccountDeletionService({
    users,
    bookings: bookingReader,
    sessions: sessionReader,
    store,
    verifyPassword: async (password: string, hash: string): Promise<boolean> =>
      hash === PASSWORD_HASH && password === CORRECT_PASSWORD,
    now: (): Date => NOW,
  });

  return {
    service,
    purged,
    findByMobile(mobile: string): FakeAccount | null {
      for (const account of accounts.values()) {
        if (account.mobile === mobile) return account;
      }
      return null;
    },
  };
}

describe('the current password gates the deletion', () => {
  it('refuses a wrong password with the profile lane wording and destroys nothing', async () => {
    const world = createWorld();

    const result = await world.service.deleteAccount({
      userId: 'traveller-1',
      body: { currentPassword: 'not-my-password' },
    });

    expect(result).toEqual({
      ok: false,
      code: 'wrong_password',
      message: MESSAGES.currentPasswordIncorrect,
    });
    expect(world.purged).toEqual([]);
    expect(world.findByMobile(MOBILE)).not.toBeNull();
  });

  it('refuses a request that carries no password at all', async () => {
    const world = createWorld();

    const result = await world.service.deleteAccount({ userId: 'traveller-1', body: {} });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_request',
      message: CURRENT_PASSWORD_REQUIRED_MESSAGE,
    });
    expect(world.purged).toEqual([]);
  });

  it('refuses a password of only spaces', async () => {
    const world = createWorld();

    const result = await world.service.deleteAccount({
      userId: 'traveller-1',
      body: { currentPassword: '   ' },
    });

    expect(result.ok).toBe(false);
    expect(world.purged).toEqual([]);
  });
});

describe('a confirmed deletion', () => {
  it('purges the account once and frees the mobile number for a fresh sign-up', async () => {
    const world = createWorld();

    const result = await world.service.deleteAccount({
      userId: 'traveller-1',
      body: { currentPassword: CORRECT_PASSWORD },
    });

    expect(result.ok).toBe(true);
    expect(world.purged).toEqual(['traveller-1']);
    expect(world.findByMobile(MOBILE)).toBeNull();
  });

  it('reports the seats released and the sessions revoked', async () => {
    const world = createWorld([], 3);

    const result = await world.service.deleteAccount({
      userId: 'traveller-1',
      body: { currentPassword: CORRECT_PASSWORD },
    });

    expect(result.ok ? result.purge : null).toEqual({
      releasedSeats: 3,
      deletedPassengers: 3,
      deletedBookings: 2,
      revokedSessions: 3,
      deletedUser: true,
    });
  });

  it('treats a second attempt on the same account as signed out', async () => {
    const world = createWorld();
    await world.service.deleteAccount({ userId: 'traveller-1', body: { currentPassword: CORRECT_PASSWORD } });

    const again = await world.service.deleteAccount({
      userId: 'traveller-1',
      body: { currentPassword: CORRECT_PASSWORD },
    });

    expect(again).toEqual({ ok: false, code: 'not_found', message: NOT_SIGNED_IN_MESSAGE });
    expect(world.purged).toEqual(['traveller-1']);
  });
});

describe('the preview', () => {
  it('states the counts the traveller is about to destroy', async () => {
    const world = createWorld(
      [
        { status: 'BOOKED', departureAt: '2024-06-14T10:00:00.000Z' },
        { status: 'BOOKED', departureAt: '2024-06-20T10:00:00.000Z' },
        { status: 'COMPLETED', departureAt: '2024-05-01T10:00:00.000Z' },
        { status: 'CANCELLED', departureAt: '2024-07-01T10:00:00.000Z' },
      ],
      2,
    );

    expect(await world.service.preview('traveller-1')).toEqual({
      upcomingBookings: 2,
      pastBookings: 2,
      activeSessions: 2,
    });
  });

  it('has nothing to preview for an account that is already gone', async () => {
    const world = createWorld();

    expect(await world.service.preview('ghost-1')).toBeNull();
  });
});
