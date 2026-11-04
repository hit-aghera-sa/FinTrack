import { randomBytes } from 'node:crypto';
import { sessionRepository } from '../../db/accounts/index.js';
import { clearedSessionCookie, readSessionToken, sessionCookie } from './cookies.js';
/**
 * STARTING, READING AND ENDING A SESSION.
 *
 * A session is a random token written to the Session table and handed back in an http-only cookie;
 * the row is the authority, so logging out (or revoking a device) really does end it everywhere. The
 * three functions here are what the log-in, sign-up and password-reset lanes call to sign a traveller
 * in, and what `requireUser` calls to recognise one.
 */
/** 256 bits of randomness, hex-encoded: unguessable and safe in a cookie value. */
export function createSessionToken() {
    return randomBytes(32).toString('hex');
}
/** Whether the cookie may be marked `Secure` — true behind an HTTPS proxy, false on plain local http. */
function isSecureRequest(req) {
    const forwarded = req.headers['x-forwarded-proto'];
    const header = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (typeof header === 'string' && header !== '') {
        const first = header.split(',')[0];
        return first.trim().toLowerCase() === 'https';
    }
    return req.protocol === 'https';
}
/** A short, readable device description for the active-devices list, or null when the client sent none. */
function deviceDescription(req) {
    const header = req.headers['user-agent'];
    if (typeof header !== 'string')
        return null;
    const trimmed = header.trim();
    return trimmed === '' ? null : trimmed.slice(0, 200);
}
/**
 * Sign `userId` in on this browser: a new session row, and the http-only cookie that names it.
 * Called after a successful log-in, after sign-up and after a completed password reset.
 */
export async function startSession(req, res, userId) {
    const token = createSessionToken();
    await sessionRepository.create({ userId, token, userAgent: deviceDescription(req) });
    res.append('Set-Cookie', sessionCookie(token, isSecureRequest(req)));
}
/** End this browser's session: the cookie is cleared and the session row is deleted. */
export async function clearSession(req, res) {
    const token = readSessionToken(req);
    res.append('Set-Cookie', clearedSessionCookie(isSecureRequest(req)));
    if (token !== null)
        await sessionRepository.deleteByToken(token);
}
/** The account behind this request's session cookie, or null when the caller is signed out. */
export async function currentUser(req) {
    const token = readSessionToken(req);
    if (token === null)
        return null;
    return sessionRepository.findUserByToken(token);
}
