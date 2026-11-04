import { useState, type FormEvent } from 'react';
import { apiFetch } from '../../../api/index.js';
import { MESSAGES } from '../../../messages/index.js';
import { navigate } from '../../../router';
import { Alert } from '../../../ui/index.js';
import {
  PASSWORD_HINT,
  hasAnyError,
  messageForError,
  validatePasswordForm,
  type PasswordFormErrors,
} from './validation.js';
import './credentials.css';

/**
 * THE CHANGE-PASSWORD FORM of the profile screen.
 *
 * Current password, new password and confirm new password. An obvious mistake is reported without a
 * round trip (an empty field, two different new passwords, a password that cannot satisfy the rule);
 * anything else is decided by `POST /api/profile/password`, whose refusal sentence is shown as the
 * server wrote it. A success shows the catalogue's password-changed line and empties all three fields,
 * so the form is ready to be used again and no password is left sitting in the page.
 */

const EMPTY_ERRORS: PasswordFormErrors = {
  currentPassword: null,
  newPassword: null,
  confirmPassword: null,
};

export function ChangePasswordForm(): JSX.Element {
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errors, setErrors] = useState<PasswordFormErrors>(EMPTY_ERRORS);
  const [saving, setSaving] = useState<boolean>(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function save(): Promise<void> {
    const nextErrors = validatePasswordForm({ currentPassword, newPassword, confirmPassword });
    setErrors(nextErrors);
    setFailure(null);
    setSuccess(null);
    if (hasAnyError([nextErrors.currentPassword, nextErrors.newPassword, nextErrors.confirmPassword])) return;

    setSaving(true);
    try {
      await apiFetch<void>('/profile/password', {
        method: 'POST',
        body: { currentPassword, newPassword, confirmPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors(EMPTY_ERRORS);
      setSuccess(MESSAGES.passwordChanged);
    } catch (error: unknown) {
      setFailure(messageForError(error));
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void save();
  }

  return (
    <form
      className="form"
      onSubmit={handleSubmit}
      noValidate
      data-testid="profile-screen-profile-credential-change-forms-password-form"
    >
      {success !== null || failure !== null ? (
        <div
          className="credentials-feedback"
          data-testid="profile-screen-profile-credential-change-forms-password-feedback"
        >
          {success !== null ? <Alert kind="success">{success}</Alert> : <Alert kind="error">{failure}</Alert>}
        </div>
      ) : null}

      <div className="field">
        <label className="field-label" htmlFor="changepw-current">
          Current password
        </label>
        <input
          className="input"
          id="changepw-current"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          placeholder="Enter current password"
          value={currentPassword}
          disabled={saving}
          aria-invalid={errors.currentPassword !== null ? true : undefined}
          aria-describedby={errors.currentPassword !== null ? 'changepw-current-error' : undefined}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        {errors.currentPassword !== null ? (
          <span className="credentials-field-error" id="changepw-current-error">
            {errors.currentPassword}
          </span>
        ) : null}
      </div>

      <div className="form-row">
        <div className="field">
          <label className="field-label" htmlFor="changepw-new">
            New password
          </label>
          <input
            className="input"
            id="changepw-new"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={newPassword}
            disabled={saving}
            aria-invalid={errors.newPassword !== null ? true : undefined}
            aria-describedby={errors.newPassword !== null ? 'changepw-new-error' : 'changepw-new-hint'}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <span className="field-hint" id="changepw-new-hint">
            {PASSWORD_HINT}
          </span>
          {errors.newPassword !== null ? (
            <span className="credentials-field-error" id="changepw-new-error">
              {errors.newPassword}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="changepw-confirm">
            Confirm new password
          </label>
          <input
            className="input"
            id="changepw-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            disabled={saving}
            aria-invalid={errors.confirmPassword !== null ? true : undefined}
            aria-describedby={errors.confirmPassword !== null ? 'changepw-confirm-error' : undefined}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {errors.confirmPassword !== null ? (
            <span className="credentials-field-error" id="changepw-confirm-error">
              {errors.confirmPassword}
            </span>
          ) : null}
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? 'Saving password' : 'Save password'}
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={saving}
          onClick={() => navigate('/profile')}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default ChangePasswordForm;
