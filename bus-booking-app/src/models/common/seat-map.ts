/** One seat's place in a trip's seat grid. */
export interface SeatPosition {
  /** The seat's label, e.g. `A1` — row letter followed by the column number. */
  readonly seatNumber: string;
  /** Zero-based row, top to bottom. */
  readonly rowIndex: number;
  /** Zero-based column, left to right. */
  readonly columnIndex: number;
}

/** The letter(s) for a zero-based row: 0 → `A`, 25 → `Z`, 26 → `AA`. */
export function seatRowLabel(rowIndex: number): string {
  if (!Number.isInteger(rowIndex) || rowIndex < 0) {
    throw new RangeError('Row index must be a non-negative integer');
  }
  let label = '';
  let remaining = rowIndex;
  for (;;) {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
    if (remaining < 0) return label;
  }
}

/** The seat label at a zero-based grid position: (0, 0) → `A1`, (1, 2) → `B3`. */
export function seatNumberAt(rowIndex: number, columnIndex: number): string {
  if (!Number.isInteger(columnIndex) || columnIndex < 0) {
    throw new RangeError('Column index must be a non-negative integer');
  }
  return `${seatRowLabel(rowIndex)}${columnIndex + 1}`;
}

/**
 * Every seat of a `rows` × `columns` layout, in reading order. The data layer writes one Seat row
 * per entry when a trip is created, and the seat map screen draws the same grid back.
 */
export function buildSeatGrid(rows: number, columns: number): readonly SeatPosition[] {
  if (!Number.isInteger(rows) || rows < 1) throw new RangeError('A seat layout needs at least one row');
  if (!Number.isInteger(columns) || columns < 1) throw new RangeError('A seat layout needs at least one column');

  const seats: SeatPosition[] = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      seats.push({ seatNumber: seatNumberAt(rowIndex, columnIndex), rowIndex, columnIndex });
    }
  }
  return seats;
}
