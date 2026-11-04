/**
 * DESIGN TOKENS — the one visual language of the Bus Booking App.
 *
 * Every colour here is a reference to a CSS variable from the approved palette (declared once in the
 * project's pinned stylesheets). Nothing in this file states a colour of its own, so a screen that
 * reads a token can never drift away from the approved design.
 *
 * No business logic and no screens live here.
 */

/** The three states a seat on the seat map can be in. */
export type SeatState = 'available' | 'booked' | 'selected';

/**
 * How one seat state is drawn — plus the WORD that must accompany it. State is never conveyed by
 * colour alone: a seat renders its label (or an accessible name built from it) next to the colour.
 */
export interface SeatStateToken {
  readonly background: string;
  readonly foreground: string;
  readonly border: string;
  /** Human-readable name of the state, e.g. "Available". */
  readonly label: string;
}

/** Colour roles. All pairings below meet WCAG AA for body text (4.5:1) on their own background. */
export interface ColourTokens {
  readonly background: string;
  readonly surface: string;
  readonly foreground: string;
  readonly muted: string;
  readonly mutedForeground: string;
  readonly border: string;
  readonly primary: string;
  readonly primaryForeground: string;
  readonly primaryHover: string;
  readonly primaryActive: string;
  readonly primarySubtle: string;
  readonly secondary: string;
  readonly secondaryForeground: string;
  readonly accent: string;
  readonly accentForeground: string;
  readonly success: string;
  readonly successForeground: string;
  readonly error: string;
  readonly errorForeground: string;
}

/** Spacing scale, in rem so it scales with the reader's chosen text size. */
export interface SpaceTokens {
  readonly xs: string;
  readonly sm: string;
  readonly md: string;
  readonly lg: string;
  readonly xl: string;
  readonly xxl: string;
}

/** Corner radii. */
export interface RadiusTokens {
  readonly sm: string;
  readonly md: string;
  readonly lg: string;
  readonly pill: string;
}

/** Type steps sized for phone legibility (body stays at the 16px base). */
export interface TypographyTokens {
  readonly family: string;
  readonly size: {
    readonly caption: string;
    readonly body: string;
    readonly bodyLarge: string;
    readonly title: string;
    readonly heading: string;
    readonly display: string;
  };
  readonly weight: {
    readonly regular: number;
    readonly medium: number;
    readonly semibold: number;
    readonly bold: number;
  };
  readonly lineHeight: {
    readonly tight: number;
    readonly normal: number;
  };
}

/** The single object every other lane imports. */
export interface Theme {
  readonly colour: ColourTokens;
  readonly space: SpaceTokens;
  readonly radius: RadiusTokens;
  readonly typography: TypographyTokens;
  readonly seat: Readonly<Record<SeatState, SeatStateToken>>;
  /** Smallest comfortable touch target on a phone. */
  readonly touchTarget: string;
}

export const theme: Theme = {
  colour: {
    background: 'var(--color-background)',
    surface: 'var(--color-background)',
    foreground: 'var(--color-foreground)',
    muted: 'var(--color-muted)',
    mutedForeground: 'var(--color-muted-foreground)',
    border: 'var(--color-border)',
    primary: 'var(--color-primary)',
    primaryForeground: 'var(--color-primary-foreground)',
    primaryHover: 'var(--color-primary-hover)',
    primaryActive: 'var(--color-primary-active)',
    primarySubtle: 'var(--color-primary-subtle)',
    secondary: 'var(--color-secondary)',
    secondaryForeground: 'var(--color-secondary-foreground)',
    accent: 'var(--color-accent)',
    accentForeground: 'var(--color-accent-foreground)',
    success: 'var(--color-success)',
    successForeground: 'var(--color-success-foreground)',
    error: 'var(--color-error)',
    errorForeground: 'var(--color-error-foreground)',
  },
  space: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    xxl: '2rem',
  },
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    pill: '999px',
  },
  typography: {
    family: "'Inter', sans-serif",
    size: {
      caption: '0.75rem',
      body: '1rem',
      bodyLarge: '1.125rem',
      title: '1.25rem',
      heading: '1.5rem',
      display: '1.875rem',
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
    },
  },
  seat: {
    // Available seats read as plain paper: the app background with the normal border.
    available: {
      background: 'var(--color-background)',
      foreground: 'var(--color-foreground)',
      border: 'var(--color-border)',
      label: 'Available',
    },
    // Already booked seats are the flat grey surface and are never selectable.
    booked: {
      background: 'var(--color-muted)',
      foreground: 'var(--color-muted-foreground)',
      border: 'var(--color-border)',
      label: 'Booked',
    },
    // Seats this traveller has picked are the green success tone with white text (5.4:1).
    selected: {
      background: 'var(--color-success)',
      foreground: 'var(--color-success-foreground)',
      border: 'var(--color-success)',
      label: 'Selected',
    },
  },
  touchTarget: '2.75rem',
};

/** The drawing instructions plus the word for one seat state. */
export function seatStateToken(state: SeatState): SeatStateToken {
  return theme.seat[state];
}

/** Every seat state in the order the seat-map legend lists them. */
export const SEAT_STATES: readonly SeatState[] = ['available', 'booked', 'selected'];
