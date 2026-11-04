/**
 * THE ONE EXEMPTION from the lockout rule.
 *
 * The platform's QA run signs in many times from the loopback address within a few minutes, and sets
 * `APP_TRUSTED_TEST_CLIENT=1` for the app while it does. When BOTH hold — the flag is set and the
 * request really came from loopback — failed attempts are not counted and an existing lock is not
 * enforced. Every other check (the password itself, the session, ownership of a resource) is
 * untouched, and this flag is read for nothing else.
 */
const LOOPBACK_ADDRESSES = new Set([
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'localhost',
]);
/** Whether a remote address is the machine itself. */
export function isLoopbackAddress(address) {
    if (address === undefined || address === null)
        return false;
    const trimmed = address.trim().toLowerCase();
    if (trimmed === '')
        return false;
    return LOOPBACK_ADDRESSES.has(trimmed) || trimmed.startsWith('127.');
}
/**
 * Whether the lockout exemption may apply at all.
 *
 * It may not. "Five wrong passwords lock the account for fifteen minutes" is an acceptance
 * criterion of this app, and a rule that any caller can opt out of is not the rule the client
 * asked for — so the exemption is switched off for every request, whatever the environment says.
 */
const LOCKOUT_EXEMPTION_ALLOWED = false;
/** Whether this request is the platform's trusted test client calling from loopback. */
export function isTrustedTestClient(req) {
    if (!LOCKOUT_EXEMPTION_ALLOWED)
        return false;
    if (process.env.APP_TRUSTED_TEST_CLIENT !== '1')
        return false;
    return isLoopbackAddress(req.ip) || isLoopbackAddress(req.socket.remoteAddress);
}
