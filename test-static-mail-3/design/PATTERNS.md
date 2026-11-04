# Design base layer (GENERATED — F69)

- Import `design/tokens.css` then `design/base.css` ONCE at the app root, before any other styles.
- NEVER hardcode a color, font family, or radius — use the CSS variables from tokens.css.
  The design-fidelity gate fails the build on off-palette colors and off-scale typography.
- Primitives: `.btn-primary`, `.btn-secondary`, `.card`, `.input` — extend them; do not fork.
- Every data-driven surface renders exactly ONE of the six states:
  loading / empty / error / success / disabled / stale (the `.state-*` helpers).
- Exact per-screen geometry lives in `design/screens/<feature-slug>.json`
  (boxes are {x, y, w, h} in CSS pixels relative to the screen's top-left; match them).
- Touch targets: minimum 44×44px.
