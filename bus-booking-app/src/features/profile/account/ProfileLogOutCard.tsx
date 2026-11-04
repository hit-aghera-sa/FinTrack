import { navigate } from '../../../router';
import { PROFILE_SCREEN_PATHS } from './paths.js';

export interface ProfileLogOutCardProps {
  /** True while the session is being ended. */
  busy: boolean;
  /** Ends the session and leaves for the sign-in page. */
  onLogOut: () => void;
}

/**
 * THE END OF A SESSION — the Log out button, with the permanent account deletion beside it.
 *
 * The card takes the action as a callback, so logging out can be exercised without a session or a
 * server.
 */
export function ProfileLogOutCard({ busy, onLogOut }: ProfileLogOutCardProps): JSX.Element {
  return (
    <div className="card" data-testid="profile-screen-profile-identity-log-out-session">
      <div className="card-header">
        <div className="card-title">Danger zone</div>
      </div>
      <div className="card-body">
        <p className="text-sm text-muted">Permanently delete your account and bookings.</p>
        <button
          type="button"
          className="button button-danger"
          onClick={() => navigate(PROFILE_SCREEN_PATHS.deleteAccount)}
          data-testid="profile-screen-profile-identity-log-out-delete-account"
        >
          Delete account
        </button>
      </div>
      <div className="card-footer">
        <button
          type="button"
          className="button button-ghost"
          disabled={busy}
          onClick={onLogOut}
          data-testid="profile-screen-profile-identity-log-out-signout"
        >
          {busy ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </div>
  );
}

export default ProfileLogOutCard;
