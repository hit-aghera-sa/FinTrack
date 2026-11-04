import { coerceSecurityQuestionId, } from '../../models/accounts/index.js';
function timestampMs(value) {
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
}
/** A stored instant as the ISO-8601 string the domain and the API use. */
export function rowTimestampToIso(value) {
    return new Date(timestampMs(value)).toISOString();
}
/** The same, keeping "no instant" as null (an account that is not locked, not blocked). */
export function rowTimestampToIsoOrNull(value) {
    return value === null ? null : rowTimestampToIso(value);
}
/** The reverse direction: an ISO-8601 string (or null) as the value the column takes. */
export function isoToDateOrNull(value) {
    return value === null ? null : new Date(value);
}
/** One User row as the account record every lane above the data layer works with. */
export function toUserRecord(row) {
    return {
        id: row.id,
        fullName: row.fullName,
        mobile: row.mobileNumber,
        securityQuestionId: coerceSecurityQuestionId(row.securityQuestionId),
        passwordHash: row.passwordHash,
        securityAnswerHash: row.securityAnswerHash,
        failedLoginCount: row.failedLoginCount,
        lockedUntil: rowTimestampToIsoOrNull(row.lockedUntil),
        failedResetCount: row.failedResetCount,
        resetBlockedUntil: rowTimestampToIsoOrNull(row.resetBlockedUntil),
        createdAt: rowTimestampToIso(row.createdAt),
    };
}
/**
 * A domain patch as the columns to write. Only the keys actually present are carried over, so an
 * update of `failedLoginCount` alone never blanks the lock instant, and a key set to null clears its
 * column.
 */
export function toUserRowPatch(patch) {
    const row = {};
    if (patch.fullName !== undefined)
        row.fullName = patch.fullName.trim();
    if (patch.passwordHash !== undefined)
        row.passwordHash = patch.passwordHash;
    if (patch.securityQuestionId !== undefined)
        row.securityQuestionId = patch.securityQuestionId;
    if (patch.securityAnswerHash !== undefined)
        row.securityAnswerHash = patch.securityAnswerHash;
    if (patch.failedLoginCount !== undefined)
        row.failedLoginCount = patch.failedLoginCount;
    if (patch.lockedUntil !== undefined)
        row.lockedUntil = isoToDateOrNull(patch.lockedUntil);
    if (patch.failedResetCount !== undefined)
        row.failedResetCount = patch.failedResetCount;
    if (patch.resetBlockedUntil !== undefined)
        row.resetBlockedUntil = isoToDateOrNull(patch.resetBlockedUntil);
    return row;
}
/** One Session row as a row of the "Active devices" list. The token never leaves the data layer. */
export function toActiveSession(row, currentToken) {
    return {
        id: row.id,
        userAgent: row.userAgent,
        createdAt: rowTimestampToIso(row.createdAt),
        current: currentToken !== null && currentToken === row.token,
    };
}
/** Newest session first, with the id as a stable tie-break so the order never wobbles. */
export function compareSessionsNewestFirst(left, right) {
    const byTime = timestampMs(right.createdAt) - timestampMs(left.createdAt);
    if (byTime !== 0)
        return byTime;
    return right.id.localeCompare(left.id);
}
