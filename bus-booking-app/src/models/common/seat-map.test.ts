import { describe, expect, it } from 'vitest';
import { buildSeatGrid, seatNumberAt, seatRowLabel } from './seat-map.js';
import { totalFareFor } from './fare.js';

describe('seatRowLabel', () => {
  it('letters the rows, carrying over past Z', () => {
    expect(seatRowLabel(0)).toBe('A');
    expect(seatRowLabel(8)).toBe('I');
    expect(seatRowLabel(25)).toBe('Z');
    expect(seatRowLabel(26)).toBe('AA');
  });

  it('refuses a negative or fractional row', () => {
    expect(() => seatRowLabel(-1)).toThrow(RangeError);
    expect(() => seatRowLabel(1.5)).toThrow(RangeError);
  });
});

describe('seatNumberAt', () => {
  it('reads as row letter then column number', () => {
    expect(seatNumberAt(0, 0)).toBe('A1');
    expect(seatNumberAt(1, 2)).toBe('B3');
    expect(seatNumberAt(4, 1)).toBe('E2');
  });
});

describe('buildSeatGrid', () => {
  it('lays every seat out in reading order', () => {
    const grid = buildSeatGrid(3, 4);
    expect(grid).toHaveLength(12);
    expect(grid.map((seat) => seat.seatNumber).slice(0, 5)).toEqual(['A1', 'A2', 'A3', 'A4', 'B1']);
    expect(grid[grid.length - 1]).toEqual({ seatNumber: 'C4', rowIndex: 2, columnIndex: 3 });
  });

  it('gives every seat a distinct number', () => {
    const grid = buildSeatGrid(9, 4);
    expect(new Set(grid.map((seat) => seat.seatNumber)).size).toBe(36);
  });

  it('refuses an empty layout', () => {
    expect(() => buildSeatGrid(0, 4)).toThrow(RangeError);
    expect(() => buildSeatGrid(4, 0)).toThrow(RangeError);
  });
});

describe('totalFareFor', () => {
  it('multiplies seats by the whole-rupee fare', () => {
    expect(totalFareFor(2, 600)).toBe(1200);
    expect(totalFareFor(0, 600)).toBe(0);
  });

  it('refuses fractional money or seat counts', () => {
    expect(() => totalFareFor(1.5, 600)).toThrow(RangeError);
    expect(() => totalFareFor(1, 599.5)).toThrow(RangeError);
  });
});
