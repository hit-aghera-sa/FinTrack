/**
 * Styles for this lane's control components.
 *
 * They ship as a <style> element rendered beside the components so every className
 * the controls render resolves to a rule that is really in the bundle, without this
 * lane writing into the shared stylesheet directory it does not own.
 *
 * Every colour value is a PINNED design token custom property, with the pinned hex
 * value of that same token as the fallback, so the rendered colour is always inside
 * the approved palette even if a token name is absent. No colour outside the pinned
 * palette is used (neutral shadow alphas excepted).
 *
 * TYPE SCALE: every declared font-size resolves to the pinned 16px base
 * (`var(--font-size-md, 1rem)`). The 14px / 0.875rem step is deliberately NOT used
 * anywhere in this lane — it is off the pinned type scale and was filed as a
 * design-fidelity defect.
 */
import { createElement, type ReactElement } from 'react';

export const CONTROLS_CSS = `
.controls-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.controls-add {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  width: 100%;
}

.controls-add__input {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--font-size-md, 1rem);
  line-height: var(--line-height-md, 1.5);
  color: var(--color-foreground, #1A1A1A);
  background: var(--color-background, #FFFFFF);
  border: 1px solid var(--color-border, #E5E7EB);
}

.controls-add__submit {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: var(--font-size-md, 1rem);
  line-height: var(--line-height-md, 1.5);
}

.controls-add__submit[disabled],
.controls-filterbar__button[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
}

.controls-filterbar {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  flex-wrap: wrap;
}

.controls-filterbar__button {
  flex: 0 0 auto;
  font-size: var(--font-size-md, 1rem);
  line-height: var(--line-height-md, 1.5);
}

.controls-filterbar__button[aria-pressed='true'] {
  border-color: var(--color-primary, #1B2A4A);
  font-weight: var(--font-weight-bold, 600);
  box-shadow: inset 0 -2px 0 0 var(--color-primary, #1B2A4A);
}

.controls-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2, 8px);
  padding-top: var(--space-3, 12px);
  border-top: 1px solid var(--color-border, #E5E7EB);
}

.controls-footer__summary {
  margin: 0;
  color: var(--color-mutedforeground, #595F69);
  font-size: var(--font-size-md, 1rem);
  line-height: var(--line-height-md, 1.5);
}

.controls-error {
  margin: 0 0 var(--space-3, 12px) 0;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border-radius: var(--radius-md, 10px);
  border: 1px solid var(--color-error, #DC2626);
  color: var(--color-error, #DC2626);
  background: var(--color-background, #FFFFFF);
  font-size: var(--font-size-md, 1rem);
  line-height: var(--line-height-md, 1.5);
  font-weight: var(--font-weight-bold, 600);
}

.controls-empty {
  margin: 0;
  padding: var(--space-6, 32px) var(--space-3, 12px);
  text-align: center;
  color: var(--color-mutedforeground, #595F69);
  font-size: var(--font-size-md, 1rem);
  line-height: var(--line-height-md, 1.5);
}
`;

/** Renders the control styles into the document. Safe to render more than once. */
export function ControlStyles(): ReactElement {
  return createElement('style', null, CONTROLS_CSS);
}
