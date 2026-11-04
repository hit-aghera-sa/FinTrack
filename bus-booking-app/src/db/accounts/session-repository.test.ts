import { describe, expect, it } from 'vitest';
import { createSessionRepository, type NewSessionRow, type SessionStore } from './session-repository.js';
import type { UserStore } from './user-repository.js';
import type { NewUserRow, SessionRow, UserRow, UserRowPatch } from './rows.js';

const AISHA: UserRow = {
  id: 'user-aisha',
  fullName: 'Aisha Kapoor',
  mobileNumber: '9876543210',
  passwordHash: 'hash-of-password',
  securityQuestionId: 'MOTHER_NAME',
  securityAnswerHash: 'hash-of-answer',
  failedLoginCount: 0,
  lockedUntil: null,
  failedResetCount: 0,
  resetBlockedUntil: null,
  createdAt: new Date('2024-05-01T06:30:00.000Z'),
};

/** A read-only in-memory User table: enough of the store for session lookups. */
function createFixedUserStore(users: readonly UserRow[]): UserStore {
  return {
    findByMobileNumber(mobileNumber: string): Promise<UserRow | null> {
      return Promise.resolve(users.find((user) => user.mobileNumber === mobileNumber) ?? null);
    },
    findById(id: string): Promise<UserRow | null> {
      return Promise.resolve(users.find((user) => user.id === id) ?? null);
    },
    insert(_row: NewUserRow): Promise<UserRow> {
      return Promise.reject(new Error('the session tests never create an account'));
    },
    patch(_id: string, _patch: UserRowPatch): Promise<UserRow> {
      return Promise.reject(new Error('the session tests never patch an account'));
    },
  };
}

/** An in-memory Session table that hands rows back in insertion order, oldest first. */
function createMemorySessionStore(): SessionStore {
  const rows: SessionRow[] = [];
  let created = 0;
  const startedAt = new Date('2024-05-10T09:00:00.000Z').getTime();

  return {
    insert(row: NewSessionRow): Promise<void> {
      created += 1;
      rows.push({
        id: `session-${created}`,
        token: row.token,
        userId: row.userId,
        userAgent: row.userAgent,
        createdAt: new Date(startedAt + created * 60_000),
      });
      return Promise.resolve();
    },
    findByToken(token: string): Promise<SessionRow | null> {
      return Promise.resolve(rows.find((row) => row.token === token) ?? null);
    },
    deleteByToken(token: string): Promise<void> {
      const index = rows.findIndex((row) => row.token === token);
      if (index >= 0) rows.splice(index, 1);
      return Promise.resolve();
    },
    listByUser(userId: string): Promise<SessionRow[]> {
      return Promise.resolve(rows.filter((row) => row.userId === userId));
    },
    deleteAllForUser(userId: string): Promise<void> {
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];
        if (row !== undefined && row.userId === userId) rows.splice(index, 1);
      }
      return Promise.resolve();
    },
  };
}

function createRepository(): ReturnType<typeof createSessionRepository> {
  return createSessionRepository({
    sessions: createMemorySessionStore(),
    users: createFixedUserStore([AISHA]),
  });
}

describe('the session repository', () => {
  it('starts a session and resolves its owner from the token', async () => {
    const repository = createRepository();
    await repository.create({ userId: 'user-aisha', token: 'token-chrome', userAgent: 'Chrome on Windows' });

    const owner = await repository.findUserByToken('token-chrome');
    expect(owner?.id).toBe('user-aisha');
    expect(owner?.mobile).toBe('9876543210');
    expect(owner?.fullName).toBe('Aisha Kapoor');
  });

  it('answers null for a token it does not know', async () => {
    const repository = createRepository();
    expect(await repository.findUserByToken('token-nobody')).toBeNull();
  });

  it('answers null when the session outlives its account', async () => {
    const repository = createSessionRepository({
      sessions: createMemorySessionStore(),
      users: createFixedUserStore([]),
    });
    await repository.create({ userId: 'user-aisha', token: 'token-orphan', userAgent: null });
    expect(await repository.findUserByToken('token-orphan')).toBeNull();
  });

  it('accepts a session with no device description', async () => {
    const repository = createRepository();
    await repository.create({ userId: 'user-aisha', token: 'token-plain', userAgent: null });

    const devices = await repository.listActiveByUser('user-aisha');
    expect(devices).toHaveLength(1);
    expect(devices[0]?.userAgent).toBeNull();
    expect(devices[0]?.current).toBe(false);
  });

  it('lists the signed-in devices newest first and flags the current one', async () => {
    const repository = createRepository();
    await repository.create({ userId: 'user-aisha', token: 'token-safari', userAgent: 'Safari on iPhone' });
    await repository.create({ userId: 'user-aisha', token: 'token-chrome', userAgent: 'Chrome on Windows' });
    await repository.create({ userId: 'user-nikhil', token: 'token-edge', userAgent: 'Edge on Windows' });

    const devices = await repository.listActiveByUser('user-aisha', 'token-safari');
    expect(devices.map((device) => device.userAgent)).toEqual([
      'Chrome on Windows',
      'Safari on iPhone',
    ]);
    expect(devices.map((device) => device.current)).toEqual([false, true]);
    expect(devices.every((device) => device.createdAt.endsWith('Z'))).toBe(true);
  });

  it('never exposes a token on the devices list', async () => {
    const repository = createRepository();
    await repository.create({ userId: 'user-aisha', token: 'token-chrome', userAgent: 'Chrome on Windows' });

    const [device] = await repository.listActiveByUser('user-aisha', 'token-chrome');
    const fields: Record<string, unknown> = { ...device };
    expect(Object.keys(fields).sort()).toEqual(['createdAt', 'current', 'id', 'userAgent']);
  });

  it('revokes one device and leaves the others signed in', async () => {
    const repository = createRepository();
    await repository.create({ userId: 'user-aisha', token: 'token-safari', userAgent: 'Safari on iPhone' });
    await repository.create({ userId: 'user-aisha', token: 'token-chrome', userAgent: 'Chrome on Windows' });

    await repository.deleteByToken('token-safari');

    expect(await repository.findUserByToken('token-safari')).toBeNull();
    expect((await repository.findUserByToken('token-chrome'))?.id).toBe('user-aisha');
    expect(await repository.listActiveByUser('user-aisha')).toHaveLength(1);
  });

  it('treats revoking an unknown token as done', async () => {
    const repository = createRepository();
    await expect(repository.deleteByToken('token-nobody')).resolves.toBeUndefined();
  });

  it('signs out everywhere for one traveller only', async () => {
    const repository = createRepository();
    await repository.create({ userId: 'user-aisha', token: 'token-safari', userAgent: 'Safari on iPhone' });
    await repository.create({ userId: 'user-aisha', token: 'token-chrome', userAgent: 'Chrome on Windows' });
    await repository.create({ userId: 'user-nikhil', token: 'token-edge', userAgent: 'Edge on Windows' });

    await repository.deleteAllForUser('user-aisha');

    expect(await repository.listActiveByUser('user-aisha')).toEqual([]);
    expect(await repository.findUserByToken('token-safari')).toBeNull();
    expect(await repository.findUserByToken('token-chrome')).toBeNull();
    expect(await repository.listActiveByUser('user-nikhil')).toHaveLength(1);
  });
});
