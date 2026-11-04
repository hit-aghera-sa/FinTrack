import { describe, it, expect } from 'vitest';
import { theme, seatStateToken, SEAT_STATES, type SeatState } from './tokens';

const TOKEN_REFERENCE = /^var\(--color-[a-z-]+\)$/;

describe('design tokens', () => {
  it('states every colour as a reference to the approved palette, never a literal colour', () => {
    const values = Object.values(theme.colour);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).toMatch(TOKEN_REFERENCE);
    }
  });

  it('states every seat colour as a palette reference too', () => {
    for (const state of SEAT_STATES) {
      const token = seatStateToken(state);
      expect(token.background).toMatch(TOKEN_REFERENCE);
      expect(token.foreground).toMatch(TOKEN_REFERENCE);
      expect(token.border).toMatch(TOKEN_REFERENCE);
    }
  });

  it('draws the three seat states as white, grey and green surfaces', () => {
    expect(seatStateToken('available').background).toBe('var(--color-background)');
    expect(seatStateToken('booked').background).toBe('var(--color-muted)');
    expect(seatStateToken('selected').background).toBe('var(--color-success)');
  });

  it('gives every seat state a distinct word, so state is never colour alone', () => {
    const labels = SEAT_STATES.map((state: SeatState) => seatStateToken(state).label);
    expect(labels).toEqual(['Available', 'Booked', 'Selected']);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it('lists the three seat states and nothing else', () => {
    expect(SEAT_STATES).toHaveLength(3);
    expect(Object.keys(theme.seat).sort()).toEqual(['available', 'booked', 'selected']);
  });

  it('keeps the scales ordered and phone-legible', () => {
    expect(theme.typography.size.body).toBe('1rem');
    expect(theme.typography.family).toContain('Inter');
    expect(theme.touchTarget).toBe('2.75rem');
    expect(Object.values(theme.space)).toEqual(['0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '2rem']);
    expect(theme.typography.weight.semibold).toBeGreaterThan(theme.typography.weight.regular);
  });
});
