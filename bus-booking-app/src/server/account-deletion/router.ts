import express from 'express';
import type { Response, Router } from 'express';
import { sessionRepository, userRepository } from '../../db/accounts/index.js';
import { bookingRepository, prismaBookingSqlRunner } from '../../db/bookings/index.js';
import type { ApiErrorBody } from '../../models/common/index.js';
import {
  NOT_SIGNED_IN_MESSAGE,
  SERVICE_UNAVAILABLE_MESSAGE,
  SESSION_COOKIE_NAME,
  requireUser,
  verifyPassword,
  type AuthedRequest,
} from '../auth/index.js';
import { createAccountDeletionService, type AccountDeletionService } from './service.js';
import { createSqlAccountDeletionStore } from './sql-store.js';
import type { AccountDeletionFailureCode } from './types.js';

/**
 * THE ACCOUNT DELETION ROUTES, mounted under `/api` by the composition root:
 *
 *   app.use('/api', accountDeletionRouter);
 *
 *   GET  /api/profile/delete-account/preview -> { upcomingBookings, pastBookings, activeSessions }
 *   POST /api/profile/delete-account         -> 204, session cookie cleared, account gone
 *
 * The guard is attached PER ROUTE, never to the router's own root, so an `/api` path no router owns
 * still answers 404 rather than "signed out".
 */
export const ACCOUNT_DELETION_PREVIEW_ROUTE = '/profile/delete-account/preview';
export const ACCOUNT_DELETION_ROUTE = '/profile/delete-account';

const FAILURE_STATUS: Record<AccountDeletionFailureCode, number> = {
  invalid_request: 400,
  wrong_password: 400,
  not_found: 401,
};

function respondError(res: Response, status: number, code: string, message: string): void {
  const body: ApiErrorBody = { error: { code, message } };
  res.status(status).json(body);
}

function respondUnreachable(res: Response, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[account-deletion] ${detail}`);
  respondError(res, 503, 'service_unavailable', SERVICE_UNAVAILABLE_MESSAGE);
}

async function handlePreview(service: AccountDeletionService, req: AuthedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (user === undefined) {
    respondError(res, 401, 'unauthorized', NOT_SIGNED_IN_MESSAGE);
    return;
  }
  try {
    const preview = await service.preview(user.id);
    if (preview === null) {
      respondError(res, 401, 'unauthorized', NOT_SIGNED_IN_MESSAGE);
      return;
    }
    res.status(200).json(preview);
  } catch (error: unknown) {
    respondUnreachable(res, error);
  }
}

async function handleDelete(service: AccountDeletionService, req: AuthedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (user === undefined) {
    respondError(res, 401, 'unauthorized', NOT_SIGNED_IN_MESSAGE);
    return;
  }
  try {
    const result = await service.deleteAccount({ userId: user.id, body: req.body });
    if (!result.ok) {
      respondError(res, FAILURE_STATUS[result.code], result.code, result.message);
      return;
    }
    // The account and every session row are gone; clear the cookie so the caller lands signed out.
    res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, sameSite: 'lax', path: '/' });
    res.status(204).end();
  } catch (error: unknown) {
    respondUnreachable(res, error);
  }
}

export function createAccountDeletionRouter(service: AccountDeletionService): Router {
  const router = express.Router();
  // Harmless when the app already parses JSON bodies: the parser skips a body it has read.
  router.use(express.json());

  router.get(ACCOUNT_DELETION_PREVIEW_ROUTE, requireUser, (req: AuthedRequest, res: Response): void => {
    void handlePreview(service, req, res);
  });

  router.post(ACCOUNT_DELETION_ROUTE, requireUser, (req: AuthedRequest, res: Response): void => {
    void handleDelete(service, req, res);
  });

  return router;
}

/**
 * The router the app runs: the real identity and booking repositories, the app's own password
 * verification, and the deletion transaction over the app's own PostgreSQL.
 */
export const accountDeletionRouter: Router = createAccountDeletionRouter(
  createAccountDeletionService({
    users: userRepository,
    bookings: bookingRepository,
    sessions: sessionRepository,
    store: createSqlAccountDeletionStore(prismaBookingSqlRunner),
    verifyPassword,
  }),
);
