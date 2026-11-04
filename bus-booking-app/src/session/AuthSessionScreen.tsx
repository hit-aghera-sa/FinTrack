// src/session/AuthSessionScreen.tsx
//
// THE APPROVED LOOK OF /auth/session — every class, word and element is the one the client signed off.
// The only change is that the values and the two footer actions are now props, so the container beside
// it can show the real signed-in traveller, the real browser, and really log out.
import type { ReactNode } from 'react';

export interface AuthSessionScreenProps {
  readonly fullName: string;
  readonly mobile: string;
  readonly device: string;
  readonly sessionNote: string;
  readonly busy: boolean;
  readonly onViewDevices: () => void;
  readonly onLogOut: () => void;
  /** An error message shown above the card when logging out failed. */
  readonly banner?: ReactNode;
}

export function AuthSessionScreen({
  fullName,
  mobile,
  device,
  sessionNote,
  busy,
  onViewDevices,
  onLogOut,
  banner,
}: AuthSessionScreenProps): JSX.Element {
  return (
    <div data-screen="/auth/session">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Session</div>
          <h1 className="page-title">Session</h1>
          <p className="page-description">
            Your session persists across browser restarts until you log out, revoke sessions, or delete your account.
          </p>
        </div>
      </div>
      {banner === undefined ? null : banner}
      <div className="notice notice-success">
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6 9 17l-5-5"></path>
        </svg>
        You are signed in as {fullName} ({mobile}).
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">This device</div>
        </div>
        <div className="card-body">
          <dl className="detail-list">
            <div>
              <dt>Device</dt>
              <dd>{device}</dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd>{sessionNote}</dd>
            </div>
          </dl>
        </div>
        <div className="card-footer">
          <button type="button" className="button button-secondary" onClick={onViewDevices} disabled={busy}>
            View all devices
          </button>
          <button type="button" className="button button-danger" onClick={onLogOut} disabled={busy}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuthSessionScreen;
