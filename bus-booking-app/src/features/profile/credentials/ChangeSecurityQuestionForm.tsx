import { useState, type FormEvent } from 'react';
import { apiFetch } from '../../../api/index.js';
import { SECURITY_QUESTIONS } from '../../../models/accounts/index.js';
import { navigate } from '../../../router';
import { Alert } from '../../../ui/index.js';
import {
  SECURITY_QUESTION_CHANGED_MESSAGE,
  hasAnyError,
  messageForError,
  validateSecurityQuestionForm,
  type SecurityQuestionFormErrors,
} from './validation.js';
import './credentials.css';

/**
 * THE CHANGE-SECURITY-QUESTION FORM of the profile screen.
 *
 * The question comes from the app's own list of security questions, the answer is typed, and the whole
 * change is guarded by re-entering the current password — the form posts nothing until all three are
 * present. `POST /api/profile/security-question` decides the rest: on success the traveller is told the
 * question has been changed and the answer and password boxes are emptied (the new question stays
 * selected, because it is now theirs); on refusal the server's own sentence is shown.
 */

const EMPTY_ERRORS: SecurityQuestionFormErrors = {
  currentPassword: null,
  securityQuestionId: null,
  securityAnswer: null,
};

export function ChangeSecurityQuestionForm(): JSX.Element {
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [securityQuestionId, setSecurityQuestionId] = useState<string>('');
  const [securityAnswer, setSecurityAnswer] = useState<string>('');
  const [errors, setErrors] = useState<SecurityQuestionFormErrors>(EMPTY_ERRORS);
  const [saving, setSaving] = useState<boolean>(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function save(): Promise<void> {
    const nextErrors = validateSecurityQuestionForm({ currentPassword, securityQuestionId, securityAnswer });
    setErrors(nextErrors);
    setFailure(null);
    setSuccess(null);
    if (hasAnyError([nextErrors.currentPassword, nextErrors.securityQuestionId, nextErrors.securityAnswer])) {
      return;
    }

    setSaving(true);
    try {
      await apiFetch<unknown>('/profile/security-question', {
        method: 'POST',
        body: { currentPassword, securityQuestionId, securityAnswer: securityAnswer.trim() },
      });
      setCurrentPassword('');
      setSecurityAnswer('');
      setErrors(EMPTY_ERRORS);
      setSuccess(SECURITY_QUESTION_CHANGED_MESSAGE);
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
      data-testid="profile-screen-profile-credential-change-forms-question-form"
    >
      {success !== null || failure !== null ? (
        <div
          className="credentials-feedback"
          data-testid="profile-screen-profile-credential-change-forms-question-feedback"
        >
          {success !== null ? <Alert kind="success">{success}</Alert> : <Alert kind="error">{failure}</Alert>}
        </div>
      ) : null}

      <div className="field">
        <label className="field-label" htmlFor="changeq-question">
          Security question
        </label>
        <select
          className="input"
          id="changeq-question"
          name="securityQuestionId"
          value={securityQuestionId}
          disabled={saving}
          aria-invalid={errors.securityQuestionId !== null ? true : undefined}
          aria-describedby={errors.securityQuestionId !== null ? 'changeq-question-error' : undefined}
          onChange={(event) => setSecurityQuestionId(event.target.value)}
        >
          <option value="">Choose a question</option>
          {SECURITY_QUESTIONS.map((question) => (
            <option key={question.id} value={question.id}>
              {question.label}
            </option>
          ))}
        </select>
        {errors.securityQuestionId !== null ? (
          <span className="credentials-field-error" id="changeq-question-error">
            {errors.securityQuestionId}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="changeq-answer">
          Security answer
        </label>
        <input
          className="input"
          id="changeq-answer"
          name="securityAnswer"
          type="text"
          maxLength={60}
          autoComplete="off"
          placeholder="Your answer"
          value={securityAnswer}
          disabled={saving}
          aria-invalid={errors.securityAnswer !== null ? true : undefined}
          aria-describedby={errors.securityAnswer !== null ? 'changeq-answer-error' : 'changeq-answer-hint'}
          onChange={(event) => setSecurityAnswer(event.target.value)}
        />
        <span className="field-hint" id="changeq-answer-hint">
          Capitals do not matter when you answer it later.
        </span>
        {errors.securityAnswer !== null ? (
          <span className="credentials-field-error" id="changeq-answer-error">
            {errors.securityAnswer}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="changeq-current">
          Current password
        </label>
        <input
          className="input"
          id="changeq-current"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          placeholder="Enter current password"
          value={currentPassword}
          disabled={saving}
          aria-invalid={errors.currentPassword !== null ? true : undefined}
          aria-describedby={errors.currentPassword !== null ? 'changeq-current-error' : undefined}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        {errors.currentPassword !== null ? (
          <span className="credentials-field-error" id="changeq-current-error">
            {errors.currentPassword}
          </span>
        ) : null}
      </div>

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? 'Saving question' : 'Save security question'}
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

export default ChangeSecurityQuestionForm;
