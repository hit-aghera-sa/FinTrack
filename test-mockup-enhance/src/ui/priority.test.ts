import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRIORITY,
  PRIORITY_LABELS,
  PRIORITY_LEVELS,
  isPriorityLevel,
  priorityBadgeClass,
  priorityInkToken,
  priorityLabel,
  prioritySlug,
  prioritySurfaceToken,
} from "./priority.js";
import type { PriorityLevel } from "./priority.js";
import {
  DEFAULT_TASK_PRIORITY,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
} from "../models/task.js";

describe("priority vocabulary", () => {
  it("is the shared task-priority list, not a copy of it", () => {
    expect(PRIORITY_LEVELS).toEqual(TASK_PRIORITIES);
    expect(PRIORITY_LABELS).toEqual(TASK_PRIORITY_LABELS);
    expect(DEFAULT_PRIORITY).toBe(DEFAULT_TASK_PRIORITY);
  });

  it("lists the three levels in display order", () => {
    expect(PRIORITY_LEVELS).toEqual(["Low", "Medium", "High"]);
  });

  it("labels every level", () => {
    expect(PRIORITY_LABELS.Low).toBe("Low");
    expect(PRIORITY_LABELS.Medium).toBe("Medium");
    expect(PRIORITY_LABELS.High).toBe("High");
  });

  it("defaults to Medium", () => {
    expect(DEFAULT_PRIORITY).toBe("Medium");
    expect(PRIORITY_LEVELS).toContain(DEFAULT_PRIORITY);
  });

  it("recognises only the three levels", () => {
    expect(isPriorityLevel("Low")).toBe(true);
    expect(isPriorityLevel("High")).toBe(true);
    expect(isPriorityLevel("high")).toBe(false);
    expect(isPriorityLevel("Urgent")).toBe(false);
    expect(isPriorityLevel(undefined)).toBe(false);
    expect(isPriorityLevel(2)).toBe(false);
  });

  it("returns an empty label for an unknown level", () => {
    expect(priorityLabel("Medium")).toBe("Medium");
    expect(priorityLabel("nope")).toBe("");
  });
});

describe("priority tokens", () => {
  it("slugs each level for use in a class or property name", () => {
    expect(prioritySlug("Low")).toBe("low");
    expect(prioritySlug("Medium")).toBe("medium");
    expect(prioritySlug("High")).toBe("high");
  });

  it("names a custom property for every level, never a literal colour", () => {
    for (const level of PRIORITY_LEVELS) {
      const slug = prioritySlug(level);
      const surface = prioritySurfaceToken(level);
      const ink = priorityInkToken(level);
      expect(surface).toBe(`var(--ui-priority-${slug}-surface)`);
      expect(ink).toBe(`var(--ui-priority-${slug}-ink)`);
      expect(/#|rgb|hsl/i.test(surface)).toBe(false);
      expect(/#|rgb|hsl/i.test(ink)).toBe(false);
    }
  });

  it("builds a distinct badge class list for every level", () => {
    expect(priorityBadgeClass("High")).toBe("ui-priority-badge ui-priority-badge--high");
    const classes = PRIORITY_LEVELS.map((level: PriorityLevel) => priorityBadgeClass(level));
    expect(new Set(classes).size).toBe(PRIORITY_LEVELS.length);
  });
});
