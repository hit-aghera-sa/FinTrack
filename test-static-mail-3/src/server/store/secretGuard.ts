/**
 * Secret-material guard for untrusted task payloads.
 *
 * The store is fed by a fully untrusted full-list `PUT`, and whatever it stores is
 * later rendered verbatim by the client (row titles, `data-task-id` attributes).
 * Credential-shaped values must therefore never be allowed into the backing array:
 * a secret that reaches the list becomes a secret rendered on screen.
 *
 * Pure module: no I/O, no state, no side effects at import time. The patterns carry
 * no `g` flag, so `test()` is stateless and safe to call repeatedly.
 */

/**
 * Patterns that identify credential-shaped tokens.
 *
 * Each pattern is `\b`-anchored (or anchored on a literal marker) so ordinary prose
 * is never matched — "Ask-list review" and "Book a task-list demo" both pass.
 */
export const SECRET_PATTERNS: readonly RegExp[] = [
  // OpenAI-style API key: sk-<token>
  /\bsk-[A-Za-z0-9_-]{8,}/,
  // Generic prefixed keys: pk-, rk-, api-, key-, token-
  /\b(?:pk|rk|api|key|token)-[A-Za-z0-9_-]{16,}/i,
  // GitHub personal access tokens
  /\bgh[pousr]_[A-Za-z0-9]{16,}/,
  // AWS access key id
  /\bAKIA[0-9A-Z]{12,}/,
  // Bearer authorization values
  /\bBearer\s+[A-Za-z0-9._-]{16,}/i,
  // PEM private key blocks
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

/**
 * True when `value` is a string that contains credential-shaped material.
 *
 * Non-strings are never secrets (they are rejected elsewhere by the shape guard).
 */
export function looksLikeSecret(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  return SECRET_PATTERNS.some((pattern: RegExp) => pattern.test(value));
}
