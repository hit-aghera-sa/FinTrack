import { MESSAGES } from '../../messages/index.js';
import { SECURITY_QUESTIONS, toAuthUser, } from '../../models/accounts/index.js';
import { NOT_SIGNED_IN_MESSAGE } from '../auth/responses.js';
import { normaliseFullName, validateFullName, validateSecurityAnswer, SECURITY_QUESTION_RULE_MESSAGE, } from './validation.js';
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
function failure(status, code, message) {
    return { ok: false, status, code, message };
}
/** The chosen question, or null when the id is not one of the fixed four. */
function asSecurityQuestionId(value) {
    const match = SECURITY_QUESTIONS.find((question) => question.id === value);
    return match === undefined ? null : match.id;
}
export function createProfileService(deps) {
    async function requireRecord(userId) {
        const record = await deps.users.findById(userId);
        if (record === null) {
            // The session pointed at an account that no longer exists (deleted in another tab).
            return failure(UNAUTHORIZED, 'account_missing', NOT_SIGNED_IN_MESSAGE);
        }
        return { ok: true, value: record };
    }
    async function withVerifiedPassword(userId, currentPassword) {
        const found = await requireRecord(userId);
        if (!found.ok)
            return found;
        const matches = await deps.verifyPassword(currentPassword, found.value.passwordHash);
        if (!matches) {
            return failure(BAD_REQUEST, 'wrong_current_password', MESSAGES.currentPasswordIncorrect);
        }
        return found;
    }
    return {
        async getProfile(userId) {
            const found = await requireRecord(userId);
            if (!found.ok)
                return found;
            return { ok: true, value: toAuthUser(found.value) };
        },
        async changeName(userId, input) {
            const ruleMessage = validateFullName(input.fullName);
            if (ruleMessage !== null) {
                return failure(BAD_REQUEST, 'invalid_full_name', ruleMessage);
            }
            const found = await requireRecord(userId);
            if (!found.ok)
                return found;
            // Only the name: the mobile number, the credentials and the counters are left alone.
            const updated = await deps.users.update(userId, { fullName: normaliseFullName(input.fullName) });
            return { ok: true, value: toAuthUser(updated) };
        },
        async changePassword(userId, input) {
            const verified = await withVerifiedPassword(userId, input.currentPassword);
            if (!verified.ok)
                return verified;
            if (input.newPassword !== input.confirmPassword) {
                return failure(BAD_REQUEST, 'password_mismatch', MESSAGES.passwordMismatch);
            }
            const ruleMessage = deps.validatePassword(input.newPassword);
            if (ruleMessage !== null) {
                return failure(BAD_REQUEST, 'weak_password', ruleMessage);
            }
            const passwordHash = await deps.hashPassword(input.newPassword);
            await deps.users.update(userId, { passwordHash });
            return { ok: true, value: null };
        },
        async changeSecurityQuestion(userId, input) {
            const verified = await withVerifiedPassword(userId, input.currentPassword);
            if (!verified.ok)
                return verified;
            const securityQuestionId = asSecurityQuestionId(input.securityQuestionId);
            if (securityQuestionId === null) {
                return failure(BAD_REQUEST, 'invalid_security_question', SECURITY_QUESTION_RULE_MESSAGE);
            }
            const answerMessage = validateSecurityAnswer(input.securityAnswer);
            if (answerMessage !== null) {
                return failure(BAD_REQUEST, 'invalid_security_answer', answerMessage);
            }
            const securityAnswerHash = await deps.hashSecurityAnswer(input.securityAnswer);
            const updated = await deps.users.update(userId, { securityQuestionId, securityAnswerHash });
            return { ok: true, value: toAuthUser(updated) };
        },
    };
}
