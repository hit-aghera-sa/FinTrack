/**
 * Shared label domain types. Declared exactly once for the whole project —
 * every other lane imports these rather than re-declaring them.
 *
 * A label's colour is the NAME OF A DESIGN TOKEN, never a literal colour: the
 * UI maps the name onto the palette it already ships, so a label can never
 * introduce a colour of its own.
 */

/** The colour token names a label may carry. */
export type LabelColor = "neutral" | "primary" | "info" | "success" | "warning" | "danger";

/** Every allowed colour token name, in the order a picker should offer them. */
export const LABEL_COLORS: readonly LabelColor[] = [
  "neutral",
  "primary",
  "info",
  "success",
  "warning",
  "danger",
];

/** The colour a label gets when none was chosen. */
export const DEFAULT_LABEL_COLOR: LabelColor = "neutral";

/** A stored label. */
export interface Label {
  id: string;
  name: string;
  color: LabelColor;
}

/** What creating a label needs. */
export interface NewLabel {
  name: string;
  color: LabelColor;
}

/** Narrowing guard for untrusted input (request bodies, query strings). */
export function isLabelColor(value: unknown): value is LabelColor {
  return (
    typeof value === "string" &&
    LABEL_COLORS.some((color: LabelColor): boolean => color === value)
  );
}

/**
 * The stored form of a label name: trimmed, with any run of whitespace
 * collapsed to a single space. "  Needs   design " becomes "Needs design".
 */
export function normaliseLabelName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Whether two label names are the same name. Names are compared without
 * regard to case or surrounding whitespace, so "Bug" and "bug" are one label.
 */
export function sameLabelName(left: string, right: string): boolean {
  return normaliseLabelName(left).toLowerCase() === normaliseLabelName(right).toLowerCase();
}

/** Orders labels by name, the order every list endpoint returns them in. */
export function compareLabels(left: Label, right: Label): number {
  const a = left.name.toLowerCase();
  const b = right.name.toLowerCase();
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
