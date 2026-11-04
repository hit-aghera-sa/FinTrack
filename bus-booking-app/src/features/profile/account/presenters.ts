import { ApiError, isOfflineError } from '../../../api/index.js';
import { MESSAGES } from '../../../messages/index.js';

/** What a traveller reads after the name was saved. */
export const NAME_SAVED_MESSAGE = 'Your name has been updated.';

/** The fallback when a failure carries no sentence of its own. */
export const SAVE_FAILED_MESSAGE = 'Something went wrong. Please try again.';

/**
 * One failure, one sentence: the catalogue's no-internet line when the backend could not be reached,
 * the server's own message when it refused the change, and a neutral sentence for anything else.
 */
export function describeProfileError(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (error instanceof ApiError) return error.message.trim() === '' ? SAVE_FAILED_MESSAGE : error.message;
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return SAVE_FAILED_MESSAGE;
}
