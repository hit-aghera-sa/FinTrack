/**
 * THE PASSENGER DETAILS SCREEN'S OWN STYLES, shipped as a `<style>` element beside the screen so the
 * rules always travel with the markup that uses them.
 *
 * Colour comes only from the app's existing `--color-*` variables (and `color-mix` of them), and the
 * type scale stays on the app's 14 / 16 / 18 steps.
 */
export const PASSENGER_DETAILS_STYLES = `
.pd-screen {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 760px;
}

.pd-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.pd-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-background);
}

.pd-section-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.4;
  color: var(--color-foreground);
}

.pd-seat-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pd-seat-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-muted) 70%, transparent);
}

.pd-seat-heading {
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  color: var(--color-foreground);
}

.pd-seat-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.pd-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
}

.pd-summary-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.pd-summary-row + .pd-summary-row {
  border-top: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  padding-top: 10px;
}

.pd-summary-label {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-muted-foreground);
}

.pd-summary-value {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 600;
  text-align: right;
  color: var(--color-foreground);
}

.pd-summary-row.is-total .pd-summary-value {
  font-size: 18px;
  color: var(--color-primary);
}

.pd-note {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-muted-foreground);
}

.pd-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
`;
