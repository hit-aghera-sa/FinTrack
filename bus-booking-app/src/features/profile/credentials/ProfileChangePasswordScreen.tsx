// src/features/profile/credentials/ProfileChangePasswordScreen.tsx
//
// THE APPROVED LOOK OF /profile/change-password, now carrying the lane's two live credential forms.
// Every class, heading and label of the password card is the client's own; the only addition the
// preview did not have is the second card below it, which gives the approved change-security-question
// form a home (it is reported with this build rather than rearranging what was signed off).
import { navigate } from '../../../router';
import { ChangePasswordForm } from './ChangePasswordForm';
import { ChangeSecurityQuestionForm } from './ChangeSecurityQuestionForm';
import './credentials.css';

export function ProfileChangePasswordScreen(): JSX.Element {
  return (
    <div
      data-screen="/profile/change-password"
      data-testid="profile-screen-profile-credential-change-forms-page"
    >
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Account</div>
          <h1 className="page-title">Change password</h1>
          <p className="page-description">Enter your current password and choose a new one.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="button button-ghost" onClick={() => navigate('/profile')}>
            Back
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <ChangePasswordForm />
        </div>
      </div>

      <div className="card credentials-card-gap">
        <div className="card-body">
          <h2 className="credentials-section-title">Change security question</h2>
          <p className="credentials-section-note">
            Pick the question you will be asked if you ever forget your password, and confirm the change
            with your current password.
          </p>
          <ChangeSecurityQuestionForm />
        </div>
      </div>
    </div>
  );
}

export default ProfileChangePasswordScreen;
