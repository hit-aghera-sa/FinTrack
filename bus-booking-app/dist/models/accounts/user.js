/** The safe public projection of a stored account: drops the hashes and the counters. */
export function toAuthUser(user) {
    return {
        id: user.id,
        fullName: user.fullName,
        mobile: user.mobile,
        securityQuestionId: user.securityQuestionId,
    };
}
