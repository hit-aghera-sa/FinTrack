// src/features/signup/SignupPage.tsx
//
// THE BEHAVIOUR OF /signup.
//
// The form beside this file does the work: it loads the security questions from the API, reflects
// every sign-up rule inline, creates the account, stores the session and lands the traveller on
// Search. This file is the page the app shell (and the mockup preview) mounts, and it is where the
// screen's one exported name lives.
//
// `SignUpScreen` is the name the route table imports (through ./index.ts); `SignupPage` is kept as the
// default export so the preview router keeps working.
import { SignupForm } from './SignupForm';

/** The /signup screen: only its own content — the shell draws the frame around it. */
export function SignUpScreen(): JSX.Element {
  return <SignupForm />;
}

export function SignupPage(): JSX.Element {
  return <SignUpScreen />;
}

export default SignupPage;
