/**
 * Typed mirror of the design tokens.
 *
 * Colour tokens are declared in the frozen `src/styles/theme.css`; the spacing,
 * radius and typography tokens are declared in `./tokens.css`. These helpers
 * let a screen reference a token from TypeScript (for an inline `style`, say)
 * without ever typing a raw colour value.
 */

export type ColorToken =
  | "background"
  | "foreground"
  | "muted"
  | "muted-foreground"
  | "border"
  | "primary"
  | "primary-foreground"
  | "primary-hover"
  | "primary-active"
  | "primary-subtle"
  | "secondary"
  | "secondary-foreground"
  | "accent"
  | "accent-foreground"
  | "success"
  | "success-foreground"
  | "error"
  | "error-foreground";

export type SpaceToken = "xs" | "sm" | "md" | "lg" | "xl";

export type RadiusToken = "sm" | "md" | "pill";

export type FontSizeToken = "xs" | "sm" | "md" | "lg" | "xl";

export const COLOR_TOKENS: readonly ColorToken[] = [
  "background",
  "foreground",
  "muted",
  "muted-foreground",
  "border",
  "primary",
  "primary-foreground",
  "primary-hover",
  "primary-active",
  "primary-subtle",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "success",
  "success-foreground",
  "error",
  "error-foreground",
];

export const SPACE_TOKENS: readonly SpaceToken[] = ["xs", "sm", "md", "lg", "xl"];

export const RADIUS_TOKENS: readonly RadiusToken[] = ["sm", "md", "pill"];

export const FONT_SIZE_TOKENS: readonly FontSizeToken[] = ["xs", "sm", "md", "lg", "xl"];

/** `colorToken("primary")` -> `"var(--color-primary)"`. */
export function colorToken(name: ColorToken): string {
  return `var(--color-${name})`;
}

/** `spaceToken("md")` -> `"var(--ui-space-md)"`. */
export function spaceToken(name: SpaceToken): string {
  return `var(--ui-space-${name})`;
}

/** `radiusToken("pill")` -> `"var(--ui-radius-pill)"`. */
export function radiusToken(name: RadiusToken): string {
  return `var(--ui-radius-${name})`;
}

/** `fontSizeToken("sm")` -> `"var(--ui-font-size-sm)"`. */
export function fontSizeToken(name: FontSizeToken): string {
  return `var(--ui-font-size-${name})`;
}

export const FONT_FAMILY_TOKEN = "var(--ui-font-family)";

export const BASE_FONT_SIZE_TOKEN = "var(--ui-font-size-base)";

/**
 * A text/background pairing that has been checked for contrast.
 * `minimumRatio` is the measured ratio of the light palette; a pair marked
 * `largeTextOnly` only clears WCAG AA at >=24px, or >=18.66px bold (3:1), so it
 * must never be used for body copy.
 */
export interface TokenPair {
  readonly background: ColorToken;
  readonly foreground: ColorToken;
  readonly minimumRatio: number;
  readonly largeTextOnly?: boolean;
}

export const ACCESSIBLE_PAIRS: readonly TokenPair[] = [
  { background: "background", foreground: "foreground", minimumRatio: 17.4 },
  { background: "background", foreground: "muted-foreground", minimumRatio: 6.2 },
  { background: "background", foreground: "primary", minimumRatio: 13.3 },
  { background: "background", foreground: "error", minimumRatio: 4.8 },
  { background: "muted", foreground: "foreground", minimumRatio: 16.2 },
  { background: "muted", foreground: "muted-foreground", minimumRatio: 5.8 },
  { background: "primary", foreground: "primary-foreground", minimumRatio: 13.3 },
  { background: "primary-subtle", foreground: "primary", minimumRatio: 10.9 },
  { background: "secondary", foreground: "secondary-foreground", minimumRatio: 9.6 },
  { background: "accent", foreground: "accent-foreground", minimumRatio: 6.3 },
  { background: "success", foreground: "success-foreground", minimumRatio: 4.8 },
  { background: "error", foreground: "error-foreground", minimumRatio: 4.0, largeTextOnly: true },
];

/** The approved pairings that are safe for normal-size body text. */
export function bodyTextPairs(): readonly TokenPair[] {
  return ACCESSIBLE_PAIRS.filter((pair: TokenPair) => pair.largeTextOnly !== true);
}
