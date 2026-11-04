import { MESSAGES } from '../../messages/index.js';
import { toAuthUser } from '../../models/accounts/index.js';
import { validateSignup } from './validation.js';
/**
 * WHAT CREATING AN ACCOUNT MEANS, with no Express and no Prisma in sight.
 *
 * Everything the route needs to decide — the field rules, the already-registered mobile number, the
 * hashing of the password and the security answer, the welcome sentence — happens here, over the
 * repository and credential helpers handed in by the router. The session is NOT started here: that
 * needs the request and the response, so the router does it with the returned user's id.
 */
/** Prisma's unique-constraint code: two sign-ups racing on the same mobile number. */
export const DUPLICATE_MOBILE_PRISMA_CODE = 'P2002';
function duplicateMobile() {
    return { ok: false, status: 409, field: 'mobile', message: MESSAGES.duplicateMobile };
}
/** The `code` carried by a Prisma known-request error, when there is one. */
function errorCodeOf(error) {
    if (typeof error !== 'object' || error === null)
        return null;
    if (!('code' in error))
        return null;
    const code = error.code;
    return typeof code === 'string' ? code : null;
}
export function createSignupService(deps) {
    return {
        async register(body) {
            const parsed = validateSignup(body, deps.validatePassword);
            if (!parsed.ok) {
                return { ok: false, status: 400, field: parsed.field, message: parsed.message };
            }
            const input = parsed.value;
            const existing = await deps.users.findByMobile(input.mobile);
            if (existing !== null) {
                return duplicateMobile();
            }
            const [passwordHash, securityAnswerHash] = await Promise.all([
                deps.hashPassword(input.password),
                // The answer is hashed through the auth lane's helper, which normalises it, so it is stored
                // — and later compared — case-insensitively.
                deps.hashSecurityAnswer(input.securityAnswer),
            ]);
            try {
                const record = await deps.users.create({
                    fullName: input.fullName,
                    mobile: input.mobile,
                    passwordHash,
                    securityQuestionId: input.securityQuestionId,
                    securityAnswerHash,
                });
                const user = toAuthUser(record);
                return { ok: true, status: 201, user, message: MESSAGES.welcome(user.fullName) };
            }
            catch (error) {
                // Someone else claimed this number between the check and the insert.
                if (errorCodeOf(error) === DUPLICATE_MOBILE_PRISMA_CODE) {
                    return duplicateMobile();
                }
                throw error;
            }
        },
    };
}
