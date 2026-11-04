import { describe, expect, it } from 'vitest';
import { ApiError, UNEXPECTED_MESSAGE } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';
import {
  FULL_NAME_ERROR,
  MOBILE_ERROR,
  PASSWORD_ERROR,
  SECURITY_ANSWER_ERROR,
  SECURITY_QUESTION_ERROR,
  SIGN_UP_PATHS,
  digitsOnly,
  hasErrors,
  isDuplicateMobileError,
  parseSecurityQuestions,
  signUpErrorMessage,
  validateConfirmPassword,
  validateFullName,
  validateMobile,
  validatePasswordRule,
  validateSecurityAnswer,
  validateSecurityQuestion,
  validateSignUpForm,
  type SignUpFormValues,
} from './validation.js';

const QUESTION_IDS: readonly string[] = ['mothers-first-name', 'favourite-food'];

function validValues(): SignUpFormValues {
  return {
    fullName: 'Aisha Kapoor',
    mobile: '9876543210',
    password: 'Travel123',
    confirmPassword: 'Travel123',
    securityQuestionId: 'mothers-first-name',
    securityAnswer: 'Meera',
  };
}

describe('sign up endpoints', () => {
  it('addresses the two real auth endpoints', () => {
    expect(SIGN_UP_PATHS.questions).toBe('/auth/security-questions');
    expect(SIGN_UP_PATHS.signup).toBe('/auth/signup');
  });
});

describe('validateFullName', () => {
  it('accepts a name of 2 to 60 characters', () => {
    expect(validateFullName('Aisha Kapoor')).toBeNull();
    expect(validateFullName('  Jo  ')).toBeNull();
  });

  it('refuses an empty, one-character or over-long name', () => {
    expect(validateFullName('')).toBe(FULL_NAME_ERROR);
    expect(validateFullName('A')).toBe(FULL_NAME_ERROR);
    expect(validateFullName('q'.repeat(61))).toBe(FULL_NAME_ERROR);
  });
});

describe('validateMobile', () => {
  it('accepts ten digits beginning 6, 7, 8 or 9', () => {
    expect(validateMobile('9876543210')).toBeNull();
    expect(validateMobile('6000000000')).toBeNull();
  });

  it('refuses a short number or one with a wrong first digit', () => {
    expect(validateMobile('98765')).toBe(MOBILE_ERROR);
    expect(validateMobile('1234567890')).toBe(MOBILE_ERROR);
    expect(validateMobile('98765432100')).toBe(MOBILE_ERROR);
    expect(validateMobile('')).toBe(MOBILE_ERROR);
  });
});

describe('validatePasswordRule', () => {
  it('accepts eight or more characters with a letter and a digit', () => {
    expect(validatePasswordRule('Travel123')).toBeNull();
  });

  it('refuses a short password, letters only or digits only', () => {
    expect(validatePasswordRule('ab12')).toBe(PASSWORD_ERROR);
    expect(validatePasswordRule('alllettersnow')).toBe(PASSWORD_ERROR);
    expect(validatePasswordRule('12345678')).toBe(PASSWORD_ERROR);
  });
});

describe('validateConfirmPassword', () => {
  it('accepts two identical passwords', () => {
    expect(validateConfirmPassword('Travel123', 'Travel123')).toBeNull();
  });

  it('reports the catalogue mismatch sentence when they differ', () => {
    expect(validateConfirmPassword('Travel123', 'Travel124')).toBe(MESSAGES.passwordMismatch);
    expect(validateConfirmPassword('Travel123', '')).toBe(MESSAGES.passwordMismatch);
  });
});

describe('validateSecurityQuestion', () => {
  it('accepts a question that is offered', () => {
    expect(validateSecurityQuestion('favourite-food', QUESTION_IDS)).toBeNull();
  });

  it('refuses nothing chosen or a question that is not offered', () => {
    expect(validateSecurityQuestion('', QUESTION_IDS)).toBe(SECURITY_QUESTION_ERROR);
    expect(validateSecurityQuestion('pet-name', QUESTION_IDS)).toBe(SECURITY_QUESTION_ERROR);
  });

  it('only checks for emptiness while the list is still loading', () => {
    expect(validateSecurityQuestion('pet-name', [])).toBeNull();
    expect(validateSecurityQuestion('', [])).toBe(SECURITY_QUESTION_ERROR);
  });
});

describe('validateSecurityAnswer', () => {
  it('accepts an answer of 2 to 50 characters', () => {
    expect(validateSecurityAnswer('Meera')).toBeNull();
  });

  it('refuses an answer that is too short or too long', () => {
    expect(validateSecurityAnswer('M')).toBe(SECURITY_ANSWER_ERROR);
    expect(validateSecurityAnswer('a'.repeat(51))).toBe(SECURITY_ANSWER_ERROR);
  });
});

describe('validateSignUpForm', () => {
  it('finds nothing wrong with a complete, valid form', () => {
    const errors = validateSignUpForm(validValues(), QUESTION_IDS);
    expect(hasErrors(errors)).toBe(false);
    expect(errors).toEqual({});
  });

  it('collects one sentence per failing field', () => {
    const errors = validateSignUpForm(
      {
        fullName: 'A',
        mobile: '12345',
        password: 'short',
        confirmPassword: 'other',
        securityQuestionId: '',
        securityAnswer: '',
      },
      QUESTION_IDS,
    );

    expect(hasErrors(errors)).toBe(true);
    expect(errors.fullName).toBe(FULL_NAME_ERROR);
    expect(errors.mobile).toBe(MOBILE_ERROR);
    expect(errors.password).toBe(PASSWORD_ERROR);
    expect(errors.confirmPassword).toBe(MESSAGES.passwordMismatch);
    expect(errors.securityQuestionId).toBe(SECURITY_QUESTION_ERROR);
    expect(errors.securityAnswer).toBe(SECURITY_ANSWER_ERROR);
  });

  it('reports only the mismatch when the two passwords differ', () => {
    const errors = validateSignUpForm(
      { ...validValues(), confirmPassword: 'Travel124' },
      QUESTION_IDS,
    );
    expect(errors).toEqual({ confirmPassword: MESSAGES.passwordMismatch });
  });
});

describe('digitsOnly', () => {
  it('keeps digits and drops everything else', () => {
    expect(digitsOnly('+91 98765-43210')).toBe('919876543210');
    expect(digitsOnly('abc')).toBe('');
  });
});

describe('parseSecurityQuestions', () => {
  it('reads a bare array of id and label', () => {
    expect(
      parseSecurityQuestions([
        { id: 'mothers-first-name', label: "What is your mother's first name?" },
        { id: 'favourite-food', label: 'What is your favourite food?' },
      ]),
    ).toEqual([
      { value: 'mothers-first-name', label: "What is your mother's first name?" },
      { value: 'favourite-food', label: 'What is your favourite food?' },
    ]);
  });

  it('reads an enveloped list and falls back to the id as the label', () => {
    expect(parseSecurityQuestions({ questions: [{ id: 'birth-city' }] })).toEqual([
      { value: 'birth-city', label: 'birth-city' },
    ]);
  });

  it('ignores entries with no id and unusable payloads', () => {
    expect(parseSecurityQuestions([{ label: 'no id here' }, 'nonsense'])).toEqual([]);
    expect(parseSecurityQuestions(null)).toEqual([]);
    expect(parseSecurityQuestions('nope')).toEqual([]);
  });
});

describe('isDuplicateMobileError', () => {
  it('recognises the conflict status, the code and the catalogue sentence', () => {
    expect(isDuplicateMobileError(new ApiError(409, 'anything', 'whatever'))).toBe(true);
    expect(isDuplicateMobileError(new ApiError(400, 'duplicate_mobile', 'whatever'))).toBe(true);
    expect(isDuplicateMobileError(new ApiError(400, 'bad_request', MESSAGES.duplicateMobile))).toBe(true);
  });

  it('is false for any other failure', () => {
    expect(isDuplicateMobileError(new ApiError(500, 'server_error', 'boom'))).toBe(false);
    expect(isDuplicateMobileError(new Error('boom'))).toBe(false);
  });
});

describe('signUpErrorMessage', () => {
  it('uses the no-internet sentence when the API could not be reached', () => {
    expect(signUpErrorMessage(new ApiError(0, 'offline', MESSAGES.offline))).toBe(MESSAGES.offline);
  });

  it('uses the duplicate-number sentence for a conflict', () => {
    expect(signUpErrorMessage(new ApiError(409, 'duplicate_mobile', 'raw text'))).toBe(
      MESSAGES.duplicateMobile,
    );
  });

  it('never shows a raw API string for anything else', () => {
    expect(signUpErrorMessage(new ApiError(500, 'server_error', 'stack trace leaked'))).toBe(
      UNEXPECTED_MESSAGE,
    );
    expect(signUpErrorMessage('surprise')).toBe(UNEXPECTED_MESSAGE);
  });
});
