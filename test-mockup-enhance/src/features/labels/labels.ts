/**
 * The label domain as the shared label UI uses it.
 *
 * A label carries a name and one of a FIXED set of colours. Each colour is a
 * token name, never a literal colour value: the chip turns it into a class
 * (`label-chip--primary`) whose rules live in LabelBadge.css and read only the
 * project's existing `var(--color-*)` tokens.
 */

/** The colours a label may be given. */
export type LabelColor = "primary" | "info" | "success" | "warning" | "danger" | "neutral";

/** One choice offered by the create-label control. */
export interface LabelColorOption {
  readonly id: LabelColor;
  /** The words shown in the colour chooser. */
  readonly name: string;
}

/** The palette the create-label control offers, in display order. */
export const LABEL_COLORS: readonly LabelColorOption[] = [
  { id: "primary", name: "Blue" },
  { id: "info", name: "Sky" },
  { id: "success", name: "Green" },
  { id: "warning", name: "Amber" },
  { id: "danger", name: "Red" },
  { id: "neutral", name: "Grey" },
];

/** The colour a new label starts on. */
export const DEFAULT_LABEL_COLOR: LabelColor = "primary";

/** A label as the backend stores it. */
export interface Label {
  id: string;
  name: string;
  color: LabelColor;
}

/** What creating a label sends. */
export interface NewLabel {
  name: string;
  color: LabelColor;
}

/** Narrowing guard for untrusted input (a response body, a select value). */
export function isLabelColor(value: unknown): value is LabelColor {
  return (
    typeof value === "string" &&
    LABEL_COLORS.some((option: LabelColorOption): boolean => option.id === value)
  );
}

/** The chip class for a colour. The rules for it ship in LabelBadge.css. */
export function labelColorClass(color: LabelColor): string {
  return `label-chip--${color}`;
}

/** The words for a colour, for a chooser or a screen reader. */
export function labelColorName(color: LabelColor): string {
  const found = LABEL_COLORS.find((option: LabelColorOption): boolean => option.id === color);
  return found === undefined ? "" : found.name;
}
