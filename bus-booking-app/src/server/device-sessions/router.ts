import { Router, type Response } from 'express';
import { sessionRepository } from '../../db/accounts/index.js';
import { NOT_SIGNED_IN_MESSAGE, requireUser, SESSION_COOKIE_NAME, type AuthedRequest } from '../auth/index.js';
import { readSessionTokenFromCookies } from './session-token.js';

/**
 * ACTIVE DEVICES & SIGN OUT EVERYWHERE — this feature's own small router.
 *
 *   GET  /profile/sessions            → the account's signed-in sessions, newest first
 *   POST /profile/sessions/revoke-all → revokes every session row of the account, 204
 *
 * Mounted by the composition root under `/api`, so the client calls `/api/profile/sessions`. Both
 * routes sit behind `requireUser`, so a signed-out caller gets 401 and no row of another traveller is
 * ever reachable: the listing is always scoped to the authenticated account.
 */

export const DEVICE_SESSIONS_ROUTE = '/profile/sessions';
export const DEVICE_SESSIONS_REVOKE_ALL_ROUTE = '/profile/sessions/revoke-all';

const UNAVAILABLE_CODE = 'service_unavailable';
const UNAVAILABLE_MESSAGE = 'Something went wrong. Please try again.';
const NOT_SIGNED_IN_CODE = 'not_signed_in';

/** What this endpoint states about one session. No token and no raw identifier of any other kind. */
export interface DeviceSessionBody {
  readonly id: string;
  readonly userAgent: string | null;
  readonly createdAt: string;
  readonly current: boolean;
}

/**
 * The session listing seam, declared here as a call signature rather than called straight off the
 * repository: the shipped repository takes an optional `currentToken` so it can mark the caller's own
 * row, while the pinned `SessionRepository` contract spells the method with `userId` alone. A function
 * of fewer parameters is assignable to this type, so binding the method satisfies either declaration
 * and the "This device" marker keeps working.
 */
type ListActiveSessions = (userId: string, currentToken?: string | null) => Promise<readonly DeviceSessionBody[]>;

const listActiveSessions: ListActiveSessions = sessionRepository.listActiveByUser.bind(sessionRepository);

function respondNotSignedIn(res: Response): void {
  res.status(401).json({ error: { code: NOT_SIGNED_IN_CODE, message: NOT_SIGNED_IN_MESSAGE } });
}

function respondUnavailable(res: Response): void {
  res.status(503).json({ error: { code: UNAVAILABLE_CODE, message: UNAVAILABLE_MESSAGE } });
}

/** The deleting form of the session cookie: same name and path, no lifetime. */
function clearedSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

async function handleList(req: AuthedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (user === undefined) {
    respondNotSignedIn(res);
    return;
  }

  const token = readSessionTokenFromCookies(req.headers.cookie, SESSION_COOKIE_NAME);

  try {
    const rows = await listActiveSessions(user.id, token);
    const body: DeviceSessionBody[] = rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
      current: row.current,
    }));
    res.status(200).json(body);
  } catch {
    respondUnavailable(res);
  }
}

async function handleRevokeAll(req: AuthedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (user === undefined) {
    respondNotSignedIn(res);
    return;
  }

  try {
    await sessionRepository.deleteAllForUser(user.id);
    // Every row is gone, so the caller's own cookie is already dead; clearing it keeps the browser tidy.
    res.setHeader('set-cookie', clearedSessionCookieHeader());
    res.status(204).end();
  } catch {
    respondUnavailable(res);
  }
}

export const deviceSessionsRouter: Router = Router();

deviceSessionsRouter.get(DEVICE_SESSIONS_ROUTE, requireUser, handleList);
deviceSessionsRouter.post(DEVICE_SESSIONS_REVOKE_ALL_ROUTE, requireUser, handleRevokeAll);
