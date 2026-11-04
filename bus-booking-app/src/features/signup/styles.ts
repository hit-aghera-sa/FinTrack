/**
 * THE SIGN UP SCREEN'S OWN LAYOUT RULES.
 *
 * Shipped as a <style> element rendered beside the form, so every class the screen writes really
 * reaches the bundle. Colours are referenced only through the approved design tokens — nothing here
 * declares a colour of its own.
 */
export const SIGNUP_STYLES = `
.signup-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}
.signup-form-heading {
  margin: 0;
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 700;
}
.signup-form-intro {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--color-muted-foreground);
}
.signup-form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
.signup-form-hint {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--color-muted-foreground);
}
.signup-form-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
.signup-form-footnote {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--color-muted-foreground);
}
@media (min-width: 640px) {
  .signup-form-grid {
    grid-template-columns: 1fr 1fr;
  }
}
`;
