import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../../messages/index.js';
import { ApiError, UNEXPECTED_MESSAGE, offlineError } from '../../../api/index.js';
import { SECURITY_QUESTIONS } from '../../../models/accounts/index.js';
import {
  CURRENT_PASSWORD_REQUIRED_MESSAGE,
  PASSWORD_RULE_MESSAGE,
  SECURITY_ANSWER_REQUIRED_MESSAGE,
  SECURITY_QUESTION_REQUIRED_MESSAGE,
  hasAnyError,
  messageForError,
  validateNewPassword,
  validatePasswordForm,
  validateSecurityQuestionForm,
} from './validation.js';

describe('validateNewPassword', () => {
  it('refuses a password that is too short', () => {
    expect(validateNewPassword('Tra1')).toBe(PASSWORD_RULE_MESSAGE);
  });

  it('refuses a password with no digit', () => {
    expect(validateNewPassword('TravelTravel')).toBe(PASSWORD_RULE_MESSAGE);
  });

  it('refuses a password with no letter', () => {
    expect(validateNewPassword('12345678')).toBe(PASSWORD_RULE_MESSAGE);
  });

  it('accepts a long password with a letter and a digit', () => {
    expect(validateNewPassword('Travel1234')).toBeNull();
  });
});

describe('validatePasswordForm', () => {
  it('asks for the current password when it is empty', () => {
    const errors = validatePasswordForm({
      currentPassword: '',
      newPassword: 'Travel1234',
      confirmPassword: 'Travel1234',
    });
    expect(errors.currentPassword).toBe(CURRENT_PASSWORD_REQUIRED_MESSAGE);
    expect(errors.newPassword).toBeNull();
    expect(errors.confirmPassword).toBeNull();
  });

  it('reports the catalogue mismatch sentence when the two new passwords differ', () => {
    const errors = validatePasswordForm({
      currentPassword: 'Travel@123',
      newPassword: 'Travel1234',
      confirmPassword: 'Travel9999',
    });
    expect(errors.confirmPassword).toBe(MESSAGES.passwordMismatch);
  });

  it('reports no problem for a complete, matching, strong change', () => {
    const errors = validatePasswordForm({
      currentPassword: 'Travel@123',
      newPassword: 'Travel1234',
      confirmPassword: 'Travel1234',
    });
    expect(hasAnyError([errors.currentPassword, errors.newPassword, errors.confirmPassword])).toBe(false);
  });
});

describe('validateSecurityQuestionForm', () => {
  it('asks for the question, the answer and the current password when nothing is filled in', () => {
    const errors = validateSecurityQuestionForm({
      currentPassword: '',
      securityQuestionId: '',
      securityAnswer: '   ',
    });
    expect(errors.currentPassword).toBe(CURRENT_PASSWORD_REQUIRED_MESSAGE);
    expect(errors.securityQuestionId).toBe(SECURITY_QUESTION_REQUIRED_MESSAGE);
    expect(errors.securityAnswer).toBe(SECURITY_ANSWER_REQUIRED_MESSAGE);
  });

  it('accepts one of the app\u2019s own security questions with an answer and the password', () => {
    const errors = validateSecurityQuestionForm({
      currentPassword: 'Travel@123',
      securityQuestionId: SECURITY_QUESTIONS[0].id,
      securityAnswer: 'Meera',
    });
    expect(hasAnyError([errors.currentPassword, errors.securityQuestionId, errors.securityAnswer])).toBe(false);
  });
});

describe('messageForError', () => {
  it('shows the no-internet sentence when the backend was never reached', () => {
    expect(messageForError(offlineError())).toBe(MESSAGES.offline);
  });

  it('shows the server\u2019s own refusal sentence', () => {
    const refusal = new ApiError(400, 'invalid_credentials', MESSAGES.currentPasswordIncorrect);
    expect(messageForError(refusal)).toBe(MESSAGES.currentPasswordIncorrect);
  });

  it('falls back to the client\u2019s unexpected-response sentence for anything else', () => {
    expect(messageForError(new Error('boom'))).toBe(UNEXPECTED_MESSAGE);
  });
});
