import { describe, expect, it } from 'vitest';

import { SECURITY_QUESTIONS } from '../../models/accounts/index.js';
import {
  afterSuccessfulReset,
  afterWrongAnswer,
  decoyQuestion,
  decoyQuestionIndex,
  isResetBlocked,
  isWellFormedMobile,
  MAX_FAILED_RESET_ANSWERS,
  normaliseResetMobile,
  questionForAccount,
  RESET_BLOCK_MINUTES,
  RESET_BLOCK_MS,
  resetBlockRemainingMs,
} from './reset-policy.js';

const NOW = Date.parse('2024-06-01T10:00:00.000Z');

describe('reset mobile numbers', () => {
  it('accepts a ten-digit number starting 6, 7, 8 or 9, ignoring surrounding spaces', () => {
    expect(isWellFormedMobile('9876543210')).toBe(true);
    expect(isWellFormedMobile('6000000000')).toBe(true);
    expect(isWellFormedMobile('  7012345678  ')).toBe(true);
    expect(normaliseResetMobile('  7012345678  ')).toBe('7012345678');
  });

  it('refuses anything that is not a ten-digit number starting 6 to 9', () => {
    expect(isWellFormedMobile('5876543210')).toBe(false);
    expect(isWellFormedMobile('987654321')).toBe(false);
    expect(isWellFormedMobile('98765432101')).toBe(false);
    expect(isWellFormedMobile('98765a3210')).toBe(false);
    expect(isWellFormedMobile('')).toBe(false);
  });
});

describe('the deterministic decoy question', () => {
  it('picks an index inside the fixed question list', () => {
    const numbers = ['9876543210', '9000000001', '7012345678', '8123456789', '6999999999'];
    for (const number of numbers) {
      const index = decoyQuestionIndex(number, SECURITY_QUESTIONS.length);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(SECURITY_QUESTIONS.length);
    }
  });

  it('gives the same number the same question every time', () => {
    const first = decoyQuestion('9000000001');
    const second = decoyQuestion('  9000000001 ');
    expect(second).toEqual(first);
    expect(SECURITY_QUESTIONS.some((question) => question.id === first.securityQuestionId)).toBe(true);
    expect(first.label.length).toBeGreaterThan(0);
  });

  it('never divides by an empty question list', () => {
    expect(decoyQuestionIndex('9876543210', 0)).toBe(0);
  });
});

describe('questionForAccount', () => {
  it("returns the account's own question when there is an account", () => {
    const stored = SECURITY_QUESTIONS[SECURITY_QUESTIONS.length - 1];
    expect(questionForAccount('9876543210', stored.id)).toEqual({
      securityQuestionId: stored.id,
      label: stored.label,
    });
  });

  it('returns the decoy when there is no account', () => {
    expect(questionForAccount('9000000001', null)).toEqual(decoyQuestion('9000000001'));
  });
});

describe('the wrong-answer counter and the one-hour block', () => {
  it('blocks for exactly one hour', () => {
    expect(RESET_BLOCK_MINUTES).toBe(60);
    expect(RESET_BLOCK_MS).toBe(60 * 60 * 1000);
  });

  it('counts the first four wrong answers without blocking', () => {
    let state = { failedResetCount: 0, resetBlockedUntil: null as string | null };
    for (let attempt = 1; attempt < MAX_FAILED_RESET_ANSWERS; attempt += 1) {
      const result = afterWrongAnswer(state, NOW);
      expect(result.blocked).toBe(false);
      expect(result.patch).toEqual({ failedResetCount: attempt, resetBlockedUntil: null });
      state = { failedResetCount: result.patch.failedResetCount, resetBlockedUntil: result.patch.resetBlockedUntil };
    }
  });

  it('blocks on the fifth wrong answer', () => {
    const result = afterWrongAnswer({ failedResetCount: 4, resetBlockedUntil: null }, NOW);
    expect(result.blocked).toBe(true);
    expect(result.patch).toEqual({
      failedResetCount: MAX_FAILED_RESET_ANSWERS,
      resetBlockedUntil: new Date(NOW + RESET_BLOCK_MS).toISOString(),
    });
  });

  it('reports the block as active until the hour has passed', () => {
    const blocked = { failedResetCount: 5, resetBlockedUntil: new Date(NOW + RESET_BLOCK_MS).toISOString() };
    expect(isResetBlocked(blocked, NOW)).toBe(true);
    expect(resetBlockRemainingMs(blocked, NOW)).toBe(RESET_BLOCK_MS);
    expect(isResetBlocked(blocked, NOW + RESET_BLOCK_MS - 1)).toBe(true);
    expect(isResetBlocked(blocked, NOW + RESET_BLOCK_MS)).toBe(false);
    expect(resetBlockRemainingMs(blocked, NOW + RESET_BLOCK_MS + 5000)).toBe(0);
  });

  it('treats no block and an unreadable block as not blocked', () => {
    expect(isResetBlocked({ failedResetCount: 0, resetBlockedUntil: null }, NOW)).toBe(false);
    expect(isResetBlocked({ failedResetCount: 5, resetBlockedUntil: 'not-a-date' }, NOW)).toBe(false);
  });

  it('forgets every wrong answer after a completed reset', () => {
    expect(afterSuccessfulReset()).toEqual({ failedResetCount: 0, resetBlockedUntil: null });
  });
});
