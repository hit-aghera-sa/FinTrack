import { describe, expect, it } from 'vitest';

import { MESSAGES } from '../../messages/index.js';
import { SECURITY_QUESTIONS, type UserRecord, type UserRepository } from '../../models/accounts/index.js';
import { decoyQuestion, MAX_FAILED_RESET_ANSWERS, RESET_BLOCK_MS } from './reset-policy.js';
import {
  ANSWER_REQUIRED_MESSAGE,
  createPasswordResetService,
  INVALID_MOBILE_MESSAGE,
  type PasswordResetDeps,
} from './service.js';

const NOW = Date.parse('2024-06-01T10:00:00.000Z');
const ACCOUNT_MOBILE = '9876500011';
const UNKNOWN_MOBILE = '9000000001';
const STORED_QUESTION = SECURITY_QUESTIONS[0];
const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters, with letters and digits.';
const NEW_PASSWORD = 'Travel@456';

/** The account columns a reset writes — enough of `UserPatch` for these specs. */
interface PatchLike {
  passwordHash?: string;
  failedLoginCount?: number;
  lockedUntil?: string | null;
  failedResetCount?: number;
  resetBlockedUntil?: string | null;
}

interface Harness {
  readonly users: UserRepository;
  readonly patches: PatchLike[];
  readonly answerChecks: string[];
  current: UserRecord | null;
}

function accountRecord(state: {
  failedResetCount: number;
  resetBlockedUntil: string | null;
  failedLoginCount?: number;
  lockedUntil?: string | null;
}): UserRecord {
  return {
    id: 'user-priya',
    fullName: 'Priya Nair',
    mobile: ACCOUNT_MOBILE,
    securityQuestionId: STORED_QUESTION.id,
    passwordHash: 'hash:Old@12345',
    securityAnswerHash: 'answer:meera',
    failedLoginCount: state.failedLoginCount ?? 0,
    lockedUntil: state.lockedUntil ?? null,
    failedResetCount: state.failedResetCount,
    resetBlockedUntil: state.resetBlockedUntil,
    createdAt: '2024-05-01T04:30:00.000Z',
  };
}

function harnessFor(initial: UserRecord | null): Harness {
  const harness: Harness = {
    patches: [],
    answerChecks: [],
    current: initial,
    users: {
      async findByMobile(mobile: string): Promise<UserRecord | null> {
        const record = harness.current;
        return record !== null && record.mobile === mobile.trim() ? record : null;
      },
      async findById(id: string): Promise<UserRecord | null> {
        const record = harness.current;
        return record !== null && record.id === id ? record : null;
      },
      async create(): Promise<UserRecord> {
        throw new Error('password reset never creates an account');
      },
      async update(id: string, patch: PatchLike): Promise<UserRecord> {
        const record = harness.current;
        if (record === null) throw new Error('no account to update');
        if (record.id !== id) throw new Error('unexpected account id');
        harness.patches.push(patch);
        const next: UserRecord = {
          ...record,
          passwordHash: patch.passwordHash !== undefined ? patch.passwordHash : record.passwordHash,
          failedLoginCount:
            patch.failedLoginCount !== undefined ? patch.failedLoginCount : record.failedLoginCount,
          lockedUntil: patch.lockedUntil !== undefined ? patch.lockedUntil : record.lockedUntil,
          failedResetCount:
            patch.failedResetCount !== undefined ? patch.failedResetCount : record.failedResetCount,
          resetBlockedUntil:
            patch.resetBlockedUntil !== undefined ? patch.resetBlockedUntil : record.resetBlockedUntil,
        };
        harness.current = next;
        return next;
      },
    },
  };
  return harness;
}

function depsFor(harness: Harness, nowMs: number = NOW): PasswordResetDeps {
  return {
    users: harness.users,
    now: (): number => nowMs,
    async verifyAnswer(answer: string, hash: string): Promise<boolean> {
      harness.answerChecks.push(answer);
      return hash === `answer:${answer.trim().toLowerCase()}`;
    },
    async hashPassword(password: string): Promise<string> {
      return `hash:${password}`;
    },
    validatePassword(password: string): string | null {
      return /^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$/.test(password) ? null : PASSWORD_RULE_MESSAGE;
    },
  };
}

function verifyInput(overrides: {
  mobile?: string;
  answer?: string;
  newPassword?: string;
  confirmPassword?: string;
}): { mobile: string; answer: string; newPassword: string; confirmPassword: string } {
  return {
    mobile: overrides.mobile ?? ACCOUNT_MOBILE,
    answer: overrides.answer ?? 'Meera',
    newPassword: overrides.newPassword ?? NEW_PASSWORD,
    confirmPassword: overrides.confirmPassword ?? NEW_PASSWORD,
  };
}

describe('the security question step', () => {
  it("returns the account's stored question for a registered mobile number", async () => {
    const harness = harnessFor(accountRecord({ failedResetCount: 0, resetBlockedUntil: null }));
    const service = createPasswordResetService(depsFor(harness));

    const outcome = await service.question({ mobile: ACCOUNT_MOBILE });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.securityQuestionId).toBe(STORED_QUESTION.id);
      expect(outcome.label).toBe(STORED_QUESTION.label);
    }
  });

  it('returns the same deterministic decoy for a number with no account', async () => {
    const harness = harnessFor(null);
    const service = createPasswordResetService(depsFor(harness));

    const first = await service.question({ mobile: UNKNOWN_MOBILE });
    const second = await service.question({ mobile: UNKNOWN_MOBILE });

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (first.ok) {
      const decoy = decoyQuestion(UNKNOWN_MOBILE);
      expect(first.securityQuestionId).toBe(decoy.securityQuestionId);
      expect(first.label).toBe(decoy.label);
    }
    expect(harness.patches).toHaveLength(0);
  });

  it('refuses a mobile number that is not well formed', async () => {
    const harness = harnessFor(null);
    const service = createPasswordResetService(depsFor(harness));

    const outcome = await service.question({ mobile: '12345' });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(400);
      expect(outcome.message).toBe(INVALID_MOBILE_MESSAGE);
    }
  });
});

describe('the verify step on a number with no account', () => {
  it('refuses every answer with the wrong-answer message and writes nothing', async () => {
    const harness = harnessFor(null);
    const service = createPasswordResetService(depsFor(harness));

    const outcome = await service.verify(verifyInput({ mobile: UNKNOWN_MOBILE, answer: 'anything' }));

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(400);
      expect(outcome.message).toBe(MESSAGES.wrongSecurityAnswer);
    }
    expect(harness.patches).toHaveLength(0);
    expect(harness.answerChecks).toHaveLength(0);
  });

  it('throttles the decoy exactly like a real account, so the reply tells nothing apart', async () => {
    const harness = harnessFor(null);
    const service = createPasswordResetService(depsFor(harness));

    for (let attempt = 1; attempt < MAX_FAILED_RESET_ANSWERS; attempt += 1) {
      const outcome = await service.verify(verifyInput({ mobile: UNKNOWN_MOBILE, answer: 'guess' }));
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.status).toBe(400);
        expect(outcome.message).toBe(MESSAGES.wrongSecurityAnswer);
      }
    }

    const blocked = await service.verify(verifyInput({ mobile: UNKNOWN_MOBILE, answer: 'guess' }));
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe(429);
      expect(blocked.message).toBe(MESSAGES.resetBlocked);
    }
    expect(harness.patches).toHaveLength(0);
  });
});

describe('the verify step on a registered number', () => {
  it('counts the first four wrong answers one by one', async () => {
    const harness = harnessFor(accountRecord({ failedResetCount: 0, resetBlockedUntil: null }));
    const service = createPasswordResetService(depsFor(harness));

    for (let attempt = 1; attempt < MAX_FAILED_RESET_ANSWERS; attempt += 1) {
      const outcome = await service.verify(verifyInput({ answer: 'Sunita' }));
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.status).toBe(400);
        expect(outcome.message).toBe(MESSAGES.wrongSecurityAnswer);
      }
      expect(harness.patches[harness.patches.length - 1]).toEqual({
        failedResetCount: attempt,
        resetBlockedUntil: null,
      });
    }

    expect(harness.patches).toHaveLength(MAX_FAILED_RESET_ANSWERS - 1);
    expect(harness.current?.resetBlockedUntil).toBe(null);
  });

  it('blocks reset for one hour on the fifth wrong answer', async () => {
    const harness = harnessFor(accountRecord({ failedResetCount: 4, resetBlockedUntil: null }));
    const service = createPasswordResetService(depsFor(harness));

    const outcome = await service.verify(verifyInput({ answer: 'Sunita' }));

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(429);
      expect(outcome.message).toBe(MESSAGES.resetBlocked);
    }
    expect(harness.patches[0]).toEqual({
      failedResetCount: MAX_FAILED_RESET_ANSWERS,
      resetBlockedUntil: new Date(NOW + RESET_BLOCK_MS).toISOString(),
    });
    expect(harness.current?.resetBlockedUntil).toBe(new Date(NOW + RESET_BLOCK_MS).toISOString());
  });

  it('refuses even the correct answer while the hour-long block is running', async () => {
    const blockedUntil = new Date(NOW + RESET_BLOCK_MS).toISOString();
    const harness = harnessFor(accountRecord({ failedResetCount: 5, resetBlockedUntil: blockedUntil }));
    const service = createPasswordResetService(depsFor(harness, NOW + 59 * 60 * 1000));

    const outcome = await service.verify(verifyInput({ answer: 'Meera' }));

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(429);
      expect(outcome.message).toBe(MESSAGES.resetBlocked);
    }
    expect(harness.answerChecks).toHaveLength(0);
    expect(harness.patches).toHaveLength(0);
    expect(harness.current?.passwordHash).toBe('hash:Old@12345');
  });

  it('accepts the correct answer once the hour has passed, case-insensitively', async () => {
    const blockedUntil = new Date(NOW + RESET_BLOCK_MS).toISOString();
    const harness = harnessFor(
      accountRecord({
        failedResetCount: 5,
        resetBlockedUntil: blockedUntil,
        failedLoginCount: 5,
        lockedUntil: new Date(NOW).toISOString(),
      }),
    );
    const service = createPasswordResetService(depsFor(harness, NOW + RESET_BLOCK_MS + 1000));

    const outcome = await service.verify(verifyInput({ answer: '  MeErA ' }));

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.user).toEqual({
        id: 'user-priya',
        fullName: 'Priya Nair',
        mobile: ACCOUNT_MOBILE,
        securityQuestionId: STORED_QUESTION.id,
      });
    }
    expect(harness.patches).toHaveLength(1);
    expect(harness.patches[0]).toEqual({
      passwordHash: `hash:${NEW_PASSWORD}`,
      failedLoginCount: 0,
      lockedUntil: null,
      failedResetCount: 0,
      resetBlockedUntil: null,
    });
  });

  it('sets the password and clears the login lockout on a correct answer', async () => {
    const harness = harnessFor(
      accountRecord({ failedResetCount: 2, resetBlockedUntil: null, failedLoginCount: 3 }),
    );
    const service = createPasswordResetService(depsFor(harness));

    const outcome = await service.verify(verifyInput({ answer: 'Meera' }));

    expect(outcome.ok).toBe(true);
    expect(harness.current?.passwordHash).toBe(`hash:${NEW_PASSWORD}`);
    expect(harness.current?.failedLoginCount).toBe(0);
    expect(harness.current?.lockedUntil).toBe(null);
    expect(harness.current?.failedResetCount).toBe(0);
    expect(harness.current?.resetBlockedUntil).toBe(null);
  });

  it('refuses a new password that breaks the signup rules, without counting an attempt', async () => {
    const harness = harnessFor(accountRecord({ failedResetCount: 0, resetBlockedUntil: null }));
    const service = createPasswordResetService(depsFor(harness));

    const outcome = await service.verify(
      verifyInput({ answer: 'Meera', newPassword: 'short', confirmPassword: 'short' }),
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(400);
      expect(outcome.message).toBe(PASSWORD_RULE_MESSAGE);
    }
    expect(harness.patches).toHaveLength(0);
    expect(harness.current?.passwordHash).toBe('hash:Old@12345');
  });

  it('refuses two different new passwords', async () => {
    const harness = harnessFor(accountRecord({ failedResetCount: 0, resetBlockedUntil: null }));
    const service = createPasswordResetService(depsFor(harness));

    const outcome = await service.verify(
      verifyInput({ answer: 'Meera', newPassword: NEW_PASSWORD, confirmPassword: 'Travel@999' }),
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(400);
      expect(outcome.message).toBe(MESSAGES.passwordMismatch);
    }
    expect(harness.patches).toHaveLength(0);
  });

  it('refuses an empty answer and a malformed mobile number before any lookup', async () => {
    const harness = harnessFor(accountRecord({ failedResetCount: 0, resetBlockedUntil: null }));
    const service = createPasswordResetService(depsFor(harness));

    const emptyAnswer = await service.verify(verifyInput({ answer: '   ' }));
    expect(emptyAnswer.ok).toBe(false);
    if (!emptyAnswer.ok) {
      expect(emptyAnswer.status).toBe(400);
      expect(emptyAnswer.message).toBe(ANSWER_REQUIRED_MESSAGE);
    }

    const badMobile = await service.verify(verifyInput({ mobile: '1234567890' }));
    expect(badMobile.ok).toBe(false);
    if (!badMobile.ok) {
      expect(badMobile.status).toBe(400);
      expect(badMobile.message).toBe(INVALID_MOBILE_MESSAGE);
    }

    expect(harness.answerChecks).toHaveLength(0);
    expect(harness.patches).toHaveLength(0);
  });
});
