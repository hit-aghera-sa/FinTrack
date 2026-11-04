import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

/**
 * THE CREDENTIAL HELPERS OF THE WHOLE SERVER — sign-up, log-in, password reset, profile changes and
 * account deletion all hash and verify through this one module, so a credential is stored exactly one
 * way in exactly one format.
 *
 * Hashing uses the Node runtime's built-in `crypto.scrypt`: a per-secret random salt, a stored format
 * of `scrypt$<saltHex>$<keyHex>`, and a constant-time comparison on verification. Nothing reversible
 * is ever written, so a security answer and a password are equally unreadable in the database.
 *
 * Verification ALSO accepts a bcrypt-format hash, because the sample data was seeded with bcrypt: an
 * account created before this module existed can still sign in, while everything written from now on
 * is scrypt. Nothing here reads the environment and nothing is configurable at runtime.
 */

const SCRYPT_PREFIX = 'scrypt$';
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/** `$2a$`, `$2b$`, `$2y$` — a hash produced by bcrypt rather than by this module. */
const BCRYPT_PATTERN = /^\$2[aby]?\$\d{2}\$/;

/** The shortest password the app accepts. */
export const PASSWORD_MIN_LENGTH = 8;

/** The one sentence shown when a password does not satisfy the rule. */
export const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include a letter and a digit.';

const LETTER_PATTERN = /[A-Za-z]/;
const DIGIT_PATTERN = /[0-9]/;

/** The minimal bcrypt surface this module uses when it meets a legacy hash. */
interface BcryptLike {
  compare(data: string, encrypted: string): Promise<boolean>;
}

function derive(secret: string, salt: Buffer): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(secret, salt, KEY_BYTES, (error: Error | null, derivedKey: Buffer) => {
      if (error !== null) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(secret, salt);
  return `${SCRYPT_PREFIX}${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyScrypt(secret: string, hash: string): Promise<boolean> {
  const parts = hash.slice(SCRYPT_PREFIX.length).split('$');
  if (parts.length !== 2) return false;

  const saltHex = parts[0];
  const keyHex = parts[1];
  if (saltHex === '' || keyHex === '') return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(keyHex, 'hex');
  if (salt.length === 0 || expected.length !== KEY_BYTES) return false;

  const actual = await derive(secret, salt);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

async function loadBcrypt(): Promise<BcryptLike | null> {
  try {
    const imported = await import('bcrypt');
    const compare = imported.compare;
    if (typeof compare !== 'function') return null;
    return {
      compare: (data: string, encrypted: string): Promise<boolean> => compare(data, encrypted),
    };
  } catch (error: unknown) {
    console.error(
      '[auth] bcrypt is unavailable, so a legacy hash cannot be verified:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function verifySecret(secret: string, hash: string): Promise<boolean> {
  if (hash === '') return false;
  if (hash.startsWith(SCRYPT_PREFIX)) return verifyScrypt(secret, hash);
  if (BCRYPT_PATTERN.test(hash)) {
    const bcrypt = await loadBcrypt();
    if (bcrypt === null) return false;
    try {
      return await bcrypt.compare(secret, hash);
    } catch {
      return false;
    }
  }
  return false;
}

/** The stored form of a password. Never reversible, and never the same string twice. */
export function hashPassword(password: string): Promise<string> {
  return hashSecret(password);
}

/** Whether `password` is the one behind `hash`, compared in constant time. */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return verifySecret(password, hash);
}

/**
 * The password rule, as a message or null: at least 8 characters, with a letter and a digit.
 * Returning the sentence (rather than a boolean) keeps the wording in one place for every lane.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_RULE_MESSAGE;
  if (!LETTER_PATTERN.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!DIGIT_PATTERN.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
}

/**
 * A security answer as it is hashed and compared: surrounding and repeated whitespace folded away and
 * letters lower-cased, so "Meera", " meera " and "MEERA" are the same answer.
 */
export function normaliseSecurityAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The stored form of a security answer — the normalised answer, hashed like a password. */
export function hashSecurityAnswer(answer: string): Promise<string> {
  return hashSecret(normaliseSecurityAnswer(answer));
}

/** Whether the answer given matches the stored hash, case- and whitespace-insensitively. */
export function verifySecurityAnswer(answer: string, hash: string): Promise<boolean> {
  return verifySecret(normaliseSecurityAnswer(answer), hash);
}
