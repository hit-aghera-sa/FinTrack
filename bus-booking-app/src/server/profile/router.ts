import express from 'express';
import type { RequestHandler, Response, Router } from 'express';
import { userRepository } from '../../db/accounts/index.js';
import {
  hashPassword,
  hashSecurityAnswer,
  NOT_SIGNED_IN_MESSAGE,
  requireUser,
  SERVICE_UNAVAILABLE_MESSAGE,
  validatePassword,
  verifyPassword,
  type AuthedRequest,
} from '../auth/index.js';
import { createProfileService, type ProfileFailure, type ProfileService } from './service.js';
import {
  changePasswordSchema,
  changeSecurityQuestionSchema,
  INVALID_REQUEST_MESSAGE,
  updateNameSchema,
} from './validation.js';

/**
 * THE PROFILE & CREDENTIAL CHANGE ROUTER, mounted by the composition root under `/api`:
 *
 *   GET    /api/profile                   → the signed-in traveller's name, mobile and question
 *   PATCH  /api/profile                   → change the full name (2–60 characters)
 *   POST   /api/profile/password          → change the password (current password + signup rules) → 204
 *   POST   /api/profile/security-question → change the question and answer (current password)
 *
 * `requireUser` is attached PER ROUTE, never to the router as a whole, so an `/api/**` path that no
 * router matches still answers the composition root's JSON 404 rather than "signed out".
 *
 * The mobile number is the login identifier: no route accepts it, and the body schemas strip it.
 */

const service: ProfileService = createProfileService({
  users: userRepository,
  verifyPassword,
  hashPassword,
  hashSecurityAnswer,
  validatePassword,
});

/** JSON body parsing for this lane's write routes only. */
const jsonBody: RequestHandler = express.json();

interface ProfileErrorBody {
  readonly error: string;
  readonly message: string;
  readonly code: string;
}

function errorPayload(code: string, message: string): ProfileErrorBody {
  return { error: message, message, code };
}

function sendFailure(res: Response, failure: ProfileFailure): void {
  res.status(failure.status).json(errorPayload(failure.code, failure.message));
}

function sendUnauthorized(res: Response): void {
  res.status(401).json(errorPayload('unauthorized', NOT_SIGNED_IN_MESSAGE));
}

function sendBadRequest(res: Response, message: string): void {
  res.status(400).json(errorPayload('invalid_request', message));
}

/**
 * The datastore is this app's ONLY store: when it cannot be reached the request fails with 503 —
 * never a memory copy that would tell the traveller their change was saved and lose it.
 */
function sendUnavailable(res: Response, where: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[profile] ${where} failed: ${detail}`);
  res.status(503).json(errorPayload('service_unavailable', SERVICE_UNAVAILABLE_MESSAGE));
}

function signedInUserId(req: AuthedRequest): string | null {
  const user = req.user;
  return user === undefined ? null : user.id;
}

async function handleGetProfile(req: AuthedRequest, res: Response): Promise<void> {
  const userId = signedInUserId(req);
  if (userId === null) {
    sendUnauthorized(res);
    return;
  }
  try {
    const result = await service.getProfile(userId);
    if (!result.ok) {
      sendFailure(res, result);
      return;
    }
    res.status(200).json(result.value);
  } catch (error: unknown) {
    sendUnavailable(res, 'GET /api/profile', error);
  }
}

async function handleChangeName(req: AuthedRequest, res: Response): Promise<void> {
  const userId = signedInUserId(req);
  if (userId === null) {
    sendUnauthorized(res);
    return;
  }
  const body: unknown = req.body;
  const parsed = updateNameSchema.safeParse(body);
  if (!parsed.success) {
    sendBadRequest(res, INVALID_REQUEST_MESSAGE);
    return;
  }
  try {
    const result = await service.changeName(userId, parsed.data);
    if (!result.ok) {
      sendFailure(res, result);
      return;
    }
    res.status(200).json(result.value);
  } catch (error: unknown) {
    sendUnavailable(res, 'PATCH /api/profile', error);
  }
}

async function handleChangePassword(req: AuthedRequest, res: Response): Promise<void> {
  const userId = signedInUserId(req);
  if (userId === null) {
    sendUnauthorized(res);
    return;
  }
  const body: unknown = req.body;
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    sendBadRequest(res, INVALID_REQUEST_MESSAGE);
    return;
  }
  try {
    const result = await service.changePassword(userId, parsed.data);
    if (!result.ok) {
      sendFailure(res, result);
      return;
    }
    res.status(204).end();
  } catch (error: unknown) {
    sendUnavailable(res, 'POST /api/profile/password', error);
  }
}

async function handleChangeSecurityQuestion(req: AuthedRequest, res: Response): Promise<void> {
  const userId = signedInUserId(req);
  if (userId === null) {
    sendUnauthorized(res);
    return;
  }
  const body: unknown = req.body;
  const parsed = changeSecurityQuestionSchema.safeParse(body);
  if (!parsed.success) {
    sendBadRequest(res, INVALID_REQUEST_MESSAGE);
    return;
  }
  try {
    const result = await service.changeSecurityQuestion(userId, parsed.data);
    if (!result.ok) {
      sendFailure(res, result);
      return;
    }
    res.status(200).json(result.value);
  } catch (error: unknown) {
    sendUnavailable(res, 'POST /api/profile/security-question', error);
  }
}

export const profileRouter: Router = express.Router();

profileRouter.get('/profile', requireUser, (req: AuthedRequest, res: Response): void => {
  void handleGetProfile(req, res);
});

profileRouter.patch('/profile', jsonBody, requireUser, (req: AuthedRequest, res: Response): void => {
  void handleChangeName(req, res);
});

profileRouter.post(
  '/profile/password',
  jsonBody,
  requireUser,
  (req: AuthedRequest, res: Response): void => {
    void handleChangePassword(req, res);
  },
);

profileRouter.post(
  '/profile/security-question',
  jsonBody,
  requireUser,
  (req: AuthedRequest, res: Response): void => {
    void handleChangeSecurityQuestion(req, res);
  },
);
