import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Spinner } from '../../../ui/index.js';
import { FULL_NAME_MAX_LENGTH, normaliseFullName, validateFullName } from './validation.js';

export interface ProfileIdentityCardProps {
  /** The saved name, which the editable field starts from. */
  fullName: string;
  /** The login ID, shown read-only. */
  mobile: string;
  /** True while the save is in flight. */
  saving: boolean;
  /** True while the app is still finding out who is signed in. */
  loading: boolean;
  /** Called with the normalised name once it passes the name rule. */
  onSave: (fullName: string) => void;
}

/**
 * PERSONAL DETAILS — the traveller's editable name beside the mobile number they log in with.
 *
 * Presentation and the name rule only: the card is handed a name and a callback, so it can be read and
 * tested without a session, an API or a router.
 */
export function ProfileIdentityCard({
  fullName,
  mobile,
  saving,
  loading,
  onSave,
}: ProfileIdentityCardProps): JSX.Element {
  const [draft, setDraft] = useState(fullName);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(fullName);
  }, [fullName]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = normaliseFullName(draft);
    const problem = validateFullName(value);
    if (problem !== null) {
      setFieldError(problem);
      return;
    }
    setFieldError(null);
    onSave(value);
  };

  return (
    <div className="card" data-testid="profile-screen-profile-identity-log-out-identity">
      <div className="card-header">
        <div className="card-heading">
          <div className="card-icon">
            <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              ></path>
            </svg>
          </div>
          <div>
            <div className="card-title">Personal details</div>
            <div className="card-description">Your name is shown on tickets and bookings.</div>
          </div>
        </div>
      </div>
      <div className="card-body">
        <form
          className="form"
          onSubmit={handleSubmit}
          noValidate
          data-testid="profile-screen-profile-identity-log-out-form"
        >
          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="profile-name">
                Full name
              </label>
              <input
                className="input"
                id="profile-name"
                name="fullName"
                type="text"
                value={draft}
                maxLength={FULL_NAME_MAX_LENGTH}
                disabled={saving || loading}
                aria-invalid={fieldError !== null ? 'true' : undefined}
                aria-describedby={fieldError !== null ? 'profile-name-error' : undefined}
                onChange={(event) => setDraft(event.target.value)}
                data-testid="profile-screen-profile-identity-log-out-name-input"
              />
              {fieldError !== null ? (
                <span className="field-hint" id="profile-name-error" role="alert">
                  {fieldError}
                </span>
              ) : null}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="profile-mobile">
                Mobile number
              </label>
              <input
                className="input"
                id="profile-mobile"
                name="mobile"
                type="tel"
                value={mobile}
                readOnly
                disabled
                data-testid="profile-screen-profile-identity-log-out-mobile"
              />
              <span className="field-hint">Mobile number is your login ID and cannot be changed.</span>
            </div>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="button button-primary"
              disabled={saving || loading}
              data-testid="profile-screen-profile-identity-log-out-save"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {loading ? <Spinner label="Loading your profile" /> : null}
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProfileIdentityCard;
