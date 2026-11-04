/**
 * THE ACTIVE DEVICES FEATURE.
 *
 * `DeviceSessionsScreen` is what the app shell's route table mounts at `/profile/sessions`; it renders
 * only its own content, drawing its own page header exactly as the approved design does.
 */
export { DeviceSessionsScreen } from './DeviceSessionsScreen';
export { ProfileSessionsPage } from './ProfileSessionsPage';
export {
  DEVICE_SESSIONS_PATH,
  DEVICE_SESSIONS_REVOKE_ALL_PATH,
  fetchDeviceSessions,
  revokeAllDeviceSessions,
  type DeviceSession,
} from './api.js';
export { deviceLabel, errorMessage, sessionCountLabel, UNKNOWN_DEVICE_LABEL } from './presenters.js';
