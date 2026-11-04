import { z } from 'zod';
/**
 * THE PROFILE LANE'S INPUT RULES — the signup rules, restated for the signed-in traveller's own
 * details, plus the request schemas every profile route parses its body with.
 *
 * Pure functions and schemas only: no database, no express, no session. Two things matter here
 * beyond the character counts:
 *
 *  1. The MOBILE NUMBER IS NOT A FIELD OF ANY PROFILE REQUEST. It is the login identifier and is
 *     never editable, so no schema below mentions it — and because a Zod object strips the keys it
 *     does not declare, a client that sends `mobile` anyway has it silently discarded before the
 *     service ever sees the body.
 *  2. The password rule itself is NOT re-written here. The server has exactly one password rule, the
 *     one sign-up applies, and the service takes it as an injected dependency (`validatePassword`
 *     from the auth lane).
 */
/** A full name is 2–60 characters, exactly as the Sign up screen states. */
export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 60;
/** A security answer is 2–50 characters, compared case-insensitively when it is hashed. */
export const SECURITY_ANSWER_MIN_LENGTH = 2;
export const SECURITY_ANSWER_MAX_LENGTH = 50;
export const FULL_NAME_RULE_MESSAGE = `Full name must be between ${FULL_NAME_MIN_LENGTH} and ${FULL_NAME_MAX_LENGTH} characters.`;
export const SECURITY_ANSWER_RULE_MESSAGE = `Security answer must be between ${SECURITY_ANSWER_MIN_LENGTH} and ${SECURITY_ANSWER_MAX_LENGTH} characters.`;
export const SECURITY_QUESTION_RULE_MESSAGE = 'Choose a security question from the list.';
/** A body that is not an object with the fields the route needs. */
export const INVALID_REQUEST_MESSAGE = 'Please fill in every field.';
/** The name as it is stored: no surrounding whitespace, inner runs of spaces collapsed to one. */
export function normaliseFullName(value) {
    return value.trim().replace(/\s+/gu, ' ');
}
/** The security answer as it is compared: trimmed. Case folding happens inside the hash helper. */
export function normaliseSecurityAnswerInput(value) {
    return value.trim();
}
/** The rule message for a bad full name, or null when the name is acceptable. */
export function validateFullName(value) {
    const name = normaliseFullName(value);
    if (name.length < FULL_NAME_MIN_LENGTH || name.length > FULL_NAME_MAX_LENGTH) {
        return FULL_NAME_RULE_MESSAGE;
    }
    return null;
}
/** The rule message for a bad security answer, or null when the answer is acceptable. */
export function validateSecurityAnswer(value) {
    const answer = normaliseSecurityAnswerInput(value);
    if (answer.length < SECURITY_ANSWER_MIN_LENGTH || answer.length > SECURITY_ANSWER_MAX_LENGTH) {
        return SECURITY_ANSWER_RULE_MESSAGE;
    }
    return null;
}
/** Declares `fullName` and nothing else, so `mobile` in the body is dropped, not applied. */
export const updateNameSchema = z.object({
    fullName: z.string(),
});
export const changePasswordSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmPassword: z.string(),
});
export const changeSecurityQuestionSchema = z.object({
    currentPassword: z.string(),
    securityQuestionId: z.string(),
    securityAnswer: z.string(),
});
