import { describe, expect, it } from "vitest";

import {
  DEFAULT_TASK_ACTIVITY_KIND,
  TASK_ACTIVITY_KINDS,
  TASK_ACTIVITY_KIND_LABELS,
  isTaskActivityKind,
  taskActivityKindLabel,
  type TaskActivityKind,
} from "./activity.js";

describe("task activity kinds", () => {
  it("lists the kinds a feed can hold", () => {
    expect(TASK_ACTIVITY_KINDS).toEqual([
      "created",
      "updated",
      "status_changed",
      "priority_changed",
      "assignee_changed",
      "due_date_changed",
      "labels_changed",
      "commented",
    ]);
  });

  it("labels every kind", () => {
    for (const kind of TASK_ACTIVITY_KINDS) {
      expect(TASK_ACTIVITY_KIND_LABELS[kind]).not.toBe("");
    }
    expect(TASK_ACTIVITY_KIND_LABELS.status_changed).toBe("Status changed");
    expect(TASK_ACTIVITY_KIND_LABELS.commented).toBe("Commented");
  });

  it("keeps the fallback kind inside the list", () => {
    expect(DEFAULT_TASK_ACTIVITY_KIND).toBe("updated");
    expect(TASK_ACTIVITY_KINDS).toContain(DEFAULT_TASK_ACTIVITY_KIND);
  });

  it("recognises only the known kinds", () => {
    expect(isTaskActivityKind("created")).toBe(true);
    expect(isTaskActivityKind("Created")).toBe(false);
    expect(isTaskActivityKind("archived")).toBe(false);
    expect(isTaskActivityKind(undefined)).toBe(false);
    expect(isTaskActivityKind(7)).toBe(false);
  });

  it("returns an empty label for an unknown kind", () => {
    const known: TaskActivityKind = "labels_changed";
    expect(taskActivityKindLabel(known)).toBe("Labels changed");
    expect(taskActivityKindLabel("nope")).toBe("");
  });
});
