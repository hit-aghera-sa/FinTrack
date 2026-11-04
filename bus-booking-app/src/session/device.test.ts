import { describe, expect, it } from 'vitest';
import { describeDevice } from './device.js';

describe('describeDevice', () => {
  it('names the browser and the platform of an Android phone', () => {
    const agent =
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    expect(describeDevice(agent)).toBe('Chrome on Android');
  });

  it('names Safari on an iPhone', () => {
    const agent =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(describeDevice(agent)).toBe('Safari on iPhone');
  });

  it('prefers Edge over the Chrome string it also carries', () => {
    const agent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91';
    expect(describeDevice(agent)).toBe('Edge on Windows');
  });

  it('names Firefox on macOS', () => {
    const agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0';
    expect(describeDevice(agent)).toBe('Firefox on macOS');
  });

  it('falls back to a plain phrase when there is nothing to read', () => {
    expect(describeDevice('')).toBe('This browser');
    expect(describeDevice('   ')).toBe('This browser');
  });
});
