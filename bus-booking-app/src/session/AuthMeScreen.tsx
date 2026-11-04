// src/session/AuthMeScreen.tsx
//
// THE APPROVED LOOK OF /auth/me — every class, word and element is the one the client signed off. The
// only change is that the values are now props: the container beside it reads the real session and
// hands the account over, so nothing on this screen is sample data.
export interface AuthMeScreenProps {
  readonly fullName: string;
  readonly mobile: string;
  readonly securityQuestion: string;
  readonly sessionNote: string;
  readonly onGoToProfile: () => void;
}

export function AuthMeScreen({
  fullName,
  mobile,
  securityQuestion,
  sessionNote,
  onGoToProfile,
}: AuthMeScreenProps): JSX.Element {
  return (
    <div data-screen="/auth/me">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Session</div>
          <h1 className="page-title">Session</h1>
          <p className="page-description">
            Current signed-in session information restored from the server-backed cookie.
          </p>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Account</div>
        </div>
        <div className="card-body">
          <dl className="detail-list">
            <div>
              <dt>Full name</dt>
              <dd>{fullName}</dd>
            </div>
            <div>
              <dt>Mobile number</dt>
              <dd>{mobile}</dd>
            </div>
            <div>
              <dt>Security question</dt>
              <dd>{securityQuestion}</dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd>{sessionNote}</dd>
            </div>
          </dl>
        </div>
        <div className="card-footer">
          <button type="button" className="button button-secondary" onClick={onGoToProfile}>
            Go to Profile
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuthMeScreen;
