import { describe, expect, it } from 'vitest';
import {
  compareSessionsNewestFirst,
  isoToDateOrNull,
  rowTimestampToIso,
  rowTimestampToIsoOrNull,
  toActiveSession,
  toUserRecord,
  toUserRowPatch,
  type SessionRow,
  type UserRow,
} from './rows.js';

const USER_ROW: UserRow = {
  id: 'user-aisha',
  fullName: 'Aisha Kapoor',
  mobileNumber: '9876543210',
  passwordHash: 'hash-of-password',
  securityQuestionId: 'MOTHER_NAME',
  securityAnswerHash: 'hash-of-answer',
  failedLoginCount: 3,
  lockedUntil: new Date('2024-06-01T05:15:00.000Z'),
  failedResetCount: 1,
  resetBlockedUntil: null,
  createdAt: new Date('2024-05-01T06:30:00.000Z'),
};

describe('toUserRecord', () => {
  it('maps a row onto the account record, with ISO instants', () => {
    expect(toUserRecord(USER_ROW)).toEqual({
      id: 'user-aisha',
      fullName: 'Aisha Kapoor',
      mobile: '9876543210',
      securityQuestionId: 'MOTHER_NAME',
      passwordHash: 'hash-of-password',
      securityAnswerHash: 'hash-of-answer',
      failedLoginCount: 3,
      lockedUntil: '2024-06-01T05:15:00.000Z',
      failedResetCount: 1,
      resetBlockedUntil: null,
      createdAt: '2024-05-01T06:30:00.000Z',
    });
  });

  it('reads a stored question slug as a catalogue id', () => {
    const record = toUserRecord({ ...USER_ROW, securityQuestionId: 'favourite-food' });
    expect(record.securityQuestionId).toBe('FAVOURITE_FOOD');
  });

  it('accepts timestamps that arrive as strings', () => {
    const record = toUserRecord({
      ...USER_ROW,
      lockedUntil: '2024-06-01T05:15:00.000Z',
      createdAt: '2024-05-01T06:30:00.000Z',
    });
    expect(record.lockedUntil).toBe('2024-06-01T05:15:00.000Z');
    expect(record.createdAt).toBe('2024-05-01T06:30:00.000Z');
  });
});

describe('timestamp translation', () => {
  it('turns an instant into an ISO string and back', () => {
    expect(rowTimestampToIso(new Date('2024-06-01T05:15:00.000Z'))).toBe('2024-06-01T05:15:00.000Z');
    expect(rowTimestampToIsoOrNull(null)).toBeNull();
    expect(isoToDateOrNull(null)).toBeNull();
    expect(isoToDateOrNull('2024-06-01T05:15:00.000Z')?.toISOString()).toBe('2024-06-01T05:15:00.000Z');
  });
});

describe('toUserRowPatch', () => {
  it('carries over only the keys the patch actually sets', () => {
    expect(toUserRowPatch({ failedLoginCount: 4 })).toEqual({ failedLoginCount: 4 });
  });

  it('turns an ISO lock instant into a date, and null into a cleared column', () => {
    const locked = toUserRowPatch({ lockedUntil: '2024-06-01T05:15:00.000Z', failedLoginCount: 5 });
    expect(locked.failedLoginCount).toBe(5);
    expect(locked.lockedUntil?.toISOString()).toBe('2024-06-01T05:15:00.000Z');

    const cleared = toUserRowPatch({ lockedUntil: null, resetBlockedUntil: null });
    expect(cleared.lockedUntil).toBeNull();
    expect(cleared.resetBlockedUntil).toBeNull();
  });

  it('trims a new display name', () => {
    expect(toUserRowPatch({ fullName: '  Aisha Kapoor  ' })).toEqual({ fullName: 'Aisha Kapoor' });
  });
});

const SESSION_ROWS: readonly SessionRow[] = [
  {
    id: 'session-old',
    token: 'token-old',
    userId: 'user-aisha',
    userAgent: 'Safari on iPhone',
    createdAt: new Date('2024-05-10T13:32:00.000Z'),
  },
  {
    id: 'session-new',
    token: 'token-new',
    userId: 'user-aisha',
    userAgent: 'Chrome on Windows',
    createdAt: new Date('2024-05-12T03:44:00.000Z'),
  },
];

describe('toActiveSession', () => {
  it('describes a device without ever exposing its token', () => {
    const summary = toActiveSession(SESSION_ROWS[1], 'token-new');
    expect(summary).toEqual({
      id: 'session-new',
      userAgent: 'Chrome on Windows',
      createdAt: '2024-05-12T03:44:00.000Z',
      current: true,
    });
  });

  it('flags only the requesting session as current', () => {
    expect(toActiveSession(SESSION_ROWS[0], 'token-new').current).toBe(false);
    expect(toActiveSession(SESSION_ROWS[0], null).current).toBe(false);
  });
});

describe('compareSessionsNewestFirst', () => {
  it('orders newest first', () => {
    const ordered = [...SESSION_ROWS].sort(compareSessionsNewestFirst).map((row) => row.id);
    expect(ordered).toEqual(['session-new', 'session-old']);
  });

  it('breaks a tie on the id, so the order never wobbles', () => {
    const sameInstant = new Date('2024-05-12T03:44:00.000Z');
    const rows: SessionRow[] = [
      { id: 'session-a', token: 'token-a', userId: 'user-aisha', userAgent: null, createdAt: sameInstant },
      { id: 'session-b', token: 'token-b', userId: 'user-aisha', userAgent: null, createdAt: sameInstant },
    ];
    expect([...rows].sort(compareSessionsNewestFirst).map((row) => row.id)).toEqual([
      'session-b',
      'session-a',
    ]);
  });
});
