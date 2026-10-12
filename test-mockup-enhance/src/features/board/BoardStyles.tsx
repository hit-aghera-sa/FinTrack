/**
 * The board lane's own styles.
 *
 * They ship as a `<style>` element rendered by the board screen itself, so
 * every class the board renders is guaranteed to resolve in the built app
 * without adding anything to the frozen `src/styles/` folder.
 *
 * Layout and spacing only: every colour is one of the app's existing
 * `var(--color-*)` tokens (or a shade derived from one with `color-mix`),
 * never a literal.
 */

const BOARD_CSS = `
.board-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.board-state {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-muted);
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  align-items: start;
}

/* THE THREE COLUMNS ARE BLUE. To do, Doing and Done each sit on a soft wash of
   the app's own brand blue with a blue edge, so the board reads as three blue
   columns rather than three grey panels. Every value is derived from the
   existing --color-primary / --color-surface / --color-border tokens, so both
   the light and the dark palette stay complete. */
.board-column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
}

.board-column-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
}

/* The column name itself — "To do", "Doing", "Done" — in the brand blue. */
.board-column-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-primary);
}

.board-column-count {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
  color: var(--color-primary);
  white-space: nowrap;
}

.board-column-stack {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 3rem;
}

.board-column-empty {
  font-size: 0.875rem;
  color: var(--color-muted);
  padding: 0.75rem;
  border: 1px dashed color-mix(in srgb, var(--color-primary) 25%, var(--color-border));
  border-radius: 10px;
  background: var(--color-surface);
}

/* THE TASK CARD IS BLUE. It is drawn in the app's own brand blue — a blue tint
   over the card surface, a blue edge, and a solid blue accent down the left
   side — instead of reading as the plain grey panel behind it. Every value is
   derived from the existing --color-primary / --color-surface tokens, so both
   the light and the dark palette stay complete. */
.board-task-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  border-left: 4px solid var(--color-primary);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-primary) 22%, var(--color-surface));
  color: var(--color-text);
}

/* The card's first row: the title, with the priority label and the checklist
   progress badge beside it. */
.board-task-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.board-task-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

/* The small done/total checklist badge, e.g. 2/5. */
.board-task-checklist {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-surface) 85%, transparent);
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.board-task-meta {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.board-task-meta-row {
  display: flex;
  gap: 0.375rem;
}

.board-task-meta dt {
  margin: 0;
  color: var(--color-muted);
}

.board-task-meta dd {
  margin: 0;
  color: var(--color-text);
}

.board-task-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.board-task-note {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-muted);
}

@media (max-width: 900px) {
  .board-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
`;

/** Renders the board lane's stylesheet. The board screen renders exactly one. */
export function BoardStyles(): JSX.Element {
  return <style>{BOARD_CSS}</style>;
}
