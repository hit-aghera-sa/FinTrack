/**
 * THE PROFILE IDENTITY FEATURE.
 *
 * `ProfileScreen` is what the app shell's route table mounts at `/profile`: it renders only its own
 * content (the shell draws whatever frame the route asks for) and reaches the backend through the
 * shared `/api` client — `PATCH /api/profile` to rename the traveller, and the session's own logout to
 * end it. The credential forms it composes belong to the sibling credentials lane.
 */
export { ProfileScreen, PROFILE_TEST_ID } from './ProfileScreen';
export { ProfilePage } from './ProfilePage';
export { ProfileDeleteAccountPreviewScreen } from './ProfileDeleteAccountPreviewScreen';
export { ProfileDeleteAccountPreviewPage } from './ProfileDeleteAccountPreviewPage';

export { ProfileIdentityCard } from './ProfileIdentityCard';
export type { ProfileIdentityCardProps } from './ProfileIdentityCard';
export { ProfileLogOutCard } from './ProfileLogOutCard';
export type { ProfileLogOutCardProps } from './ProfileLogOutCard';

export { useProfileIdentity } from './useProfileIdentity.js';
export type { ProfileIdentityState, ProfileStatus } from './useProfileIdentity.js';

export { PROFILE_SCREEN_PATHS } from './paths.js';
export { PROFILE_API_PATH, saveFullNameRequest } from './api.js';
export { NAME_SAVED_MESSAGE, SAVE_FAILED_MESSAGE, describeProfileError } from './presenters.js';
export {
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MIN_LENGTH,
  FULL_NAME_RULE_MESSAGE,
  normaliseFullName,
  validateFullName,
} from './validation.js';
