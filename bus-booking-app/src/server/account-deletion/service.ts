import { MESSAGES } from '../../messages/index.js';
import { NOT_SIGNED_IN_MESSAGE } from '../auth/index.js';
import { summariseBookings } from './preview.js';
import { readCurrentPassword } from './validation.js';
import type {
  AccountDeletionPreview,
  AccountDeletionResult,
  AccountDeletionStore,
  DeletionBookingReader,
  DeletionSessionReader,
  DeletionUserStore,
} from './types.js';

/**
 * THE RULES OF ACCOUNT DELETION, with no HTTP in sight.
 *
 *   • the preview states the counts the traveller is about to destroy, read against one instant;
 *   • a deletion REQUIRES the current password, verified with the app's own credential helper, and a
 *     wrong one is refused with the profile lane's wording and destroys nothing;
 *   • only once the password matches does the store's single transaction run.
 *
 * No outside service is contacted: no confirmation email, no SMS, no notification of any kind.
 */
export interface AccountDeletionServiceDeps {
  readonly users: DeletionUserStore;
  readonly bookings: DeletionBookingReader;
  readonly sessions: DeletionSessionReader;
  readonly store: AccountDeletionStore;
  readonly verifyPassword: (password: string, hash: string) => Promise<boolean>;
  /** The clock, for the preview's upcoming/past split. Defaults to the real one. */
  readonly now?: () => Date;
}

export interface DeleteAccountRequest {
  readonly userId: string;
  /** The request body, exactly as it arrived. */
  readonly body: unknown;
}

export interface AccountDeletionService {
  /** The counts, or null when that account no longer exists. */
  preview(userId: string): Promise<AccountDeletionPreview | null>;
  deleteAccount(input: DeleteAccountRequest): Promise<AccountDeletionResult>;
}

export function createAccountDeletionService(deps: AccountDeletionServiceDeps): AccountDeletionService {
  const clock = deps.now ?? ((): Date => new Date());

  return {
    async preview(userId: string): Promise<AccountDeletionPreview | null> {
      const account = await deps.users.findById(userId);
      if (account === null) return null;
      const now = clock();
      const [bookings, sessions] = await Promise.all([
        deps.bookings.listByUser(userId, now),
        deps.sessions.listActiveByUser(userId),
      ]);
      const counts = summariseBookings(bookings, now);
      return {
        upcomingBookings: counts.upcomingBookings,
        pastBookings: counts.pastBookings,
        activeSessions: sessions.length,
      };
    },

    async deleteAccount(input: DeleteAccountRequest): Promise<AccountDeletionResult> {
      const password = readCurrentPassword(input.body);
      if (!password.ok) return { ok: false, code: 'invalid_request', message: password.message };

      const account = await deps.users.findById(input.userId);
      if (account === null) return { ok: false, code: 'not_found', message: NOT_SIGNED_IN_MESSAGE };

      const matches = await deps.verifyPassword(password.currentPassword, account.passwordHash);
      if (!matches) return { ok: false, code: 'wrong_password', message: MESSAGES.currentPasswordIncorrect };

      const purge = await deps.store.purgeAccount(input.userId);
      return { ok: true, purge };
    },
  };
}
