import { apiFetch } from '../../../api/index.js';
import type { AuthUser } from '../../../models/accounts/index.js';

/**
 * THE PROFILE SCREEN'S ONE WRITE: renaming the signed-in traveller.
 *
 * `PATCH /api/profile { fullName }` answers with the updated account, so the session the whole app
 * reads is refreshed from the server's own view of it and the new name survives a page reload.
 */

/** The profile endpoint, relative to the app's `/api` surface. */
export const PROFILE_API_PATH = '/profile';

/** Persist the traveller's name. Rejects with an `ApiError` the screen turns into a sentence. */
export function saveFullNameRequest(fullName: string): Promise<AuthUser> {
  return apiFetch<AuthUser>(PROFILE_API_PATH, { method: 'PATCH', body: { fullName } });
}
