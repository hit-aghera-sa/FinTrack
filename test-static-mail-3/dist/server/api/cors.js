/** The Vite dev server origins. */
export const VITE_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
/** Origins allowed out of the box: the Vite dev server plus `vite preview`. */
export const DEFAULT_ALLOWED_ORIGINS = [
    ...VITE_DEV_ORIGINS,
    'http://localhost:4173',
    'http://127.0.0.1:4173',
];
/** The only methods this API exposes (plus the preflight). */
export const ALLOWED_METHODS = 'GET, PUT, OPTIONS';
/** The only request header the client needs to send. */
export const ALLOWED_HEADERS = 'Content-Type';
/** How long a browser may cache the preflight result, in seconds. */
export const MAX_AGE_SECONDS = 600;
/**
 * Parse a comma separated origin list (e.g. from an environment variable),
 * falling back to {@link DEFAULT_ALLOWED_ORIGINS} when it is absent or empty.
 */
export function originsFromEnv(value) {
    if (typeof value !== 'string')
        return DEFAULT_ALLOWED_ORIGINS;
    const parsed = value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
}
/**
 * The value to echo in `Access-Control-Allow-Origin`, or `null` when the request
 * carries no origin or the origin is not allowed (same-origin requests need no
 * header at all, so `null` is a normal, successful outcome).
 */
export function resolveAllowedOrigin(origin, allowed = DEFAULT_ALLOWED_ORIGINS) {
    if (allowed.includes('*'))
        return '*';
    if (typeof origin !== 'string' || origin.length === 0)
        return null;
    return allowed.includes(origin) ? origin : null;
}
/** The response headers for a request from the already-resolved `origin`. */
export function corsHeaders(origin) {
    const headers = {
        'Access-Control-Allow-Methods': ALLOWED_METHODS,
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        'Access-Control-Max-Age': String(MAX_AGE_SECONDS),
        Vary: 'Origin',
    };
    if (origin !== null) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
}
/**
 * Middleware applying {@link corsHeaders} and short-circuiting the preflight with
 * `204 No Content`.
 */
export function createCorsMiddleware(allowed = DEFAULT_ALLOWED_ORIGINS) {
    return function corsMiddleware(req, res, next) {
        const origin = resolveAllowedOrigin(req.headers.origin, allowed);
        for (const [name, value] of Object.entries(corsHeaders(origin))) {
            res.setHeader(name, value);
        }
        if (req.method === 'OPTIONS') {
            res.status(204).end();
            return;
        }
        next();
    };
}
