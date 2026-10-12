/**
 * Row → domain mapping for labels.
 *
 * The shared `Label` model is owned by src/models/label.ts and is imported
 * here as a TYPE ONLY, so this module depends on no runtime export of that
 * file and carries no colour value of its own: `color` holds the NAME of a
 * design token, exactly as it is stored.
 */

import type { Label } from "../models/label.js";

/** The scalar columns one stored label row carries. */
export interface LabelRow {
  id: string;
  name: string;
  color: string;
}

/** The colour the shared label model stores — a design-token NAME. */
export type StoredLabelColor = Label["color"];

/** One stored label row as the shared domain model. */
export function toLabel(row: LabelRow): Label {
  return {
    id: row.id,
    name: row.name,
    color: row.color as StoredLabelColor,
  };
}

/** Every row of a label read, in the order the caller supplied them. */
export function toLabels(rows: readonly LabelRow[]): Label[] {
  return rows.map((row: LabelRow): Label => toLabel(row));
}
