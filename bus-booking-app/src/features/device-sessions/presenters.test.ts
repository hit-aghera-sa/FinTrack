import { describe, expect, it } from 'vitest';
import { ApiError, offlineError, UNEXPECTED_MESSAGE } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';
import { deviceLabel, errorMessage, sessionCountLabel, UNKNOWN_DEVICE_LABEL } from './presenters.js';

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

describe('deviceLabel', () => {
  it('names the browser and the platform', () => {
    expect(deviceLabel(CHROME_WINDOWS)).toBe('Chrome on Windows');
  });

  it('prefers Edge over the Chrome token it also carries', () => {
    expect(deviceLabel(EDGE_WINDOWS)).toBe('Edge on Windows');
  });

  it('names an iPhone rather than the Mac it mentions', () => {
    expect(deviceLabel(SAFARI_IPHONE)).toBe('Safari on iPhone');
  });

  it('prefers Android over the Linux token it also carries', () => {
    expect(deviceLabel(CHROME_ANDROID)).toBe('Chrome on Android');
  });

  it('states plainly when there is no device description', () => {
    expect(deviceLabel(null)).toBe(UNKNOWN_DEVICE_LABEL);
    expect(deviceLabel('   ')).toBe(UNKNOWN_DEVICE_LABEL);
    expect(deviceLabel('some-automation-agent')).toBe(UNKNOWN_DEVICE_LABEL);
  });

  it('names the platform alone when the browser is unknown', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) SomeOtherBrowser/1.0')).toBe('Browser on Windows');
  });
});

describe('sessionCountLabel', () => {
  it('reads as a singular for one device', () => {
    expect(sessionCountLabel(1)).toBe('1 device signed in');
  });

  it('reads as a plural otherwise', () => {
    expect(sessionCountLabel(0)).toBe('0 devices signed in');
    expect(sessionCountLabel(4)).toBe('4 devices signed in');
  });
});

describe('errorMessage', () => {
  it('uses the catalogue sentence when the backend could not be reached', () => {
    expect(errorMessage(offlineError())).toBe(MESSAGES.offline);
  });

  it("keeps the server's own sentence", () => {
    expect(errorMessage(new ApiError(401, 'not_signed_in', 'Please log in to continue.'))).toBe(
      'Please log in to continue.',
    );
  });

  it('falls back for a failure that carries no sentence', () => {
    expect(errorMessage({ unexpected: true })).toBe(UNEXPECTED_MESSAGE);
    expect(errorMessage(new Error('   '))).toBe(UNEXPECTED_MESSAGE);
  });
});
