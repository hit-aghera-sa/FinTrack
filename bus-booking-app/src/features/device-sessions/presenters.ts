import { ApiError, isOfflineError, UNEXPECTED_MESSAGE } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';

/**
 * PURE PRESENTATION HELPERS for the Active devices screen.
 *
 * No React, no fetching: a user-agent string in, a sentence a traveller can read out. Kept beside the
 * screen so the wording is exercised by unit tests without a browser.
 */

/** What a session row says when its browser could not be recognised at all. */
export const UNKNOWN_DEVICE_LABEL = 'Unrecognised device';

interface AgentToken {
  readonly token: string;
  readonly label: string;
}

/** Order matters: Edge and Opera both carry `Chrome/`, and iOS browsers both carry `Safari/`. */
const BROWSERS: readonly AgentToken[] = [
  { token: 'Edg/', label: 'Edge' },
  { token: 'Edge/', label: 'Edge' },
  { token: 'OPR/', label: 'Opera' },
  { token: 'CriOS/', label: 'Chrome' },
  { token: 'FxiOS/', label: 'Firefox' },
  { token: 'Chrome/', label: 'Chrome' },
  { token: 'Firefox/', label: 'Firefox' },
  { token: 'Safari/', label: 'Safari' },
];

/** Order matters: an iPhone's user agent also mentions `Mac OS X`. */
const PLATFORMS: readonly AgentToken[] = [
  { token: 'Windows', label: 'Windows' },
  { token: 'Android', label: 'Android' },
  { token: 'iPhone', label: 'iPhone' },
  { token: 'iPad', label: 'iPad' },
  { token: 'CrOS', label: 'Chromebook' },
  { token: 'Macintosh', label: 'Mac' },
  { token: 'Mac OS X', label: 'Mac' },
  { token: 'Linux', label: 'Linux' },
];

function firstMatch(userAgent: string, tokens: readonly AgentToken[]): string | null {
  for (const candidate of tokens) {
    if (userAgent.includes(candidate.token)) return candidate.label;
  }
  return null;
}

/**
 * The device description shown in the list: `Chrome on Windows`, `Safari on iPhone`, and a plain
 * statement when the stored user agent is absent or unreadable.
 */
export function deviceLabel(userAgent: string | null): string {
  const agent = (userAgent ?? '').trim();
  if (agent === '') return UNKNOWN_DEVICE_LABEL;

  const browser = firstMatch(agent, BROWSERS);
  const platform = firstMatch(agent, PLATFORMS);

  if (browser !== null && platform !== null) return `${browser} on ${platform}`;
  if (browser !== null) return browser;
  if (platform !== null) return `Browser on ${platform}`;
  return UNKNOWN_DEVICE_LABEL;
}

/** The line under the table: `1 device signed in`, `4 devices signed in`. */
export function sessionCountLabel(count: number): string {
  return count === 1 ? '1 device signed in' : `${count} devices signed in`;
}

/**
 * The sentence to show for a failed call. A no-internet failure gets the catalogue's own wording; an
 * error body from the server is already the catalogue's sentence, so it is shown as it arrived.
 */
export function errorMessage(caught: unknown): string {
  if (isOfflineError(caught)) return MESSAGES.offline;
  if (caught instanceof ApiError) return caught.message;
  if (caught instanceof Error && caught.message.trim() !== '') return caught.message;
  return UNEXPECTED_MESSAGE;
}
