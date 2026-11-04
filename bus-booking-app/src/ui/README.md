# Shared UI kit & style guide

Everything a screen needs to look like part of this app. Import from the barrel:

```ts
import { Button, TextField, SelectField, Alert, Tabs, ConfirmDialog, Card, EmptyState, Spinner, theme } from '../../ui';
```

## Tokens

`theme` (`src/ui/tokens.ts`) is the only token source a lane needs. Every colour value is a reference
to a CSS variable from the approved palette — the palette itself is declared once in the project's
pinned stylesheets and is never restated here or anywhere else. Never write a hex, `rgb()`, `hsl()`
or a colour keyword in app code: take `theme.colour.*`, or derive a shade with
`color-mix(in srgb, var(--color-primary) 20%, transparent)`.

- `theme.colour` — background, surface, foreground, muted, mutedForeground, border, primary (+hover,
  active, subtle, foreground), secondary, accent, success, error and their foregrounds.
- `theme.space` — `xs` 0.25rem → `xxl` 2rem.
- `theme.radius` — `sm`, `md`, `lg`, `pill`.
- `theme.typography` — Inter, 16px body, steps from `caption` to `display`, weights and line heights.
- `theme.touchTarget` — 2.75rem, the smallest comfortable tap target on a phone.
- `theme.seat` / `seatStateToken(state)` — the seat map's three states.

### Seat states

| State | Surface | Text | Word shown |
| --- | --- | --- | --- |
| `available` | app background (white) | foreground | “Available” |
| `booked` | muted (grey) | muted foreground | “Booked” |
| `selected` | success (green) | success foreground (white) | “Selected” |

Each state carries a `label`. A seat must render that word — in its accessible name, its legend entry
or beside the seat — because state is never conveyed by colour alone.

## Contrast

All pairings in `theme` meet WCAG AA for body text on their own surface: foreground on background
(≈16:1), muted foreground on background (≈6.4:1), white on primary (≈5.6:1), white on success
(≈5.4:1), error text on background (≈4.8:1). If a screen needs a new pairing, check it before using
it — and give any colour-coded state an accompanying word, icon or shape.

## Components

- **Button** — `variant` primary | secondary | danger, `loading` blocks a double press and sets
  `aria-busy`.
- **TextField** — labelled input with its inline error (`aria-invalid` + `aria-describedby`); `tel`
  and `number` request the numeric keypad, `date` passes `min`/`max` to the platform picker.
- **SelectField** — labelled picker for security questions, From/To cities and boarding points.
- **Alert** — `kind` error | success | info; an icon and the kind word accompany the colour, errors
  announce as `role="alert"`.
- **Tabs** — segmented strip; the current tab is marked `aria-selected`.
- **Card** — content surface; pass `onClick` and the whole card becomes a real, focusable button.
- **ConfirmDialog** — Yes/No modal; renders nothing while `open` is false, `busy` blocks both answers.
- **EmptyState** — the app's shared nothing-to-show block, with an optional action.
- **Spinner** — the loading view: a ring plus its words, announced politely.

## Responsiveness

Rules are written mobile-first: 2.75rem controls and 16px field text on a phone (so Android browsers
never zoom on focus), dialog answers stacked full width below 30rem and side by side above it, and
motion reduced when the reader asks for it. Screen-specific rules belong in a `.css` file beside that
screen, never in a new shared stylesheet and never with a colour of its own.
