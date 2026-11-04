// src/features/profile/account/ProfileScreen.tsx
//
// THE PROFILE SCREEN — the approved look of /profile, with the behaviour the product promises:
//
//   • the traveller's name, editable in place and persisted with PATCH /api/profile;
//   • the mobile number read-only, labelled as the login ID it is;
//   • the credential-change forms the sibling lane owns, composed into the page body;
//   • Log out, which ends the session server-side and then leaves for the sign-in page.
//
// Every class and every word of the layout is the one the client signed off; nothing here states a
// colour of its own.
import { Alert } from '../../../ui/index.js';
import { navigate } from '../../../router';
import { ChangePasswordForm, ChangeSecurityQuestionForm } from '../credentials/index.js';
import { ProfileIdentityCard } from './ProfileIdentityCard';
import { ProfileLogOutCard } from './ProfileLogOutCard';
import { PROFILE_SCREEN_PATHS } from './paths.js';
import { useProfileIdentity } from './useProfileIdentity.js';

/** The hook the acceptance suite waits for on this screen. */
export const PROFILE_TEST_ID = 'profile-screen-profile-identity-log-out-page';

export function ProfileScreen(): JSX.Element {
  const identity = useProfileIdentity();

  return (
    <div data-screen="/profile" data-testid={PROFILE_TEST_ID}>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Account</div>
          <h1 className="page-title">Profile</h1>
          <p className="page-description">Manage your name, credentials and devices.</p>
        </div>
      </div>

      {identity.error !== null ? <Alert kind="error">{identity.error}</Alert> : null}
      {identity.notice !== null ? <Alert kind="success">{identity.notice}</Alert> : null}

      <div className="page-grid">
        <div className="page-grid-column">
          <ProfileIdentityCard
            fullName={identity.fullName}
            mobile={identity.mobile}
            saving={identity.saving}
            loading={identity.status === 'loading'}
            onSave={identity.save}
          />

          <div className="card">
            <div className="card-header">
              <div className="card-heading">
                <div className="card-title">Change password</div>
              </div>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => navigate(PROFILE_SCREEN_PATHS.changePassword)}
              >
                Open
              </button>
            </div>
            <div className="card-body">
              <ChangePasswordForm />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-heading">
                <div className="card-title">Security question</div>
              </div>
            </div>
            <div className="card-body">
              <ChangeSecurityQuestionForm />
            </div>
          </div>
        </div>

        <div className="page-grid-column">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Devices</div>
            </div>
            <div className="card-body">
              <p className="text-sm text-muted">See where you are signed in.</p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => navigate(PROFILE_SCREEN_PATHS.activeDevices)}
              >
                Active devices
              </button>
            </div>
          </div>

          <ProfileLogOutCard busy={identity.loggingOut} onLogOut={identity.logOut} />
        </div>
      </div>
    </div>
  );
}

export default ProfileScreen;
