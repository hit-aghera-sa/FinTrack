import type { NextFunction, Request, Response } from 'express';
import { toAuthUser, type AuthUser } from '../../models/accounts/index.js';
import { errorBody, NOT_SIGNED_IN_MESSAGE, SERVICE_UNAVAILABLE_MESSAGE } from './responses.js';
import { currentUser } from './session.js';

/**
 * THE GUARD every authenticated route attaches to ITSELF (`router.get('/', requireUser, handler)`) or
 * to its own `/api/<feature>` mount — never to bare `/api`, so an unknown path still answers 404
 * rather than "signed out".
 *
 * On success the signed-in traveller is placed on `req.user` as the public `AuthUser` shape (no
 * hashes, no counters), which is all a feature handler ever needs.
 */
export interface AuthedRequest extends Request {
  user?: AuthUser;
}

async function authenticate(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await currentUser(req);
    if (user === null) {
      res.status(401).json(errorBody('unauthenticated', NOT_SIGNED_IN_MESSAGE));
      return;
    }
    req.user = toAuthUser(user);
    next();
  } catch (error: unknown) {
    console.error(
      '[auth] session lookup failed:',
      error instanceof Error ? error.message : String(error),
    );
    res.status(503).json(errorBody('service_unavailable', SERVICE_UNAVAILABLE_MESSAGE));
  }
}

/** Express middleware: 401 for a signed-out caller, 503 when the datastore is unreachable. */
export function requireUser(req: AuthedRequest, res: Response, next: NextFunction): void {
  void authenticate(req, res, next);
}
