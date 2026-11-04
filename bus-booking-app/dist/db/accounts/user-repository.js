import { toUserRecord, toUserRowPatch } from './rows.js';
/** The mobile number as it is stored and compared: no surrounding whitespace, digits as typed. */
export function normaliseMobile(mobile) {
    return mobile.trim();
}
export function createUserRepository(store) {
    return {
        async findByMobile(mobile) {
            const row = await store.findByMobileNumber(normaliseMobile(mobile));
            return row === null ? null : toUserRecord(row);
        },
        async findById(id) {
            const row = await store.findById(id);
            return row === null ? null : toUserRecord(row);
        },
        async create(input) {
            const row = await store.insert({
                fullName: input.fullName.trim(),
                mobileNumber: normaliseMobile(input.mobile),
                passwordHash: input.passwordHash,
                securityQuestionId: input.securityQuestionId,
                securityAnswerHash: input.securityAnswerHash,
            });
            return toUserRecord(row);
        },
        async update(id, patch) {
            const row = await store.patch(id, toUserRowPatch(patch));
            return toUserRecord(row);
        },
    };
}
