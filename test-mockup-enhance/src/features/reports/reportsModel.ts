/**
 * Pure presentation helpers for the member-workload report screen.
 *
 * The SERVER computes every figure (`GET /api/reports` returns the per-member
 * To do / Doing / Done, overdue and total counts). Nothing in this module
 * derives, sums or recomputes a count: it only decides how an
 * already-computed figure is WORDED and how wide its bar is drawn relative to
 * the largest total in the report.
 *
 * Deliberately free of React, of the network and of every other module, so it
 * can be unit tested on its own and can never break another lane's build.
 */

/** Width, in per cent, of the shortest bar still drawn for a member with work. */
export const MIN_VISIBLE_BAR_PERCENT = 4;

/**
 * The largest total in the report — the value every bar is measured against.
 * Returns 0 for an empty report, so a bar is simply not drawn.
 */
export function largestTotal(totals: readonly number[]): number {
  let largest = 0;
  for (const total of totals) {
    if (Number.isFinite(total) && total > largest) {
      largest = total;
    }
  }
  return largest;
}

/**
 * A member's bar width as a percentage of the largest total in the report:
 * 0 for a member with no tasks, 100 for the busiest member, and never less
 * than {@link MIN_VISIBLE_BAR_PERCENT} for a member who does carry work.
 */
export function barWidthPercent(total: number, largest: number): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }
  if (!Number.isFinite(largest) || largest <= 0) {
    return 0;
  }
  if (total >= largest) {
    return 100;
  }
  const share = Math.round((total / largest) * 100);
  return share < MIN_VISIBLE_BAR_PERCENT ? MIN_VISIBLE_BAR_PERCENT : share;
}

/** The same width as a CSS length, e.g. `"42%"`. */
export function barWidthStyle(total: number, largest: number): string {
  return `${String(barWidthPercent(total, largest))}%`;
}

/** Whether a member's overdue figure must be highlighted. */
export function isOverdueHighlighted(overdue: number): boolean {
  return Number.isFinite(overdue) && overdue > 0;
}

/**
 * The overdue wording. The highlight is always paired with text, so the state
 * is never conveyed by colour alone.
 */
export function overdueLabel(overdue: number): string {
  if (!isOverdueHighlighted(overdue)) {
    return "None overdue";
  }
  return overdue === 1 ? "1 overdue" : `${String(overdue)} overdue`;
}

/** The total wording used as a bar's accessible description. */
export function totalLabel(total: number): string {
  if (!Number.isFinite(total) || total <= 0) {
    return "No tasks";
  }
  return total === 1 ? "1 task" : `${String(total)} tasks`;
}

/**
 * A readable stamp for the report's `generatedAt` value, falling back to the
 * raw value when it cannot be parsed.
 */
export function formatGeneratedAt(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}
