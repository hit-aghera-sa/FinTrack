import { describe, expect, it } from "vitest";

import {
  DEFAULT_LABEL_COLOR,
  LABEL_COLORS,
  isLabelColor,
  labelColorClass,
  labelColorName,
} from "./labels.js";

describe("label colour palette", () => {
  it("offers the six colours the create-label control shows", () => {
    expect(LABEL_COLORS.map((option) => option.id)).toEqual([
      "primary",
      "info",
      "success",
      "warning",
      "danger",
      "neutral",
    ]);
  });

  it("starts a new label on a colour that is in the palette", () => {
    expect(DEFAULT_LABEL_COLOR).toBe("primary");
    expect(LABEL_COLORS.some((option) => option.id === DEFAULT_LABEL_COLOR)).toBe(true);
  });

  it("recognises only the palette's colours", () => {
    expect(isLabelColor("danger")).toBe(true);
    expect(isLabelColor("Danger")).toBe(false);
    expect(isLabelColor("purple")).toBe(false);
    expect(isLabelColor(undefined)).toBe(false);
    expect(isLabelColor(3)).toBe(false);
  });

  it("turns a colour into the chip class the stylesheet ships", () => {
    expect(labelColorClass("danger")).toBe("label-chip--danger");
    expect(labelColorClass(DEFAULT_LABEL_COLOR)).toBe("label-chip--primary");
  });

  it("names every colour, and nothing else", () => {
    expect(labelColorName("success")).toBe("Green");
    expect(labelColorName("neutral")).toBe("Grey");
    for (const option of LABEL_COLORS) {
      expect(labelColorName(option.id)).toBe(option.name);
    }
  });
});
