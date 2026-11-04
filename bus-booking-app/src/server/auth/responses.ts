import type { Response } from 'express';
import type { ApiErrorBody } from '../../models/common/index.js';

/**
 * THE ERROR SHAPE every auth route answers with: `{ error: { code, message } }`, where `message` is
 * the exact sentence a traveller reads, so the web client never has to re-word anything.
 */

/** 401 on a route that exists but needs a session. */
export const NOT_SIGNED_IN_MESSAGE = 'Please log in to continue.';

/** 503 when the datastore cannot be reached. The request fails — nothing is ever kept in memory. */
export const SERVICE_UNAVAILABLE_MESSAGE = 'The service is temporarily unavailable. Please try again.';

export function errorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export function respondError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json(errorBody(code, message));
}

/** A datastore (or other unexpected) failure: logged here, answered 503, never silently absorbed. */
export function respondUnavailable(res: Response, error: unknown): void {
  console.error('[auth] request failed:', error instanceof Error ? error.message : String(error));
  respondError(res, 503, 'service_unavailable', SERVICE_UNAVAILABLE_MESSAGE);
}
