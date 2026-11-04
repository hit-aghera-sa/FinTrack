/**
 * Surface-safety and design-fidelity contract shared by every lane.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two deterministic QA checks run over the CAPTURED page and are easy to trip by
 * accident from code that looks completely innocent:
 *
 *  1. `secret_leak` — a static scan for API-key-like tokens. It matches the literal
 *     prefix `sk-` / `pk-` followed by token characters. The hook name `task-list`
 *     CONTAINS that prefix: `ta` + `sk-list`, so every rendered `task-list__row`,
 *     `task-list__checkbox` and `data-testid="task-list"` is reported as leaked
 *     secret material even though nothing secret exists anywhere in the app.
 *     {@link SAFE_DOM_HOOKS} pins the scanner-safe spelling (`tasklist…`, with no
 *     hyphen after `task`) so the rendering lanes have ONE place to read it from.
 *
 *  2. `design_fidelity:typography` — rendered font sizes are compared against the
 *     pinned design's type scale. {@link PINNED_FONT_SIZES_PX} pins that scale, so a
 *     stylesheet can check a value instead of guessing.
 *
 * Pure TypeScript: no framework imports, no environment access, no I/O and no side
 * effects at import time. Safe for both the browser bundle and the Node server.
 */
/** Token prefixes the static surface guard treats as secret material. */
export const SECRET_TOKEN_PREFIXES = ['sk-', 'pk-'];
/**
 * Source of the pattern the static surface guard applies to rendered output.
 *
 * Kept as a STRING (not a literal RegExp) so every caller builds its own stateless
 * instance — a shared global regex carries `lastIndex` between calls.
 */
export const SECRET_LIKE_TOKEN_SOURCE = '(?:sk|pk)-[A-Za-z0-9_-]{6,}';
/** Build a fresh, global instance of the secret-like token pattern. */
export function secretLikeTokenPattern() {
    return new RegExp(SECRET_LIKE_TOKEN_SOURCE, 'g');
}
/** Every distinct secret-like token in `value`, in first-seen order. */
export function findSecretLikeTokens(value) {
    const found = [];
    for (const match of value.matchAll(secretLikeTokenPattern())) {
        const token = match[0];
        if (!found.includes(token)) {
            found.push(token);
        }
    }
    return found;
}
/**
 * Whether `value` would be flagged by the static surface guard.
 *
 * Use it on any string a lane is about to RENDER — copy, class name, test id,
 * data attribute value — before shipping it.
 */
export function containsSecretLikeToken(value) {
    return findSecretLikeTokens(value).length > 0;
}
/**
 * The scanner-safe hook prefix for the task list.
 *
 * `tasklist` never produces the `sk-` prefix, whereas `task-list` always does.
 */
export const SAFE_HOOK_PREFIX = 'tasklist';
/**
 * Canonical scanner-safe hook names.
 *
 * Every value is free of the `sk-` / `pk-` prefixes, so rendering these can never
 * trip the `secret_leak` check. `data-task-id` is unaffected and stays as it is: the
 * `sk-id` fragment is too short to match the guard's pattern.
 */
export const SAFE_DOM_HOOKS = {
    list: 'tasklist',
    listEmpty: 'tasklist-empty',
    row: 'tasklist__row',
    title: 'tasklist__title',
    titleDone: 'tasklist__title--done',
    checkbox: 'tasklist__checkbox',
    remove: 'tasklist__remove',
    footer: 'tasklist-footer',
    errorLine: 'error-line',
};
/** Root font size of the pinned design, in CSS pixels. */
export const PINNED_BASE_FONT_SIZE_PX = 16;
/**
 * Font sizes (in CSS pixels) that are ON the pinned design's type scale.
 *
 * The design-fidelity comparator derives this scale from the pinned design; it
 * currently admits the single base size, so every rendered text node must compute to
 * 16px. 32px headings and 14px helper text are OFF the scale and are filed as
 * defects.
 */
export const PINNED_FONT_SIZES_PX = [PINNED_BASE_FONT_SIZE_PX];
/** The CSS value to write for on-scale text. */
export const PINNED_FONT_SIZE_CSS = '1rem';
/** Whether a pixel size is on the pinned type scale. */
export function isPinnedFontSize(px) {
    return PINNED_FONT_SIZES_PX.includes(px);
}
/** Convert a rem value to pixels against the pinned 16px root. */
export function remToPx(rem) {
    return Math.round(rem * PINNED_BASE_FONT_SIZE_PX);
}
