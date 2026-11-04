import { apiFetch } from '../../api/index.js';

/**
 * THE TWO CALLS BEHIND /profile/sessions, over the app's own `/api` surface.
 *
 * The session credential is the server's http-only cookie, which `apiFetch` always attaches, so this
 * module holds no state and keeps nothing in device storage.
 */

/** One browser or device currently signed in to the account. */
export interface DeviceSession {
  readonly id: string;
  /** The stored device description, or null when the browser sent none. */
  readonly userAgent: string | null;
  /** ISO-8601 instant the session started. */
  readonly createdAt: string;
  /** True for the session making this request. */
  readonly current: boolean;
}

/** `GET` — the account's active sessions, newest first. */
export const DEVICE_SESSIONS_PATH = '/profile/sessions';

/** `POST` — revoke every session row of the account. */
export const DEVICE_SESSIONS_REVOKE_ALL_PATH = '/profile/sessions/revoke-all';

export function fetchDeviceSessions(signal?: AbortSignal): Promise<DeviceSession[]> {
  return apiFetch<DeviceSession[]>(DEVICE_SESSIONS_PATH, signal === undefined ? undefined : { signal });
}

export function revokeAllDeviceSessions(): Promise<void> {
  return apiFetch<void>(DEVICE_SESSIONS_REVOKE_ALL_PATH, { method: 'POST' });
}
