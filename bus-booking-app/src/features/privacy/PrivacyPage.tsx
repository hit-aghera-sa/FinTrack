// src/features/privacy/PrivacyPage.tsx
//
// THE BEHAVIOUR OF /privacy.
//
// There is nothing to fetch: the privacy policy is static content served by the website itself and is
// reachable with no account. So this container has no loading, empty or error state to decide between —
// it simply renders the policy screen, which carries the page's test hook.
import { PrivacyPolicyScreen } from './PrivacyPolicyScreen';

export function PrivacyPage(): JSX.Element {
  return <PrivacyPolicyScreen />;
}

export default PrivacyPage;
