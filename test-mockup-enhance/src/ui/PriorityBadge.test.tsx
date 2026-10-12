// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PriorityBadge } from "./PriorityBadge.js";
import { PRIORITY_LABELS, PRIORITY_LEVELS, prioritySlug } from "./priority.js";
import type { PriorityLevel } from "./priority.js";

afterEach(() => {
  cleanup();
});

describe("PriorityBadge", () => {
  it("renders the priority name", () => {
    render(<PriorityBadge priority="High" />);
    expect(screen.getByText("High")).toBeTruthy();
  });

  it("carries the level's own colour class and data attribute", () => {
    for (const level of PRIORITY_LEVELS) {
      cleanup();
      render(<PriorityBadge priority={level} />);
      const text = screen.getByText(PRIORITY_LABELS[level]);
      const badge = text.parentElement;
      expect(badge).not.toBeNull();
      expect(badge?.className).toBe(
        `ui-priority-badge ui-priority-badge--${prioritySlug(level)}`,
      );
      expect(badge?.getAttribute("data-priority")).toBe(prioritySlug(level));
    }
  });

  it("gives each level a different colour class", () => {
    const classes = PRIORITY_LEVELS.map((level: PriorityLevel) => {
      cleanup();
      render(<PriorityBadge priority={level} />);
      return screen.getByText(PRIORITY_LABELS[level]).parentElement?.className ?? "";
    });
    expect(new Set(classes).size).toBe(PRIORITY_LEVELS.length);
  });

  it("shows a shape beside the name, so colour is never the only signal", () => {
    render(<PriorityBadge priority="Medium" />);
    const badge = screen.getByText("Medium").parentElement;
    const mark = badge?.querySelector(".ui-priority-badge__mark");
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
  });

  it("prefixes the level when a label is given", () => {
    render(<PriorityBadge priority="Low" label="Priority" />);
    expect(screen.getByText("Priority: Low")).toBeTruthy();
  });

  it("spells the level out in its tooltip for every level", () => {
    for (const level of PRIORITY_LEVELS) {
      cleanup();
      const current: PriorityLevel = level;
      render(<PriorityBadge priority={current} />);
      const badge = screen.getByText(PRIORITY_LABELS[current]).parentElement;
      expect(badge?.getAttribute("title")).toBe(`Priority: ${PRIORITY_LABELS[current]}`);
    }
  });
});
