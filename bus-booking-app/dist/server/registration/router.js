import express from 'express';
import { SECURITY_QUESTIONS } from '../../models/accounts/index.js';
import { userRepository } from '../../db/accounts/index.js';
import { hashPassword, hashSecurityAnswer, SERVICE_UNAVAILABLE_MESSAGE, startSession, validatePassword, } from '../auth/index.js';
import { createSignupService } from './signup-service.js';
/**
 * THE ACCOUNT SIGN-UP ROUTES, mounted under `/api` by the server composition root:
 *
 *   GET  /api/auth/security-questions → the fixed list of four questions, for the Sign up form
 *   POST /api/auth/signup             → create the account, start the session, answer with the user
 *
 * Nothing here is guarded: both routes are what a traveller with no account uses. A refused field
 * answers 400, an already-registered mobile number 409, and a database that cannot be reached 503 —
 * never a pretend success.
 */
export const signupRouter = express.Router();
const signupService = createSignupService({
    users: userRepository,
    hashPassword,
    hashSecurityAnswer,
    validatePassword,
});
function errorPayload(message, field) {
    return field === null ? { error: message, message } : { error: message, message, field };
}
signupRouter.get('/auth/security-questions', (_req, res) => {
    const questions = SECURITY_QUESTIONS.map((question) => ({
        id: question.id,
        label: question.label,
    }));
    res.status(200).json(questions);
});
async function handleSignup(req, res) {
    try {
        const outcome = await signupService.register(req.body);
        if (!outcome.ok) {
            res.status(outcome.status).json(errorPayload(outcome.message, outcome.field));
            return;
        }
        // The traveller is logged in straight away: the session cookie goes out with this response.
        await startSession(req, res, outcome.user.id);
        res.status(201).json({ user: outcome.user, message: outcome.message });
    }
    catch (error) {
        console.error('signup failed:', error instanceof Error ? error.message : String(error));
        res.status(503).json(errorPayload(SERVICE_UNAVAILABLE_MESSAGE, null));
    }
}
signupRouter.post('/auth/signup', express.json(), (req, res) => {
    void handleSignup(req, res);
});
