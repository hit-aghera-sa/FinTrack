import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../messages/index.js';
import {
  ANSWER_REQUIRED_MESSAGE,
  MOBILE_RULE_MESSAGE,
  PASSWORD_RULE_MESSAGE,
  normaliseMobileInput,
  validateAnswer,
  validateMobile,
  validateNewPassword,
  validatePasswordRule,
} from './validation.js';

describe('forgot password field rules', () => {
  it('keeps only the first ten digits of what was typed', () => {
    expect(normaliseMobileInput(' 98765-43210 ')).toBe('9876543210');
    expect(normaliseMobileInput('98765432109999')).toBe('9876543210');
  });

  it('accepts a well-formed Indian mobile number', () => {
    expect(validateMobile('9876543210')).toBeNull();
    expect(validateMobile('6012345678')).toBeNull();
  });

  it('refuses a number that is not ten digits starting 6-9', () => {
    expect(validateMobile('12345')).toBe(MOBILE_RULE_MESSAGE);
    expect(validateMobile('1234567890')).toBe(MOBILE_RULE_MESSAGE);
    expect(validateMobile('')).toBe(MOBILE_RULE_MESSAGE);
  });

  it('requires an answer before the password step', () => {
    expect(validateAnswer('   ')).toBe(ANSWER_REQUIRED_MESSAGE);
    expect(validateAnswer(' Meera ')).toBeNull();
  });

  it('applies the signup password rules to the new password', () => {
    expect(validatePasswordRule('short1')).toBe(PASSWORD_RULE_MESSAGE);
    expect(validatePasswordRule('alphabetsonly')).toBe(PASSWORD_RULE_MESSAGE);
    expect(validatePasswordRule('12345678')).toBe(PASSWORD_RULE_MESSAGE);
    expect(validatePasswordRule('Yatra2024')).toBeNull();
  });

  it('reports the catalogue mismatch sentence when the two fields differ', () => {
    expect(validateNewPassword('Yatra2024', 'Yatra2025')).toBe(MESSAGES.passwordMismatch);
    expect(validateNewPassword('Yatra2024', 'Yatra2024')).toBeNull();
  });

  it('reports the rule before the mismatch', () => {
    expect(validateNewPassword('abc', 'xyz')).toBe(PASSWORD_RULE_MESSAGE);
  });
});
