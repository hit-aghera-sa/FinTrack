# Design base layer (GENERATED — F69)

- Import `design/tokens.css` then `design/base.css` ONCE at the app root, before any other styles.
- NEVER hardcode a color, font family, or radius — use the CSS variables from tokens.css.
  The design-fidelity gate reports off-palette colors and FAILS the build on off-scale typography.
- THE PALETTE COMES FROM THE STARTER TEMPLATE (react-site-bookings). Its stylesheet under
  `src/styles/` is FROZEN: writes there are refused, and so is creating a new file inside it.
  `tokens.css` here is a COPY of that palette, provided so you can read the values; the
  template is the source. Style with `var(--color-*)`. NEVER declare a `--color-*` anywhere,
  NEVER author a second token file, and do NOT introduce a CSS framework — a later declaration
  overrides the template and the app ships the wrong colours. If a screen needs rules of its
  own, put a stylesheet BESIDE THAT SCREEN and import it there.
- Primitives: `.btn-primary`, `.btn-secondary`, `.card`, `.input` — extend them; do not fork.
- Every data-driven surface renders exactly ONE of the six states:
  loading / empty / error / success / disabled / stale (the `.state-*` helpers).
- Exact per-screen geometry lives in `design/screens/<feature-slug>.json`
  (boxes are {x, y, w, h} in CSS pixels relative to the screen's top-left; match them).
- Touch targets: minimum 44×44px.
