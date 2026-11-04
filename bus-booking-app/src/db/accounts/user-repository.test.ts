import { describe, expect, it } from 'vitest';
import { createUserRepository, normaliseMobile, type UserStore } from './user-repository.js';
import type { NewUserRow, UserRow, UserRowPatch } from './rows.js';

/** An in-memory User table: the full store interface, so the repository runs with no database. */
function createMemoryUserStore(): UserStore {
  const rows = new Map<string, UserRow>();
  let created = 0;

  return {
    findByMobileNumber(mobileNumber: string): Promise<UserRow | null> {
      for (const row of rows.values()) {
        if (row.mobileNumber === mobileNumber) return Promise.resolve(row);
      }
      return Promise.resolve(null);
    },

    findById(id: string): Promise<UserRow | null> {
      return Promise.resolve(rows.get(id) ?? null);
    },

    insert(row: NewUserRow): Promise<UserRow> {
      created += 1;
      const inserted: UserRow = {
        id: `user-${created}`,
        fullName: row.fullName,
        mobileNumber: row.mobileNumber,
        passwordHash: row.passwordHash,
        securityQuestionId: row.securityQuestionId,
        securityAnswerHash: row.securityAnswerHash,
        failedLoginCount: 0,
        lockedUntil: null,
        failedResetCount: 0,
        resetBlockedUntil: null,
        createdAt: new Date('2024-05-01T06:30:00.000Z'),
      };
      rows.set(inserted.id, inserted);
      return Promise.resolve(inserted);
    },

    patch(id: string, patch: UserRowPatch): Promise<UserRow> {
      const existing = rows.get(id);
      if (existing === undefined) return Promise.reject(new Error(`no such user: ${id}`));
      const updated: UserRow = { ...existing, ...patch };
      rows.set(id, updated);
      return Promise.resolve(updated);
    },
  };
}

const SIGNUP = {
  fullName: 'Aisha Kapoor',
  mobile: '9876543210',
  passwordHash: 'hash-of-password',
  securityQuestionId: 'MOTHER_NAME',
  securityAnswerHash: 'hash-of-answer',
} as const;

describe('normaliseMobile', () => {
  it('stores the number without surrounding whitespace', () => {
    expect(normaliseMobile('  9876543210 ')).toBe('9876543210');
  });
});

describe('the account repository', () => {
  it('creates an account and finds it again by mobile number', async () => {
    const repository = createUserRepository(createMemoryUserStore());

    const account = await repository.create(SIGNUP);
    expect(account.fullName).toBe('Aisha Kapoor');
    expect(account.mobile).toBe('9876543210');
    expect(account.securityQuestionId).toBe('MOTHER_NAME');
    expect(account.passwordHash).toBe('hash-of-password');
    expect(account.failedLoginCount).toBe(0);
    expect(account.failedResetCount).toBe(0);
    expect(account.lockedUntil).toBeNull();
    expect(account.resetBlockedUntil).toBeNull();
    expect(account.createdAt).toBe('2024-05-01T06:30:00.000Z');

    const found = await repository.findByMobile('9876543210');
    expect(found).toEqual(account);
  });

  it('trims the name and the mobile number on the way in', async () => {
    const repository = createUserRepository(createMemoryUserStore());
    await repository.create({ ...SIGNUP, fullName: ' Nikhil Rao ', mobile: ' 9811122233 ' });

    const found = await repository.findByMobile('9811122233');
    expect(found?.fullName).toBe('Nikhil Rao');
    expect(found?.mobile).toBe('9811122233');
  });

  it('answers null for a mobile number and an id it does not know', async () => {
    const repository = createUserRepository(createMemoryUserStore());
    expect(await repository.findByMobile('9000000000')).toBeNull();
    expect(await repository.findById('user-nobody')).toBeNull();
  });

  it('finds an account by id', async () => {
    const repository = createUserRepository(createMemoryUserStore());
    const account = await repository.create(SIGNUP);
    expect(await repository.findById(account.id)).toEqual(account);
  });

  it('raises the log-in failure counter and locks the account', async () => {
    const repository = createUserRepository(createMemoryUserStore());
    const account = await repository.create(SIGNUP);

    const failed = await repository.update(account.id, { failedLoginCount: 4 });
    expect(failed.failedLoginCount).toBe(4);
    expect(failed.lockedUntil).toBeNull();

    const locked = await repository.update(account.id, {
      failedLoginCount: 5,
      lockedUntil: '2024-06-01T05:15:00.000Z',
    });
    expect(locked.failedLoginCount).toBe(5);
    expect(locked.lockedUntil).toBe('2024-06-01T05:15:00.000Z');

    const reopened = await repository.update(account.id, { failedLoginCount: 0, lockedUntil: null });
    expect(reopened.failedLoginCount).toBe(0);
    expect(reopened.lockedUntil).toBeNull();
  });

  it('tracks the reset counters separately from the log-in counters', async () => {
    const repository = createUserRepository(createMemoryUserStore());
    const account = await repository.create(SIGNUP);

    await repository.update(account.id, { failedLoginCount: 2 });
    const blocked = await repository.update(account.id, {
      failedResetCount: 5,
      resetBlockedUntil: '2024-06-01T07:00:00.000Z',
    });

    expect(blocked.failedLoginCount).toBe(2);
    expect(blocked.failedResetCount).toBe(5);
    expect(blocked.resetBlockedUntil).toBe('2024-06-01T07:00:00.000Z');
    expect(blocked.lockedUntil).toBeNull();
  });

  it('changes the name, the password hash and the security question without touching the rest', async () => {
    const repository = createUserRepository(createMemoryUserStore());
    const account = await repository.create(SIGNUP);

    const changed = await repository.update(account.id, {
      fullName: 'Aisha K Kapoor',
      passwordHash: 'hash-of-new-password',
      securityQuestionId: 'BIRTH_CITY',
      securityAnswerHash: 'hash-of-new-answer',
    });

    expect(changed.fullName).toBe('Aisha K Kapoor');
    expect(changed.passwordHash).toBe('hash-of-new-password');
    expect(changed.securityQuestionId).toBe('BIRTH_CITY');
    expect(changed.securityAnswerHash).toBe('hash-of-new-answer');
    expect(changed.mobile).toBe('9876543210');
    expect(changed.createdAt).toBe(account.createdAt);
  });

  it('leaves an empty patch as it found the account', async () => {
    const repository = createUserRepository(createMemoryUserStore());
    const account = await repository.create(SIGNUP);
    expect(await repository.update(account.id, {})).toEqual(account);
  });
});
