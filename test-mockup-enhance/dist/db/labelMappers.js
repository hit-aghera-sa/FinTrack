/**
 * Row → domain mapping for labels.
 *
 * The shared `Label` model is owned by src/models/label.ts and is imported
 * here as a TYPE ONLY, so this module depends on no runtime export of that
 * file and carries no colour value of its own: `color` holds the NAME of a
 * design token, exactly as it is stored.
 */
/** One stored label row as the shared domain model. */
export function toLabel(row) {
    return {
        id: row.id,
        name: row.name,
        color: row.color,
    };
}
/** Every row of a label read, in the order the caller supplied them. */
export function toLabels(rows) {
    return rows.map((row) => toLabel(row));
}
