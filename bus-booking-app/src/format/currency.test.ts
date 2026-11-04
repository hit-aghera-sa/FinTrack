import { describe, it, expect } from 'vitest';
import { formatINR, RUPEE_SIGN } from './currency.js';

describe('formatINR', () => {
  it('shows a whole-rupee fare with the rupee sign', () => {
    expect(formatINR(600)).toBe('₹600');
  });

  it('groups thousands', () => {
    expect(formatINR(1250)).toBe('₹1,250');
    expect(formatINR(1200)).toBe('₹1,200');
  });

  it('groups larger amounts Indian-style', () => {
    expect(formatINR(12000)).toBe('₹12,000');
    expect(formatINR(120000)).toBe('₹1,20,000');
    expect(formatINR(12345678)).toBe('₹1,23,45,678');
  });

  it('never shows paise', () => {
    expect(formatINR(599.4)).toBe('₹599');
    expect(formatINR(599.5)).toBe('₹600');
  });

  it('shows zero and negative amounts readably', () => {
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(-1250)).toBe('-₹1,250');
  });

  it('falls back to zero rather than NaN for an unusable number', () => {
    expect(formatINR(Number.NaN)).toBe('₹0');
    expect(formatINR(Number.POSITIVE_INFINITY)).toBe('₹0');
  });

  it('exports the rupee sign it uses', () => {
    expect(formatINR(1).startsWith(RUPEE_SIGN)).toBe(true);
  });
});
