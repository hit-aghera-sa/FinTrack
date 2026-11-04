import express from 'express';
import type { Request, Response, Router } from 'express';
import { z } from 'zod';

import { userRepository } from '../../db/accounts/index.js';
import {
  hashPassword,
  respondError,
  SERVICE_UNAVAILABLE_MESSAGE,
  startSession,
  validatePassword,
  verifySecurityAnswer,
} from '../auth/index.js';
import { MESSAGES } from '../../messages/index.js';
import {
  createPasswordResetService,
  INVALID_MOBILE_MESSAGE,
  type PasswordResetService,
} from './service.js';

/**
 * THE FORGOT-PASSWORD ROUTES, mounted by the composition root under `/api`:
 *
 *   POST /api/auth/password-reset/question  { mobile }                                   -> { securityQuestionId, label }
 *   POST /api/auth/password-reset/verify    { mobile, answer, newPassword, confirmPassword } -> { user }
 *
 * The router parses its own JSON bodies (body-parser skips a body another layer already read), so this
 * lane works whatever order the server entry mounts things in.
 */

const questionBody = z.object({
  mobile: z.string().default(''),
});

const verifyBody = z.object({
  mobile: z.string().default(''),
  answer: z.string().default(''),
  newPassword: z.string().default(''),
  confirmPassword: z.string().default(''),
});

const service: PasswordResetService = createPasswordResetService({
  users: userRepository,
  verifyAnswer: verifySecurityAnswer,
  hashPassword,
  validatePassword,
});

/** The machine-readable code that goes with each refusal sentence of this lane. */
function codeFor(status: number, message: string): string {
  if (message === MESSAGES.wrongSecurityAnswer) return 'wrong_answer';
  if (message === MESSAGES.resetBlocked) return 'reset_blocked';
  if (status === 429) return 'too_many_attempts';
  return 'invalid_request';
}

/** Every refusal uses the app's shared error body: `{ error: { code, message } }`. */
function sendFailure(res: Response, status: number, message: string): void {
  respondError(res, status, codeFor(status, message), message);
}

function sendUnavailable(res: Response, context: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[password-reset] ${context} failed: ${detail}`);
  respondError(res, 503, 'service_unavailable', SERVICE_UNAVAILABLE_MESSAGE);
}

export const passwordResetRouter: Router = express.Router();

passwordResetRouter.use(express.json());

passwordResetRouter.post(
  '/auth/password-reset/question',
  async (req: Request, res: Response): Promise<void> => {
    const parsed = questionBody.safeParse(req.body);
    if (!parsed.success) {
      sendFailure(res, 400, INVALID_MOBILE_MESSAGE);
      return;
    }

    try {
      const outcome = await service.question({ mobile: parsed.data.mobile });
      if (!outcome.ok) {
        sendFailure(res, outcome.status, outcome.message);
        return;
      }
      res.status(200).json({ securityQuestionId: outcome.securityQuestionId, label: outcome.label });
    } catch (error: unknown) {
      sendUnavailable(res, 'security question lookup', error);
    }
  },
);

passwordResetRouter.post(
  '/auth/password-reset/verify',
  async (req: Request, res: Response): Promise<void> => {
    const parsed = verifyBody.safeParse(req.body);
    if (!parsed.success) {
      sendFailure(res, 400, INVALID_MOBILE_MESSAGE);
      return;
    }

    try {
      const outcome = await service.verify({
        mobile: parsed.data.mobile,
        answer: parsed.data.answer,
        newPassword: parsed.data.newPassword,
        confirmPassword: parsed.data.confirmPassword,
      });

      if (!outcome.ok) {
        sendFailure(res, outcome.status, outcome.message);
        return;
      }

      // The reset itself signs the traveller in, so they land logged in on Search.
      await startSession(req, res, outcome.user.id);
      res.status(200).json({ user: outcome.user });
    } catch (error: unknown) {
      sendUnavailable(res, 'password reset', error);
    }
  },
);
