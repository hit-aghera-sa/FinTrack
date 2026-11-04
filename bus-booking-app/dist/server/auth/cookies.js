/**
 * THE SESSION COOKIE of Bus Booking App.
 *
 * The session credential lives ONLY in this http-only cookie and in the Session table — never in
 * device-only storage — so the same account follows a traveller between a phone browser and a desktop
 * browser, and a page reload or a browser restart keeps them signed in. The cookie carries a long
 * Max-Age because a session ends when the traveller logs out (or revokes it), not on a timer: the
 * server-side row is the authority, and clearing it is what really ends the session.
 *
 * Everything here is pure string work, so it can be read and tested with no server at all.
 */
/** The cookie the browser sends back on every authenticated call. */
export const SESSION_COOKIE_NAME = 'bb_session';
/** One year — "until logout", as far as a browser cookie can express it. */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
/** A `Cookie:` header as a name → value map. Unparsable pairs are skipped rather than thrown over. */
export function parseCookieHeader(header) {
    const jar = {};
    if (header === undefined || header.trim() === '')
        return jar;
    for (const part of header.split(';')) {
        const separator = part.indexOf('=');
        if (separator <= 0)
            continue;
        const name = part.slice(0, separator).trim();
        if (name === '')
            continue;
        const raw = part.slice(separator + 1).trim();
        try {
            jar[name] = decodeURIComponent(raw);
        }
        catch {
            // A malformed percent-escape is not worth refusing the whole request over.
            jar[name] = raw;
        }
    }
    return jar;
}
/** The session token this request carries, or null when the caller is signed out. */
export function readSessionToken(req) {
    const header = req.headers.cookie;
    const jar = parseCookieHeader(typeof header === 'string' ? header : undefined);
    const token = jar[SESSION_COOKIE_NAME];
    return token === undefined || token === '' ? null : token;
}
/** The `Set-Cookie` value that starts a session. */
export function sessionCookie(token, secure) {
    const attributes = [
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`,
    ];
    if (secure)
        attributes.push('Secure');
    return attributes.join('; ');
}
/** The `Set-Cookie` value that ends a session in the browser. */
export function clearedSessionCookie(secure) {
    const attributes = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
    if (secure)
        attributes.push('Secure');
    return attributes.join('; ');
}
