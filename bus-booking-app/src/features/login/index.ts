/**
 * THE LOG IN FEATURE.
 *
 * `LogInScreen` is what the app shell's route table mounts at `/login` (public, drawn in the panel
 * frame). It renders only its own content — the shell draws any chrome around it — and sends a
 * traveller who is already signed in straight to `/search`.
 *
 * The approved look lives in ONE file, `LoginForm.tsx`, and is still exported under its signed-off
 * name, `LoginScreen`; only the file it sits in changed, because a file name differing from the
 * container's (`LogInScreen.tsx`) only in casing cannot be compiled, so the superseded
 * `LoginScreen.tsx` copy of that markup has been removed.
 */
export { LogInScreen } from './LogInScreen';
export { LoginPage } from './LoginPage';
export { LoginScreen } from './LoginForm';
export type { LoginScreenProps } from './LoginForm';
export {
  MOBILE_DIGITS,
  classifyLoginFailure,
  isAttemptBlocked,
  isLockedFailure,
  missingCredentials,
  normaliseMobileInput,
} from './login-logic.js';
export type { LoginFailure, LoginFailureKind } from './login-logic.js';
