import { z } from 'zod';
/**
 * THE ONE FIELD this lane accepts: the traveller's current password, re-typed to prove the
 * irreversible action is theirs.
 */
/** What a caller is told when the password field is absent or blank. */
export const CURRENT_PASSWORD_REQUIRED_MESSAGE = 'Enter your current password to delete your account.';
export const deleteAccountSchema = z.object({
    currentPassword: z.string().min(1, CURRENT_PASSWORD_REQUIRED_MESSAGE),
});
/**
 * The request body, narrowed. The password itself is NEVER trimmed (spaces may be part of it); a
 * value that is only whitespace is treated as absent.
 */
export function readCurrentPassword(body) {
    const parsed = deleteAccountSchema.safeParse(body);
    if (!parsed.success)
        return { ok: false, message: CURRENT_PASSWORD_REQUIRED_MESSAGE };
    const currentPassword = parsed.data.currentPassword;
    if (currentPassword.trim() === '')
        return { ok: false, message: CURRENT_PASSWORD_REQUIRED_MESSAGE };
    return { ok: true, currentPassword };
}
