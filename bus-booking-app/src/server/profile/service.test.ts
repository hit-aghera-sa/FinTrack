import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../messages/index.js';
import {
  SECURITY_QUESTIONS,
  type UserPatch,
  type UserRecord,
} from '../../models/accounts/index.js';
import {
  createProfileService,
  type ProfileService,
  type ProfileServiceDeps,
  type ProfileUserStore,
} from './service.js';
import {
  FULL_NAME_RULE_MESSAGE,
  SECURITY_ANSWER_RULE_MESSAGE,
  SECURITY_QUESTION_RULE_MESSAGE,
  updateNameSchema,
} from './validation.js';

/**
 * The two things these specs exist to pin down:
 *
 *   • the CURRENT PASSWORD is verified before a password or a security question is rewritten, and a
 *     wrong one changes nothing at all;
 *   • the MOBILE NUMBER is immutable — it is stripped from a request body that carries it, and it is
 *     never part of any patch the service writes.
 *
 * No database and no bcrypt: the store and the credential helpers are injected through the factory.
 */

const WEAK_PASSWORD_MESSAGE = 'Password must be at least 8 characters and include a letter and a digit.';

const FIRST_QUESTION_ID = SECURITY_QUESTIONS[0].id;
const SECOND_QUESTION_ID = SECURITY_QUESTIONS[1].id;

const CORRECT_PASSWORD = 'Travel@123';

function fakeHash(value: string): string {
  return `hash:${value}`;
}

function fakeValidatePassword(password: string): string | null {
  const longEnough = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  return longEnough && hasLetter && hasDigit ? null : WEAK_PASSWORD_MESSAGE;
}

const BASE_USER: UserRecord = {
  id: 'user-aisha',
  fullName: 'Aisha Kapoor',
  mobile: '9876543210',
  securityQuestionId: FIRST_QUESTION_ID,
  passwordHash: fakeHash(CORRECT_PASSWORD),
  securityAnswerHash: fakeHash('meera'),
  failedLoginCount: 0,
  lockedUntil: null,
  failedResetCount: 0,
  resetBlockedUntil: null,
  createdAt: '2024-05-01T04:30:00.000Z',
};

interface StoreHarness {
  readonly store: ProfileUserStore;
  /** Every patch handed to `update`, in order. */
  readonly patches: UserPatch[];
  current(): UserRecord;
}

function createHarness(overrides: Partial<UserRecord> = {}): StoreHarness {
  let record: UserRecord = { ...BASE_USER, ...overrides };
  const patches: UserPatch[] = [];
  const store: ProfileUserStore = {
    findById(id: string): Promise<UserRecord | null> {
      return Promise.resolve(id === record.id ? record : null);
    },
    update(id: string, patch: UserPatch): Promise<UserRecord> {
      if (id !== record.id) return Promise.reject(new Error('unknown account'));
      patches.push(patch);
      record = { ...record, ...patch };
      return Promise.resolve(record);
    },
  };
  return { store, patches, current: (): UserRecord => record };
}

function createService(store: ProfileUserStore): ProfileService {
  const deps: ProfileServiceDeps = {
    users: store,
    verifyPassword: (password: string, hash: string): Promise<boolean> =>
      Promise.resolve(hash === fakeHash(password)),
    hashPassword: (password: string): Promise<string> => Promise.resolve(fakeHash(password)),
    hashSecurityAnswer: (answer: string): Promise<string> =>
      Promise.resolve(fakeHash(answer.trim().toLowerCase())),
    validatePassword: fakeValidatePassword,
  };
  return createProfileService(deps);
}

describe('profile service — the traveller’s own details', () => {
  it('returns the signed-in traveller’s name, mobile number and security question', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).getProfile(BASE_USER.id);

    if (!result.ok) throw new Error(`expected the profile, got ${result.code}`);
    expect(result.value.fullName).toBe('Aisha Kapoor');
    expect(result.value.mobile).toBe('9876543210');
    expect(result.value.securityQuestionId).toBe(FIRST_QUESTION_ID);
  });

  it('refuses a profile whose account no longer exists with 401', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).getProfile('user-gone');

    if (result.ok) throw new Error('expected a failure');
    expect(result.code).toBe('account_missing');
    expect(result.status).toBe(401);
  });
});

describe('profile service — changing the full name', () => {
  it('writes only the full name, leaving the mobile number untouched', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).changeName(BASE_USER.id, {
      fullName: '  Aisha   Kapoor Nair ',
    });

    if (!result.ok) throw new Error(`expected success, got ${result.code}`);
    expect(result.value.fullName).toBe('Aisha Kapoor Nair');
    expect(result.value.mobile).toBe('9876543210');
    expect(harness.patches).toHaveLength(1);
    expect(Object.keys(harness.patches[0])).toEqual(['fullName']);
    expect(harness.current().mobile).toBe(BASE_USER.mobile);
  });

  it('refuses a name shorter than two characters and writes nothing', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).changeName(BASE_USER.id, { fullName: 'A' });

    if (result.ok) throw new Error('expected a failure');
    expect(result.code).toBe('invalid_full_name');
    expect(result.message).toBe(FULL_NAME_RULE_MESSAGE);
    expect(harness.patches).toHaveLength(0);
  });

  it('refuses a name longer than sixty characters', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).changeName(BASE_USER.id, {
      fullName: 'A'.repeat(61),
    });

    if (result.ok) throw new Error('expected a failure');
    expect(result.code).toBe('invalid_full_name');
    expect(harness.patches).toHaveLength(0);
  });

  it('drops a mobile number sent in the profile body — it is never a field of the request', () => {
    const parsed = updateNameSchema.safeParse({
      fullName: 'Aisha Kapoor Nair',
      mobile: '9000000011',
    });

    if (!parsed.success) throw new Error('expected the name body to parse');
    expect(parsed.data).toEqual({ fullName: 'Aisha Kapoor Nair' });
    expect('mobile' in parsed.data).toBe(false);
  });
});

describe('profile service — changing the password', () => {
  it('refuses a wrong current password and changes nothing', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).changePassword(BASE_USER.id, {
      currentPassword: 'NotMyPassword9',
      newPassword: 'Journey@456',
      confirmPassword: 'Journey@456',
    });

    if (result.ok) throw new Error('expected a failure');
    expect(result.code).toBe('wrong_current_password');
    expect(result.message).toBe(MESSAGES.currentPasswordIncorrect);
    expect(result.status).toBe(400);
    expect(harness.patches).toHaveLength(0);
    expect(harness.current().passwordHash).toBe(BASE_USER.passwordHash);
  });

  it('stores the new password hash when the current password is correct', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).changePassword(BASE_USER.id, {
      currentPassword: CORRECT_PASSWORD,
      newPassword: 'Journey@456',
      confirmPassword: 'Journey@456',
    });

    if (!result.ok) throw new Error(`expected success, got ${result.code}`);
    expect(result.value).toBeNull();
    expect(harness.patches).toHaveLength(1);
    expect(Object.keys(harness.patches[0])).toEqual(['passwordHash']);
    expect(harness.current().passwordHash).toBe(fakeHash('Journey@456'));
    expect(harness.current().mobile).toBe(BASE_USER.mobile);
    expect(harness.current().fullName).toBe(BASE_USER.fullName);
  });

  it('refuses two different new passwords', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).changePassword(BASE_USER.id, {
      currentPassword: CORRECT_PASSWORD,
      newPassword: 'Journey@456',
      confirmPassword: 'Journey@457',
    });

    if (result.ok) throw new Error('expected a failure');
    expect(result.code).toBe('password_mismatch');
    expect(result.message).toBe(MESSAGES.passwordMismatch);
    expect(harness.patches).toHaveLength(0);
  });

  it('applies the signup password rule to the new password', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).changePassword(BASE_USER.id, {
      currentPassword: CORRECT_PASSWORD,
      newPassword: 'short1',
      confirmPassword: 'short1',
    });

    if (result.ok) throw new Error('expected a failure');
    expect(result.code).toBe('weak_password');
    expect(result.message).toBe(WEAK_PASSWORD_MESSAGE);
    expect(harness.patches).toHaveLength(0);
  });
});

describe('profile service — changing the security question', () => {
  it('refuses a wrong current password and changes nothing', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).changeSecurityQuestion(BASE_USER.id, {
      currentPassword: 'NotMyPassword9',
      securityQuestionId: SECOND_QUESTION_ID,
      securityAnswer: 'Pune',
    });

    if (result.ok) throw new Error('expected a failure');
    expect(result.code).toBe('wrong_current_password');
    expect(result.message).toBe(MESSAGES.currentPasswordIncorrect);
    expect(harness.patches).toHaveLength(0);
    expect(harness.current().securityQuestionId).toBe(FIRST_QUESTION_ID);
    expect(harness.current().securityAnswerHash).toBe(BASE_USER.securityAnswerHash);
  });

  it('stores the new question and the case-folded answer hash, never the mobile number', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).changeSecurityQuestion(BASE_USER.id, {
      currentPassword: CORRECT_PASSWORD,
      securityQuestionId: SECOND_QUESTION_ID,
      securityAnswer: '  Pune  ',
    });

    if (!result.ok) throw new Error(`expected success, got ${result.code}`);
    expect(result.value.securityQuestionId).toBe(SECOND_QUESTION_ID);
    expect(result.value.mobile).toBe(BASE_USER.mobile);
    expect(harness.patches).toHaveLength(1);
    expect(Object.keys(harness.patches[0]).sort()).toEqual(['securityAnswerHash', 'securityQuestionId']);
    expect(harness.current().securityAnswerHash).toBe(fakeHash('pune'));
    expect(harness.current().mobile).toBe(BASE_USER.mobile);
  });

  it('refuses a question that is not one of the fixed list', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).changeSecurityQuestion(BASE_USER.id, {
      currentPassword: CORRECT_PASSWORD,
      securityQuestionId: 'invented-question',
      securityAnswer: 'Pune',
    });

    if (result.ok) throw new Error('expected a failure');
    expect(result.code).toBe('invalid_security_question');
    expect(result.message).toBe(SECURITY_QUESTION_RULE_MESSAGE);
    expect(harness.patches).toHaveLength(0);
  });

  it('refuses an answer shorter than two characters', async () => {
    const harness = createHarness();
    const result = await createService(harness.store).changeSecurityQuestion(BASE_USER.id, {
      currentPassword: CORRECT_PASSWORD,
      securityQuestionId: SECOND_QUESTION_ID,
      securityAnswer: ' P ',
    });

    if (result.ok) throw new Error('expected a failure');
    expect(result.code).toBe('invalid_security_answer');
    expect(result.message).toBe(SECURITY_ANSWER_RULE_MESSAGE);
    expect(harness.patches).toHaveLength(0);
  });
});
