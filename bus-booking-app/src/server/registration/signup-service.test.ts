import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../messages/index.js';
import {
  SECURITY_QUESTIONS,
  type SecurityQuestionId,
  type UserRecord,
  type UserRepository,
} from '../../models/accounts/index.js';
import {
  createSignupService,
  DUPLICATE_MOBILE_PRISMA_CODE,
  type SignupDeps,
} from './signup-service.js';
import { MOBILE_MESSAGE } from './validation.js';

const QUESTION_ID: SecurityQuestionId = SECURITY_QUESTIONS[0].id;

type CreateInput = Parameters<UserRepository['create']>[0];

function accountRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'user-ad7',
    fullName: 'Aarti Deshmukh',
    mobile: '9812345670',
    securityQuestionId: QUESTION_ID,
    passwordHash: 'hash:Travel123',
    securityAnswerHash: 'answer:meera',
    failedLoginCount: 0,
    lockedUntil: null,
    failedResetCount: 0,
    resetBlockedUntil: null,
    createdAt: '2024-06-01T04:30:00.000Z',
    ...overrides,
  };
}

function signupBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fullName: 'Aarti Deshmukh',
    mobile: '9812345670',
    password: 'Travel123',
    confirmPassword: 'Travel123',
    securityQuestionId: QUESTION_ID,
    securityAnswer: 'Meera',
    ...overrides,
  };
}

interface Harness {
  readonly deps: SignupDeps;
  readonly created: CreateInput[];
  readonly lookedUp: string[];
}

function harness(options: { existing?: UserRecord; createError?: unknown } = {}): Harness {
  const created: CreateInput[] = [];
  const lookedUp: string[] = [];

  const users: Pick<UserRepository, 'findByMobile' | 'create'> = {
    async findByMobile(mobile: string): Promise<UserRecord | null> {
      lookedUp.push(mobile);
      return options.existing ?? null;
    },
    async create(input: CreateInput): Promise<UserRecord> {
      if (options.createError !== undefined) throw options.createError;
      created.push(input);
      return accountRecord({
        fullName: input.fullName,
        mobile: input.mobile,
        securityQuestionId: input.securityQuestionId,
        passwordHash: input.passwordHash,
        securityAnswerHash: input.securityAnswerHash,
      });
    },
  };

  const deps: SignupDeps = {
    users,
    hashPassword: async (password: string): Promise<string> => `hash:${password}`,
    hashSecurityAnswer: async (answer: string): Promise<string> => `answer:${answer.toLowerCase()}`,
    validatePassword: (): string | null => null,
  };

  return { deps, created, lookedUp };
}

describe('createSignupService', () => {
  it('creates the account, hashes both credentials and returns the welcome payload', async () => {
    const context = harness();
    const outcome = await createSignupService(context.deps).register(signupBody());

    if (!outcome.ok) throw new Error(`expected success, got: ${outcome.message}`);
    expect(outcome.status).toBe(201);
    expect(outcome.user.id).toBe('user-ad7');
    expect(outcome.user.fullName).toBe('Aarti Deshmukh');
    expect(outcome.user.mobile).toBe('9812345670');
    expect(outcome.user.securityQuestionId).toBe(QUESTION_ID);
    expect(outcome.message).toBe(MESSAGES.welcome('Aarti Deshmukh'));

    expect(context.lookedUp).toEqual(['9812345670']);
    expect(context.created).toHaveLength(1);
    expect(context.created[0].passwordHash).toBe('hash:Travel123');
    // The answer is hashed in its normalised form, so it compares case-insensitively later.
    expect(context.created[0].securityAnswerHash).toBe('answer:meera');
    expect(context.created[0].securityQuestionId).toBe(QUESTION_ID);
  });

  it('refuses a mobile number that already has an account', async () => {
    const context = harness({ existing: accountRecord() });
    const outcome = await createSignupService(context.deps).register(signupBody());

    if (outcome.ok) throw new Error('expected a refusal');
    expect(outcome.status).toBe(409);
    expect(outcome.field).toBe('mobile');
    expect(outcome.message).toBe(MESSAGES.duplicateMobile);
    expect(outcome.message).toBe('An account with this mobile number already exists. Please log in.');
    expect(context.created).toHaveLength(0);
  });

  it('reports the duplicate number when two sign-ups race on it', async () => {
    const raceError = Object.assign(new Error('Unique constraint failed on the fields: (`mobileNumber`)'), {
      code: DUPLICATE_MOBILE_PRISMA_CODE,
    });
    const context = harness({ createError: raceError });
    const outcome = await createSignupService(context.deps).register(signupBody());

    if (outcome.ok) throw new Error('expected a refusal');
    expect(outcome.status).toBe(409);
    expect(outcome.message).toBe(MESSAGES.duplicateMobile);
  });

  it('answers a broken field with 400 and never touches the database', async () => {
    const context = harness();
    const outcome = await createSignupService(context.deps).register(signupBody({ mobile: '1234567890' }));

    if (outcome.ok) throw new Error('expected a refusal');
    expect(outcome.status).toBe(400);
    expect(outcome.field).toBe('mobile');
    expect(outcome.message).toBe(MOBILE_MESSAGE);
    expect(context.lookedUp).toHaveLength(0);
    expect(context.created).toHaveLength(0);
  });

  it('lets a real database failure through rather than pretending the account was created', async () => {
    const outage = new Error('connection refused');
    const context = harness({ createError: outage });

    await expect(createSignupService(context.deps).register(signupBody())).rejects.toBe(outage);
  });
});
