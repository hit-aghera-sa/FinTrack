import { describe, expect, it } from "vitest";

import {
  MIN_VISIBLE_BAR_PERCENT,
  barWidthPercent,
  barWidthStyle,
  formatGeneratedAt,
  isOverdueHighlighted,
  largestTotal,
  overdueLabel,
  totalLabel,
} from "./reportsModel.js";

describe("largestTotal", () => {
  it("is zero for an empty roster", () => {
    expect(largestTotal([])).toBe(0);
  });

  it("is the biggest total in the report", () => {
    expect(largestTotal([0, 3, 7, 2])).toBe(7);
  });

  it("ignores values that are not finite numbers", () => {
    expect(largestTotal([2, Number.NaN, 5, Number.POSITIVE_INFINITY])).toBe(5);
  });
});

describe("barWidthPercent", () => {
  it("draws the busiest member at full width", () => {
    expect(barWidthPercent(7, 7)).toBe(100);
  });

  it("draws every other member in proportion to the busiest one", () => {
    expect(barWidthPercent(5, 10)).toBe(50);
    expect(barWidthPercent(3, 4)).toBe(75);
    expect(barWidthPercent(1, 8)).toBe(13);
  });

  it("draws no bar for a member with no tasks", () => {
    expect(barWidthPercent(0, 9)).toBe(0);
  });

  it("draws no bar when nothing in the report has a total", () => {
    expect(barWidthPercent(0, 0)).toBe(0);
    expect(barWidthPercent(2, 0)).toBe(0);
  });

  it("keeps a tiny share visible rather than drawing nothing", () => {
    expect(barWidthPercent(1, 200)).toBe(MIN_VISIBLE_BAR_PERCENT);
  });
});

describe("barWidthStyle", () => {
  it("renders the width as a CSS percentage", () => {
    expect(barWidthStyle(5, 10)).toBe("50%");
    expect(barWidthStyle(10, 10)).toBe("100%");
    expect(barWidthStyle(0, 10)).toBe("0%");
  });
});

describe("overdue presentation", () => {
  it("highlights only a positive overdue count", () => {
    expect(isOverdueHighlighted(0)).toBe(false);
    expect(isOverdueHighlighted(1)).toBe(true);
    expect(isOverdueHighlighted(4)).toBe(true);
  });

  it("pairs the highlight with wording, so colour is never the only signal", () => {
    expect(overdueLabel(0)).toBe("None overdue");
    expect(overdueLabel(1)).toBe("1 overdue");
    expect(overdueLabel(3)).toBe("3 overdue");
  });
});

describe("totalLabel", () => {
  it("reads naturally for none, one and many", () => {
    expect(totalLabel(0)).toBe("No tasks");
    expect(totalLabel(1)).toBe("1 task");
    expect(totalLabel(6)).toBe("6 tasks");
  });
});

describe("formatGeneratedAt", () => {
  it("returns a value it cannot read unchanged", () => {
    expect(formatGeneratedAt("not a timestamp")).toBe("not a timestamp");
  });

  it("renders a real timestamp as something readable", () => {
    const rendered = formatGeneratedAt("2026-02-18T09:30:00.000Z");
    expect(rendered).not.toBe("");
    expect(rendered).not.toBe("2026-02-18T09:30:00.000Z");
  });
});
