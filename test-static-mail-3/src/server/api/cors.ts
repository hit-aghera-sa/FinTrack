/**
 * CORS for the tasks API.
 *
 * In development the browser client is served by the Vite dev server on a different
 * origin, so the API answers cross-origin GET/PUT for that origin (and the
 * `vite preview` origin) and answers the preflight itself.
 *
 * Pure module: importing it opens no connections, reads no environment and mutates
 * no global state.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** The Vite dev server origins. */
export const VITE_DEV_ORIGINS: readonly string[] = ['http://localhost:5173', 'http://127.0.0.1:5173'];

/** Origins allowed out of the box: the Vite dev server plus `vite preview`. */
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
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
export function originsFromEnv(value: string | undefined): readonly string[] {
  if (typeof value !== 'string') return DEFAULT_ALLOWED_ORIGINS;
  const parsed = value
    .split(',')
    .map((entry: string) => entry.trim())
    .filter((entry: string) => entry.length > 0);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
}

/**
 * The value to echo in `Access-Control-Allow-Origin`, or `null` when the request
 * carries no origin or the origin is not allowed (same-origin requests need no
 * header at all, so `null` is a normal, successful outcome).
 */
export function resolveAllowedOrigin(
  origin: string | undefined,
  allowed: readonly string[] = DEFAULT_ALLOWED_ORIGINS,
): string | null {
  if (allowed.includes('*')) return '*';
  if (typeof origin !== 'string' || origin.length === 0) return null;
  return allowed.includes(origin) ? origin : null;
}

/** The response headers for a request from the already-resolved `origin`. */
export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
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
export function createCorsMiddleware(allowed: readonly string[] = DEFAULT_ALLOWED_ORIGINS): RequestHandler {
  return function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
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
