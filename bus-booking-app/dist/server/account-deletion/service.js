import { MESSAGES } from '../../messages/index.js';
import { NOT_SIGNED_IN_MESSAGE } from '../auth/index.js';
import { summariseBookings } from './preview.js';
import { readCurrentPassword } from './validation.js';
export function createAccountDeletionService(deps) {
    const clock = deps.now ?? (() => new Date());
    return {
        async preview(userId) {
            const account = await deps.users.findById(userId);
            if (account === null)
                return null;
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
        async deleteAccount(input) {
            const password = readCurrentPassword(input.body);
            if (!password.ok)
                return { ok: false, code: 'invalid_request', message: password.message };
            const account = await deps.users.findById(input.userId);
            if (account === null)
                return { ok: false, code: 'not_found', message: NOT_SIGNED_IN_MESSAGE };
            const matches = await deps.verifyPassword(password.currentPassword, account.passwordHash);
            if (!matches)
                return { ok: false, code: 'wrong_password', message: MESSAGES.currentPasswordIncorrect };
            const purge = await deps.store.purgeAccount(input.userId);
            return { ok: true, purge };
        },
    };
}
