/**
 * A READABLE NAME FOR THE BROWSER A SESSION IS RUNNING IN — "Chrome on Android", "Safari on iPhone".
 *
 * Pure string work on a user-agent string: no DOM, no network. The session screens show this instead
 * of the raw user agent, which is unreadable, and instead of an identifier, which means nothing to a
 * traveller.
 */

function browserName(userAgent: string): string {
  if (/Edg\//.test(userAgent) || /Edge\//.test(userAgent)) return 'Edge';
  if (/OPR\//.test(userAgent) || /Opera/.test(userAgent)) return 'Opera';
  if (/SamsungBrowser\//.test(userAgent)) return 'Samsung Internet';
  if (/Chrome\//.test(userAgent)) return 'Chrome';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/Safari\//.test(userAgent)) return 'Safari';
  return 'Browser';
}

function platformName(userAgent: string): string {
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Windows/.test(userAgent)) return 'Windows';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'macOS';
  if (/CrOS/.test(userAgent)) return 'ChromeOS';
  if (/Linux/.test(userAgent)) return 'Linux';
  return 'this device';
}

/** "Chrome on Android" for a user agent, or a plain phrase when there is nothing to read. */
export function describeDevice(userAgent: string): string {
  const agent = userAgent.trim();
  if (agent === '') return 'This browser';
  return `${browserName(agent)} on ${platformName(agent)}`;
}

/** The description for the browser this code is running in. Safe to call during a server render. */
export function describeThisDevice(): string {
  if (typeof navigator === 'undefined') return 'This browser';
  return describeDevice(navigator.userAgent);
}
