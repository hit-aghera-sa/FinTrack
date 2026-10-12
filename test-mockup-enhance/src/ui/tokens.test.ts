import { describe, expect, it } from "vitest";
import {
  ACCESSIBLE_PAIRS,
  BASE_FONT_SIZE_TOKEN,
  COLOR_TOKENS,
  FONT_FAMILY_TOKEN,
  RADIUS_TOKENS,
  SPACE_TOKENS,
  bodyTextPairs,
  colorToken,
  fontSizeToken,
  radiusToken,
  spaceToken,
} from "./tokens.js";
import type { ColorToken, TokenPair } from "./tokens.js";

describe("design token helpers", () => {
  it("renders colour tokens as theme custom properties", () => {
    expect(colorToken("primary")).toBe("var(--color-primary)");
    expect(colorToken("muted-foreground")).toBe("var(--color-muted-foreground)");
  });

  it("renders spacing, radius and type tokens from the ui scale", () => {
    expect(spaceToken("md")).toBe("var(--ui-space-md)");
    expect(radiusToken("pill")).toBe("var(--ui-radius-pill)");
    expect(fontSizeToken("sm")).toBe("var(--ui-font-size-sm)");
    expect(FONT_FAMILY_TOKEN).toBe("var(--ui-font-family)");
    expect(BASE_FONT_SIZE_TOKEN).toBe("var(--ui-font-size-base)");
  });

  it("never emits a literal colour value", () => {
    const emitted = COLOR_TOKENS.map((token: ColorToken) => colorToken(token));
    for (const value of emitted) {
      expect(value.startsWith("var(--color-")).toBe(true);
      expect(/#|rgb|hsl/i.test(value)).toBe(false);
    }
  });

  it("lists each scale once", () => {
    expect(new Set(COLOR_TOKENS).size).toBe(COLOR_TOKENS.length);
    expect(SPACE_TOKENS).toEqual(["xs", "sm", "md", "lg", "xl"]);
    expect(RADIUS_TOKENS).toEqual(["sm", "md", "pill"]);
  });
});

describe("accessible pairings", () => {
  it("only references declared colour tokens", () => {
    for (const pair of ACCESSIBLE_PAIRS) {
      expect(COLOR_TOKENS).toContain(pair.background);
      expect(COLOR_TOKENS).toContain(pair.foreground);
    }
  });

  it("keeps every body-text pairing at WCAG AA or better", () => {
    const pairs = bodyTextPairs();
    expect(pairs.length).toBeGreaterThan(0);
    for (const pair of pairs) {
      expect(pair.minimumRatio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("flags the sub-4.5:1 pairing as large text only", () => {
    const flagged = ACCESSIBLE_PAIRS.filter((pair: TokenPair) => pair.minimumRatio < 4.5);
    expect(flagged.length).toBeGreaterThan(0);
    for (const pair of flagged) {
      expect(pair.largeTextOnly).toBe(true);
      expect(pair.minimumRatio).toBeGreaterThanOrEqual(3);
    }
  });
});
