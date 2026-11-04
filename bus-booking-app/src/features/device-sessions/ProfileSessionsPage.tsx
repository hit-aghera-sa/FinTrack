// src/features/device-sessions/ProfileSessionsPage.tsx
//
// THE BEHAVIOUR OF /profile/sessions.
//
// The real screen — the approved look plus the loading, empty and error states, the `/api` reads and
// the "Sign out everywhere" write — is `DeviceSessionsScreen` beside this file. This page is the
// address the route table mounts.
import { DeviceSessionsScreen } from './DeviceSessionsScreen';

export function ProfileSessionsPage(): JSX.Element {
  return <DeviceSessionsScreen />;
}

export default ProfileSessionsPage;
