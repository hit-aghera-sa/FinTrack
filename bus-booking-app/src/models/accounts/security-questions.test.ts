import { describe, expect, it } from 'vitest';
import {
  coerceSecurityQuestionId,
  DEFAULT_SECURITY_QUESTION_ID,
  isSecurityQuestionId,
  SECURITY_QUESTION_IDS,
  SECURITY_QUESTIONS,
  securityQuestionLabel,
} from './security-questions.js';

describe('the security question catalogue', () => {
  it('offers exactly the four approved questions, in order', () => {
    expect(SECURITY_QUESTIONS.map((question) => question.id)).toEqual([
      'MOTHER_NAME',
      'FIRST_SCHOOL',
      'FAVOURITE_FOOD',
      'BIRTH_CITY',
    ]);
    expect(SECURITY_QUESTION_IDS).toEqual(SECURITY_QUESTIONS.map((question) => question.id));
  });

  it('words each question the way the screens show it', () => {
    expect(SECURITY_QUESTIONS.map((question) => question.label)).toEqual([
      "What is your mother's first name?",
      'What was the name of your first school?',
      'What is your favourite food?',
      'In which city were you born?',
    ]);
    expect(securityQuestionLabel('BIRTH_CITY')).toBe('In which city were you born?');
  });

  it('has a unique id per question', () => {
    const ids = new Set(SECURITY_QUESTIONS.map((question) => question.id));
    expect(ids.size).toBe(SECURITY_QUESTIONS.length);
  });
});

describe('isSecurityQuestionId', () => {
  it('accepts a catalogue id', () => {
    expect(isSecurityQuestionId('FAVOURITE_FOOD')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isSecurityQuestionId('favourite_food')).toBe(false);
    expect(isSecurityQuestionId('PET_NAME')).toBe(false);
    expect(isSecurityQuestionId(7)).toBe(false);
    expect(isSecurityQuestionId(null)).toBe(false);
    expect(isSecurityQuestionId(undefined)).toBe(false);
  });
});

describe('coerceSecurityQuestionId', () => {
  it('keeps a catalogue id, whatever its case or separators', () => {
    expect(coerceSecurityQuestionId('MOTHER_NAME')).toBe('MOTHER_NAME');
    expect(coerceSecurityQuestionId(' first_school ')).toBe('FIRST_SCHOOL');
    expect(coerceSecurityQuestionId('birth city')).toBe('BIRTH_CITY');
    expect(coerceSecurityQuestionId('BIRTH-CITY')).toBe('BIRTH_CITY');
  });

  it('reads the sample data slugs as the questions they mean', () => {
    expect(coerceSecurityQuestionId('mothers-first-name')).toBe('MOTHER_NAME');
    expect(coerceSecurityQuestionId('favourite-food')).toBe('FAVOURITE_FOOD');
    expect(coerceSecurityQuestionId('first-school')).toBe('FIRST_SCHOOL');
    expect(coerceSecurityQuestionId('birth-city')).toBe('BIRTH_CITY');
  });

  it('falls back to the default rather than failing on an unknown value', () => {
    expect(coerceSecurityQuestionId('something-else')).toBe(DEFAULT_SECURITY_QUESTION_ID);
    expect(coerceSecurityQuestionId('')).toBe(DEFAULT_SECURITY_QUESTION_ID);
  });
});
