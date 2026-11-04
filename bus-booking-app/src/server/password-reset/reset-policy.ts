import { SECURITY_QUESTIONS, type SecurityQuestionId } from '../../models/accounts/index.js';

/**
 * THE RULES OF FORGOT-PASSWORD, as pure functions.
 *
 * Nothing here touches the database, the clock or Express: a mobile number, a counter state and an
 * instant in milliseconds go in, a decision comes out. That is what lets the specs beside this file
 * drive the five-wrong-answers counter and the one-hour block with no server and no Postgres.
 *
 * The decoy question is the heart of the privacy promise: a well-formed mobile number with NO account
 * still receives a security question, always the same one for that number, so the flow never reveals
 * which numbers are registered.
 */

/** A well-formed Indian mobile number: ten digits, the first one 6, 7, 8 or 9. */
const MOBILE_PATTERN = /^[6-9][0-9]{9}$/;

/** Wrong security answers allowed before password reset for that mobile number is blocked. */
export const MAX_FAILED_RESET_ANSWERS = 5;

/** How long the block lasts once it bites. */
export const RESET_BLOCK_MINUTES = 60;

/** The same duration in milliseconds. */
export const RESET_BLOCK_MS = RESET_BLOCK_MINUTES * 60 * 1000;

/** The mobile number as it is compared and stored: digits as typed, no surrounding whitespace. */
export function normaliseResetMobile(mobile: string): string {
  return mobile.trim();
}

/** Whether a reset may even be attempted for this number. */
export function isWellFormedMobile(mobile: string): boolean {
  return MOBILE_PATTERN.test(normaliseResetMobile(mobile));
}

/** The part of an account (or of a tracked decoy) the reset throttle reads. */
export interface ResetAnswerState {
  readonly failedResetCount: number;
  readonly resetBlockedUntil: string | null;
}

/** The two columns a reset attempt rewrites. */
export interface ResetAnswerPatch {
  readonly failedResetCount: number;
  readonly resetBlockedUntil: string | null;
}

/** Milliseconds left on the block, or 0 when reset is not blocked. */
export function resetBlockRemainingMs(state: ResetAnswerState, nowMs: number): number {
  if (state.resetBlockedUntil === null) return 0;
  const until = new Date(state.resetBlockedUntil).getTime();
  if (Number.isNaN(until)) return 0;
  const remaining = until - nowMs;
  return remaining > 0 ? remaining : 0;
}

/** Whether password reset for this mobile number is blocked right now. */
export function isResetBlocked(state: ResetAnswerState, nowMs: number): boolean {
  return resetBlockRemainingMs(state, nowMs) > 0;
}

/** The outcome of counting one wrong answer. */
export interface WrongAnswerResult {
  /** The counter state to persist. */
  readonly patch: ResetAnswerPatch;
  /** True when this wrong answer is the one that starts the one-hour block. */
  readonly blocked: boolean;
}

/**
 * One wrong security answer: the counter goes up, and the fifth one blocks reset for an hour.
 */
export function afterWrongAnswer(state: ResetAnswerState, nowMs: number): WrongAnswerResult {
  const previous = Number.isFinite(state.failedResetCount) ? Math.trunc(state.failedResetCount) : 0;
  const count = (previous > 0 ? previous : 0) + 1;

  if (count >= MAX_FAILED_RESET_ANSWERS) {
    return {
      patch: {
        failedResetCount: count,
        resetBlockedUntil: new Date(nowMs + RESET_BLOCK_MS).toISOString(),
      },
      blocked: true,
    };
  }

  return { patch: { failedResetCount: count, resetBlockedUntil: null }, blocked: false };
}

/** A completed reset forgets every wrong answer and lifts any block. */
export function afterSuccessfulReset(): ResetAnswerPatch {
  return { failedResetCount: 0, resetBlockedUntil: null };
}

/** A security question as the reset endpoints hand it to the client. */
export interface ResetQuestion {
  readonly securityQuestionId: SecurityQuestionId;
  readonly label: string;
}

/**
 * Which of the fixed questions a number with no account is shown — a stable, deterministic choice
 * derived from the digits alone (an FNV-1a style fold), so the same number always gets the same
 * question and a caller cannot tell a decoy from a real one by asking twice.
 */
export function decoyQuestionIndex(mobile: string, questionCount: number): number {
  if (questionCount <= 0) return 0;
  const digits = normaliseResetMobile(mobile);
  let hash = 2166136261;
  for (let index = 0; index < digits.length; index += 1) {
    hash ^= digits.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % questionCount);
}

/** The decoy question for a mobile number with no account. */
export function decoyQuestion(mobile: string): ResetQuestion {
  const chosen = SECURITY_QUESTIONS[decoyQuestionIndex(mobile, SECURITY_QUESTIONS.length)];
  return { securityQuestionId: chosen.id, label: chosen.label };
}

/**
 * The question to show for a mobile number: the account's own when there is an account, and the
 * deterministic decoy when there is not (or when a stored id is no longer in the fixed list).
 */
export function questionForAccount(mobile: string, storedId: SecurityQuestionId | null): ResetQuestion {
  if (storedId !== null) {
    const match = SECURITY_QUESTIONS.find((question) => question.id === storedId);
    if (match !== undefined) return { securityQuestionId: match.id, label: match.label };
  }
  return decoyQuestion(mobile);
}
