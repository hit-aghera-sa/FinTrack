/**
 * THE MY BOOKINGS LIST'S OWN RULES.
 *
 * Rendered as a `<style>` element by the screen itself, so every `mybookings-*` class the markup uses
 * really ships with this build. The approved page classes (`page-header`, `tabs`, `list-rows`,
 * `badge`, `text-strong`, `empty-state`) come from the project's own stylesheet and are not restated
 * here. Colours appear only as the approved `var(--color-*)` variables.
 */
export const MY_BOOKINGS_STYLES = `
.mybookings-screen {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.mybookings-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.mybookings-rows .list-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.mybookings-rows .list-row-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1 1 16rem;
  min-width: 0;
}
.mybookings-row-title-link {
  font-size: 1rem;
  font-weight: 600;
  color: inherit;
}
.mybookings-row-sub {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
}
.mybookings-row-amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
  margin-left: auto;
}
.mybookings-row-amount-label {
  font-size: 0.75rem;
  color: var(--color-muted-foreground);
}
.mybookings-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
}
.mybookings-badge.is-booked {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.mybookings-badge.is-cancelled {
  color: var(--color-error);
  background: color-mix(in srgb, var(--color-error) 6%, transparent);
  border-color: color-mix(in srgb, var(--color-error) 30%, transparent);
}
.mybookings-badge.is-completed {
  color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 6%, transparent);
  border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
}
.mybookings-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 0;
}
`;
