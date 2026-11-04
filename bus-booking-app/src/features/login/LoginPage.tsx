// src/features/login/LoginPage.tsx
//
// THE PAGE AT /login. The approved look lives in LoginScreen beside it; everything that happens —
// the real API call, the messages, the redirect to /search — lives in LogInScreen, which this page
// mounts. Keeping the page a one-liner means the mockup entry and the app's own route table draw the
// same working screen.
import { LogInScreen } from './LogInScreen';

export function LoginPage(): JSX.Element {
  return <LogInScreen />;
}

export default LoginPage;
