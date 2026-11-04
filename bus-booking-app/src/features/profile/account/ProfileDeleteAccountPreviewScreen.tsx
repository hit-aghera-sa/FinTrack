// src/screens/ProfileDeleteAccountPreviewScreen.tsx
//
// THE APPROVED LOOK OF /profile/delete-account/preview — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function ProfileDeleteAccountPreviewScreen(): JSX.Element {
  return (
    <div data-screen="/profile/delete-account/preview">


  <div className="page-header">{' '}<div>{' '}<div className="page-eyebrow">Account</div>{' '}<h1 className="page-title">Delete account</h1>{' '}<p className="page-description">This permanently destroys your account and its data. This cannot be undone.</p>{' '}</div>{' '}<div className="page-actions">{' '}<button type="button" className="button button-ghost" data-goto="/profile">Back</button>{' '}</div>{' '}</div>{' '}<div className="notice notice-danger">{' '}<svg className="icon" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.3 3.9 2.6 17.5A1 1 0 0 0 3.5 19h17a1 1 0 0 0 .9-1.5L13.7 3.9a1 1 0 0 0-1.7 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
    Deleting your account will cancel all upcoming bookings and release their seats immediately. This action is permanent.
  </div>{' '}<div className="stat-grid">{' '}<div className="stat-card">{' '}<div className="stat-top">{' '}<span className="stat-label">Upcoming bookings</span>{' '}<div className="stat-icon">{' '}<svg className="icon" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path></svg>{' '}</div>{' '}</div>{' '}<div className="stat-value">2</div>{' '}<div className="stat-foot"><span className="stat-hint">will be cancelled</span></div>{' '}</div>{' '}<div className="stat-card">{' '}<div className="stat-top">{' '}<span className="stat-label">Past bookings</span>{' '}</div>{' '}<div className="stat-value">6</div>{' '}<div className="stat-foot"><span className="stat-hint">will be removed</span></div>{' '}</div>{' '}<div className="stat-card">{' '}<div className="stat-top">{' '}<span className="stat-label">Active sessions</span>{' '}</div>{' '}<div className="stat-value">4</div>{' '}<div className="stat-foot"><span className="stat-hint">will be signed out</span></div>{' '}</div>{' '}</div>{' '}<div className="card">{' '}<div className="card-body">{' '}<div className="form">{' '}<div className="field">{' '}<label className="field-label" htmlFor="delete-password">Current password</label>{' '}<input className="input" id="delete-password" type="password" placeholder="Enter current password to confirm" />{' '}</div>{' '}<div className="form-actions">{' '}<button type="button" className="button button-danger" data-goto="/login">Delete my account</button>{' '}<button type="button" className="button button-secondary" data-goto="/profile">Cancel</button>{' '}</div>{' '}</div>{' '}</div>{' '}</div>


    </div>
  );
}

export default ProfileDeleteAccountPreviewScreen;
