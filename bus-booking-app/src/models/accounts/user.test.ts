import { describe, expect, it } from 'vitest';
import { toAuthUser } from './user.js';
import type { UserRecord } from './user.js';

const STORED_ACCOUNT: UserRecord = {
  id: 'user-aisha',
  fullName: 'Aisha Kapoor',
  mobile: '9876543210',
  securityQuestionId: 'MOTHER_NAME',
  passwordHash: 'hash-of-password',
  securityAnswerHash: 'hash-of-answer',
  failedLoginCount: 2,
  lockedUntil: null,
  failedResetCount: 0,
  resetBlockedUntil: null,
  createdAt: '2024-05-01T06:30:00.000Z',
};

describe('toAuthUser', () => {
  it('keeps only what the client may see', () => {
    expect(toAuthUser(STORED_ACCOUNT)).toEqual({
      id: 'user-aisha',
      fullName: 'Aisha Kapoor',
      mobile: '9876543210',
      securityQuestionId: 'MOTHER_NAME',
    });
  });

  it('carries no hash and no counter', () => {
    const authUser: Record<string, unknown> = { ...toAuthUser(STORED_ACCOUNT) };
    expect(Object.keys(authUser).sort()).toEqual(['fullName', 'id', 'mobile', 'securityQuestionId']);
    expect(authUser.passwordHash).toBeUndefined();
    expect(authUser.failedLoginCount).toBeUndefined();
  });
});
