/**
 * READING THE SESSION COOKIE OFF A REQUEST HEADER — a pure function, so the router's "which row is
 * this device?" behaviour can be tested without an HTTP server.
 *
 * The cookie NAME itself is not invented here: the router passes `SESSION_COOKIE_NAME` from the auth
 * lane, which owns it.
 */
export function readSessionTokenFromCookies(header, cookieName) {
    if (typeof header !== 'string' || header.trim() === '')
        return null;
    for (const part of header.split(';')) {
        const separator = part.indexOf('=');
        if (separator === -1)
            continue;
        if (part.slice(0, separator).trim() !== cookieName)
            continue;
        const raw = part.slice(separator + 1).trim();
        if (raw === '')
            return null;
        try {
            return decodeURIComponent(raw);
        }
        catch {
            // A value that is not percent-encoded is still the token the browser sent.
            return raw;
        }
    }
    return null;
}
