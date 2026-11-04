/** What a redacted value is replaced with: a reference, never the value itself. */
export const SECRET_REF_PLACEHOLDER = '[secret-ref: redacted]';
/**
 * An `sk-`-prefixed API key: the prefix plus a long opaque body.
 *
 * The leading lookbehind is load-bearing. Without it the pattern also fires inside
 * ordinary hyphenated identifiers that merely END in `sk` before a dash — most
 * notably this app's own CSS class names (`task-list__title--done` contains the
 * substring `sk-list__title--done`), which are not credentials at all.
 */
const API_KEY_PATTERN = /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{16,}/;
/** A GitHub token (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`) plus its body. */
const GITHUB_TOKEN_PATTERN = /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{20,}/;
/** An AWS access-key id. */
const AWS_KEY_ID_PATTERN = /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}/;
/**
 * The credential shapes recognised at the response boundary.
 *
 * Declared WITHOUT the global flag so {@link containsSecretValue} can call `test`
 * repeatedly without a stateful `lastIndex` skipping matches; the replacement path
 * builds its own global copy.
 */
export const SECRET_VALUE_PATTERNS = [
    API_KEY_PATTERN,
    GITHUB_TOKEN_PATTERN,
    AWS_KEY_ID_PATTERN,
];
/** True when `value` carries something shaped like a credential. */
export function containsSecretValue(value) {
    return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}
/** Replace every recognised credential inside `value` with the secret-ref placeholder. */
export function redactSecretValues(value) {
    let result = value;
    for (const pattern of SECRET_VALUE_PATTERNS) {
        result = result.replace(new RegExp(pattern.source, 'g'), SECRET_REF_PLACEHOLDER);
    }
    return result;
}
/**
 * Copy a task list, redacting any credential-shaped text in the titles.
 *
 * Always returns fresh objects, so the store's own array is never handed to the
 * serialiser and never mutated. A list with no secrets round-trips unchanged.
 */
export function redactTaskSecrets(tasks) {
    return tasks.map((task) => {
        if (typeof task.title === 'string' && containsSecretValue(task.title)) {
            return { ...task, title: redactSecretValues(task.title) };
        }
        return { ...task };
    });
}
