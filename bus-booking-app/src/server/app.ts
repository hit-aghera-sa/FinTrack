import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import { API_BASE_PATH, API_PATHS, apiUrl } from '../shared/api-paths.js';
import { userRepository } from '../db/accounts/index.js';
import { DEFAULT_SECURITY_QUESTION_ID } from '../models/accounts/index.js';
import { hashPassword, hashSecurityAnswer, verifyPassword } from './auth/index.js';

/**
 * THE EXPRESS COMPOSITION ROOT of Bus Booking App — the pieces, assembled in `./index.ts`.
 *
 * `createApp()` gives an app that can parse a JSON body and answer a liveness check; the boot entry
 * then mounts every feature router under `/api`; `mountClient()` closes the stack in the one order
 * that is correct: unknown `/api` paths answer 404 JSON, and only then is the built client served
 * with its single-page fallback. Registration order is behaviour — a static handler registered
 * first would answer `POST /api/bookings` with the HTML page and a 200, so every booking would
 * silently do nothing.
 */

/** What a traveller is told when something unexpected broke on the server. */
const INTERNAL_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/** The display name given to the account created from the environment on first run. */
const BOOTSTRAP_ACCOUNT_NAME = 'Account Owner';

/** The identifier fields a sign-in request may carry. */
const IDENTIFIER_KEYS: readonly string[] = ['mobile', 'identifier', 'email', 'username'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * The built client's OWN directory. `dist/server/**` is the compiled server and is NEVER served:
 * only `dist/client` is public.
 */
export function resolveClientDir(): string {
  const fromCwd = path.resolve(process.cwd(), 'dist/client');
  if (existsSync(path.join(fromCwd, 'index.html'))) return fromCwd;
  const beside = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client');
  return existsSync(path.join(beside, 'index.html')) ? beside : fromCwd;
}

/** An Express app that reads JSON bodies and answers the liveness check. Nothing else is mounted. */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  app.get(apiUrl(API_PATHS.health), (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}

/**
 * Closes the stack, AFTER every feature router has been mounted:
 *   1. an `/api` path no router matched answers 404 with a JSON body, signed in or not;
 *   2. the built client is served as static from `dist/client` only;
 *   3. any other GET gets `dist/client/index.html`, so a deep link such as `/bookings/BB-10042`
 *      survives a reload;
 *   4. an unhandled failure answers 500 with the shared error body rather than an HTML stack.
 */
export function mountClient(app: Express): Express {
  app.use(API_BASE_PATH, (_req: Request, res: Response): void => {
    res.status(404).json({ error: 'not_found' });
  });

  const clientDir = resolveClientDir();
  app.use(express.static(clientDir, { index: false }));

  app.get('*', (_req: Request, res: Response): void => {
    const page = path.join(clientDir, 'index.html');
    if (!existsSync(page)) {
      res
        .status(503)
        .type('text/plain')
        .send('The client bundle has not been built yet. Run `npm run build:app`.');
      return;
    }
    res.sendFile(page);
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('[server] unhandled request failure', error);
    if (res.headersSent) return;
    res.status(500).json({ error: { code: 'internal_error', message: INTERNAL_ERROR_MESSAGE } });
  });

  return app;
}

/** The configured first-run account's address, or null when the environment names none. */
export function bootstrapAdminEmail(): string | null {
  const raw = process.env.APP_INITIAL_ADMIN_EMAIL;
  if (raw === undefined) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed === '' ? null : trimmed;
}

/**
 * This app signs a traveller in with a 10-digit Indian mobile number, so the account created from
 * the environment is given a stable number derived from its address — the same address always gives
 * the same number, and the number never collides with the 6-9 leading digit rule.
 *
 * The address itself remains the sign-in identifier: see {@link bootstrapAdminLoginAlias}.
 */
export function bootstrapMobileFor(email: string): string {
  const digest = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  const digits = digest.replace(/[^0-9]/gu, '');
  const tail = `${digits}000000000`.slice(0, 9);
  const lead = 6 + (parseInt(digest.slice(-2), 16) % 4);
  return `${String(lead)}${tail}`;
}

/**
 * FIRST-RUN ACCESS. When the environment supplies both `APP_INITIAL_ADMIN_EMAIL` and
 * `APP_INITIAL_ADMIN_PASSWORD`, an account for that address is created exactly once, with the
 * password hashed by the app's own credential helper. Called once at boot; with neither key set it
 * does nothing, and it never blocks the server from listening.
 */
export async function ensureBootstrapAccount(): Promise<void> {
  const email = bootstrapAdminEmail();
  const password = process.env.APP_INITIAL_ADMIN_PASSWORD;
  if (email === null || password === undefined || password === '') {
    return;
  }

  const mobile = bootstrapMobileFor(email);
  const existing = await userRepository.findByMobile(mobile);
  if (existing !== null) {
    // The environment is this one account's source of truth. When the configured password no longer
    // opens it — a redeployment that brings a fresh first-run credential to a database that already
    // holds the account — it is re-hashed with the app's own helper, and the lock-out counters left
    // behind by the credential it replaces are cleared. No other account is ever touched here.
    const opens = await verifyPassword(password, existing.passwordHash);
    if (!opens) {
      await userRepository.update(existing.id, {
        passwordHash: await hashPassword(password),
        failedLoginCount: 0,
        lockedUntil: null,
      });
      console.log('[server] the first-run account now carries the configured credential');
      return;
    }
    // Nothing to do: the configured credential already opens the account.
    return;
  }

  const passwordHash = await hashPassword(password);
  const securityAnswerHash = await hashSecurityAnswer(randomUUID());

  await userRepository.create({
    fullName: BOOTSTRAP_ACCOUNT_NAME,
    mobile,
    passwordHash,
    securityQuestionId: DEFAULT_SECURITY_QUESTION_ID,
    securityAnswerHash,
  });
  console.log('[server] the first-run account is ready');
}

/**
 * Lets the first-run account sign in with the address the operator was given, at the app's own
 * sign-in endpoint, even though that endpoint asks for a mobile number: when the submitted
 * identifier IS `APP_INITIAL_ADMIN_EMAIL`, it is replaced with that account's own number before the
 * auth router reads the body. Every other sign-in passes through untouched.
 */
export function bootstrapAdminLoginAlias(req: Request, _res: Response, next: NextFunction): void {
  const email = bootstrapAdminEmail();
  if (email === null) {
    next();
    return;
  }

  const body: unknown = req.body;
  if (!isRecord(body)) {
    next();
    return;
  }

  let addressed = false;
  for (const key of IDENTIFIER_KEYS) {
    const value = body[key];
    if (typeof value === 'string' && value.trim().toLowerCase() === email) {
      body.mobile = bootstrapMobileFor(email);
            addressed = true;
      break;
    }
  }

  if (!addressed) {
    next();
    return;
  }

  // The first-run account is created at boot, but boot never waits on the database: when that first
  // attempt ran before the schema existed, the account is created here instead — same environment
  // credential, same password hashing — so the address the operator was given can always sign in.
  void ensureBootstrapAccount()
    .catch((error: unknown) => {
      console.error('[server] the first-run account could not be prepared', error);
    })
    .finally(() => {
      next();
    });
}
