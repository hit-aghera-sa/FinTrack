import type { CreateUserInput, UserPatch, UserRecord, UserRepository } from '../../models/accounts/index.js';
import { toUserRecord, toUserRowPatch, type NewUserRow, type UserRow, type UserRowPatch } from './rows.js';

/**
 * THE ACCOUNT REPOSITORY, as a factory over a tiny row store.
 *
 * The store is the only part that knows about Prisma (see `prisma-stores.ts`); everything the app
 * relies on — the mobile-number lookup, the ISO date translation, the partial update — lives in this
 * pure factory, so it can be exercised with an in-memory store and no database.
 */

/** The row-level access the account repository needs. */
export interface UserStore {
  findByMobileNumber(mobileNumber: string): Promise<UserRow | null>;
  findById(id: string): Promise<UserRow | null>;
  insert(row: NewUserRow): Promise<UserRow>;
  patch(id: string, patch: UserRowPatch): Promise<UserRow>;
}

/** The mobile number as it is stored and compared: no surrounding whitespace, digits as typed. */
export function normaliseMobile(mobile: string): string {
  return mobile.trim();
}

export function createUserRepository(store: UserStore): UserRepository {
  return {
    async findByMobile(mobile: string): Promise<UserRecord | null> {
      const row = await store.findByMobileNumber(normaliseMobile(mobile));
      return row === null ? null : toUserRecord(row);
    },

    async findById(id: string): Promise<UserRecord | null> {
      const row = await store.findById(id);
      return row === null ? null : toUserRecord(row);
    },

    async create(input: CreateUserInput): Promise<UserRecord> {
      const row = await store.insert({
        fullName: input.fullName.trim(),
        mobileNumber: normaliseMobile(input.mobile),
        passwordHash: input.passwordHash,
        securityQuestionId: input.securityQuestionId,
        securityAnswerHash: input.securityAnswerHash,
      });
      return toUserRecord(row);
    },

    async update(id: string, patch: UserPatch): Promise<UserRecord> {
      const row = await store.patch(id, toUserRowPatch(patch));
      return toUserRecord(row);
    },
  };
}
