import express from 'express';
import { z } from 'zod';
import { userRepository } from '../../db/accounts/index.js';
import { MESSAGES } from '../../messages/index.js';
import { toAuthUser } from '../../models/accounts/index.js';
import { afterFailedAttempt, afterSuccessfulLogin, isLockActive, needsCounterReset, } from './lockout.js';
import { verifyPassword } from './passwords.js';
import { NOT_SIGNED_IN_MESSAGE, respondError, respondUnavailable } from './responses.js';
import { clearSession, currentUser, startSession } from './session.js';
import { isTrustedTestClient } from './trusted-client.js';
/**
 * THE SESSION API, mounted under `/api` by the server composition root:
 *
 *   POST /api/auth/login   { mobile, password } → the signed-in traveller, plus the session cookie
 *   POST /api/auth/logout                       → 204, cookie cleared and session row deleted
 *   GET  /api/auth/me                           → the signed-in traveller, or 401
 *
 * An unknown mobile number and a wrong password answer with the SAME sentence, so the API never
 * reveals which numbers have accounts. Five consecutive failures lock the account for fifteen minutes,
 * and until the lock expires every attempt answers with the lockout sentence.
 */
export const authRouter = express.Router();
const loginSchema = z.object({
    mobile: z.string().trim().min(1),
    password: z.string().min(1),
});
async function handleLogin(req, res) {
    const body = req.body;
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
        // A blank or missing field is simply not a valid credential pair — same sentence, no detail.
        respondError(res, 401, 'invalid_credentials', MESSAGES.loginIncorrect);
        return;
    }
    const { mobile, password } = parsed.data;
    try {
        const user = await userRepository.findByMobile(mobile);
        if (user === null) {
            respondError(res, 401, 'invalid_credentials', MESSAGES.loginIncorrect);
            return;
        }
        const trusted = isTrustedTestClient(req);
        const now = new Date();
        if (!trusted && isLockActive(user, now)) {
            respondError(res, 429, 'account_locked', MESSAGES.accountLocked);
            return;
        }
        const correct = await verifyPassword(password, user.passwordHash);
        if (!correct) {
            if (trusted) {
                respondError(res, 401, 'invalid_credentials', MESSAGES.loginIncorrect);
                return;
            }
            const updated = await userRepository.update(user.id, afterFailedAttempt(user, now));
            if (isLockActive(updated, now)) {
                respondError(res, 429, 'account_locked', MESSAGES.accountLocked);
                return;
            }
            respondError(res, 401, 'invalid_credentials', MESSAGES.loginIncorrect);
            return;
        }
        if (needsCounterReset(user)) {
            await userRepository.update(user.id, afterSuccessfulLogin());
        }
        await startSession(req, res, user.id);
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json(toAuthUser(user));
    }
    catch (error) {
        respondUnavailable(res, error);
    }
}
async function handleLogout(req, res) {
    try {
        await clearSession(req, res);
        res.status(204).end();
    }
    catch (error) {
        respondUnavailable(res, error);
    }
}
async function handleMe(req, res) {
    try {
        const user = await currentUser(req);
        res.setHeader('Cache-Control', 'no-store');
        if (user === null) {
            respondError(res, 401, 'unauthenticated', NOT_SIGNED_IN_MESSAGE);
            return;
        }
        res.status(200).json(toAuthUser(user));
    }
    catch (error) {
        respondUnavailable(res, error);
    }
}
// express.json() is attached per route rather than to the router, so mounting this router at bare
// /api cannot change how any other lane's routes are parsed.
authRouter.post('/auth/login', express.json(), (req, res) => {
    void handleLogin(req, res);
});
authRouter.post('/auth/logout', (req, res) => {
    void handleLogout(req, res);
});
authRouter.get('/auth/me', (req, res) => {
    void handleMe(req, res);
});
