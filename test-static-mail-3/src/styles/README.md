# QuickList - visual design system

CSS only. No TypeScript, no components. Frontend lanes consume the class names
below and must not introduce new colour literals.

## Files

| File | Purpose |
| --- | --- |
| `tokens.css` | `:root` custom properties - pinned palette, spacing, typography, radii, elevation, layout, motion. |
| `quicklist.css` | The application stylesheet (reset + one-screen data-table layout + class contract). |
| `index.css` | Canonical entry point. `app.css` / `main.css` are aliases of it. |

Usage from the app entry module:

```ts
import './styles/index.css';
```

## Class-name contract (stable)

| Class | Applies to |
| --- | --- |
| `quicklist-app` | Root page shell (centred column, max width `--layout-max-width`). |
| `quicklist-header` / `quicklist-title` / `quicklist-subtitle` | Heading block. |
| `quicklist-input-row` (or `quicklist-form`) | The add-task row. |
| `quicklist-input` | The new-task text field. Add `is-invalid` or `aria-invalid="true"` for the error state. |
| `quicklist-add` (or `quicklist-button`) | Primary action button beside the input. |
| `quicklist-filter-row` (or `quicklist-filters`) | The filter row wrapper. |
| `quicklist-filter` | A single filter control. |
| `is-selected` | Modifier on the active `quicklist-filter` (also honours `aria-pressed="true"` / `aria-current="true"`). |
| `quicklist-list` / `quicklist-table` | The task table container (`ul`, `div` or `table` all work). |
| `quicklist-list-head` | Optional column-header strip (Status / Task / Action). |
| `task-row` | One task row - 3-column grid (toggle, label, remove); renders as a table row when used on `tr`. |
| `task-label` / `task-title` | The task text inside a row. |
| `task-done` | Completed modifier - strikethrough + muted colour (put it on the row or the label). |
| `task-remove` | Small secondary remove control (transparent, bordered, danger on hover). |
| `quicklist-empty` | Empty-state block when no rows match the active filter. |
| `quicklist-error` | Inline error line (hidden automatically when empty or `hidden`). |
| `quicklist-footer` | Summary line under the table (`quicklist-count`, `quicklist-status-done` helpers). |
| `visually-hidden` | Screen-reader-only text utility. |

## Colour pairings (WCAG AA verified)

All body text meets or exceeds 4.5:1 against the pinned palette.

| Foreground | Background | Ratio | Use |
| --- | --- | --- | --- |
| `--color-foreground` | `--color-background` | ~17.4:1 | Body & task text |
| `--color-primary` | `--color-background` | ~13.7:1 | Headings |
| `--color-primaryforeground` | `--color-primary` | ~13.7:1 | Primary button, selected filter |
| `--color-secondaryforeground` | `--color-secondary` | ~9.9:1 | Primary button hover |
| `--color-mutedforeground` | `--color-background` | ~6.4:1 | Secondary/footer text, done tasks, remove control |
| `--color-mutedforeground` | `--color-muted` | ~5.9:1 | Empty state, table header strip |
| `--color-error` | `--color-background` | ~4.8:1 | Error line text, hovered remove control |
| `--color-errorforeground` | `--color-error` | ~4.8:1 | Error badge, pressed remove control |
| `--color-success` | `--color-background` | ~4.9:1 | Completed count in the footer |
| `--color-accentforeground` | `--color-accent` | ~8.1:1 | Accent chips, if used |

Status is never colour-only: the error line also carries a 3px left rule (and
optionally `quicklist-error-badge`); the selected filter changes fill, font
weight and elevation, not just hue; a done task is struck through.

## Rules for downstream lanes

1. Never hardcode a hex colour - use `var(--color-*)`. The `test:visual-diff`
   gate (`scripts/check-tokens.mjs`) fails the build on any unknown literal.
   Neutral `rgba(0,0,0,a)` / `rgba(255,255,255,a)` shadow alphas are allowed.
2. Spacing uses the `--space-*` scale; type uses `--font-size-*` /
   `--font-weight-*`.
3. Keyboard focus is provided globally by `:focus-visible` - do not remove it.
