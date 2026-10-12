# Style guide — Test mockup enhance

The visual language of the app. Everything here is presentation only: this lane
owns no routes and no data access.

## 1. Where colour lives

Every colour of the app is a `--color-*` custom property in the frozen
`src/styles/theme.css` (light and dark). **Never** write a hex value, `rgb()`,
`hsl()` or a colour keyword in a stylesheet, an inline `style` or an SVG
`fill`/`stroke`, and never declare a new `--color-*`. If a shade is missing,
derive it: `color-mix(in srgb, var(--color-error) 8%, var(--color-background))`.

From TypeScript use `colorToken("primary")` (from `./tokens.ts`), which returns
`var(--color-primary)`.

## 2. Non-colour tokens (`src/ui/tokens.css`)

| Group | Tokens |
| --- | --- |
| Type | `--ui-font-family` (Inter), `--ui-font-size-base` (16px), `--ui-font-size-xs…xl`, `--ui-font-weight-regular/medium/bold`, `--ui-line-height-tight/body` |
| Space | `--ui-space-xs` 4px, `sm` 8px, `md` 16px, `lg` 24px, `xl` 40px |
| Radius | `--ui-radius-sm` 6px, `--ui-radius-md` 10px, `--ui-radius-pill` |
| Lines | `--ui-border-width` 1px, `--ui-accent-width` 4px |
| Status | `--ui-status-{todo,doing,done,neutral}-{surface,ink,accent}` |

Layout helpers: `.ui-stack`, `.ui-stack-lg`, `.ui-row`, `.ui-row-between`,
`.ui-columns-2`, `.ui-columns-3`. The grids are desktop-first: three columns
become two at 1024px and one at 720px, which is the "basic responsive" bonus the
client asked for (CL-4).

## 3. Status accents (To do / Doing / Done)

Status is **never** communicated by colour alone. `statusAccent(status)` returns
a tone, a label, a shape glyph (`○` / `◐` / `●`) and the CSS class carrying the
tone's tokens; `StatusChip` renders all three. Unknown values resolve to the
`neutral` tone and print the raw value, so no state is silently hidden.

| Tone | Surface | Ink | Contrast |
| --- | --- | --- | --- |
| To do | `--color-muted` | `--color-foreground` | 16.2:1 |
| Doing | `--color-accent` | `--color-accent-foreground` | 6.3:1 |
| Done | `--color-success` | `--color-success-foreground` | 4.8:1 |

## 4. Contrast rules (WCAG AA)

`ACCESSIBLE_PAIRS` in `src/ui/tokens.ts` lists the approved text/background
pairings with their measured ratios. Every pair clears 4.5:1 except
`error-foreground` on `error` (4.0:1), which is marked `largeTextOnly` — so the
error banner paints **error ink on an 8% error tint** instead of white on red,
and reserves the solid error fill for borders and large glyphs. Use
`bodyTextPairs()` when picking a pairing for body copy.

## 5. Primitives

| Import | Notes |
| --- | --- |
| `Button`, `buttonClass` | variants `primary` / `secondary` / `danger` / `ghost` |
| `TextField`, `TextAreaField`, `SelectField`, `CheckboxField` | label + hint + error |
| `Card`, `PageHeader` | surfaces and in-page headings |
| `NavBar` | **secondary, in-page** navigation; the app shell draws the site header itself. Active entry gets `aria-current="page"`, bold weight and an underline |
| `ErrorBanner` | `{ message, onRetry? }`, `role="alert"`, glyph + "Something went wrong" + optional Retry |
| `StatusChip` | status pill described above |

`Button`, the fields, `Card` and `PageHeader` are re-exports of the fixed kit in
`src/components/`: import them through `src/ui` for a single stable surface, and
never reimplement one. A component the kit lacks is built in the owning lane's
folder from these pieces, styled only with the classes in `src/styles/app.css`
(`.form`, `.form-row`, `.form-actions`, `.notice`, `.data-table`, `.table-card`,
`.toolbar`, `.stat-grid`, `.detail-list`, `.input`, `.select`, `.textarea`,
`.text-link`, `.text-muted`) and the tokens above, with its own `.css` file
beside it.
