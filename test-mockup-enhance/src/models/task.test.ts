import { describe, expect, it } from "vitest";

import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  isTaskStatus,
  taskStatusLabel,
} from "./task.js";

describe("task status model", () => {
  it("lists the three statuses in board order", () => {
    expect(TASK_STATUSES).toEqual(["todo", "doing", "done"]);
  });

  it("labels every status", () => {
    expect(TASK_STATUS_LABELS.todo).toBe("To do");
    expect(TASK_STATUS_LABELS.doing).toBe("Doing");
    expect(TASK_STATUS_LABELS.done).toBe("Done");
  });

  it("defaults new tasks to the first column", () => {
    expect(DEFAULT_TASK_STATUS).toBe("todo");
    expect(TASK_STATUSES[0]).toBe(DEFAULT_TASK_STATUS);
  });

  it("recognises only the known statuses", () => {
    expect(isTaskStatus("doing")).toBe(true);
    expect(isTaskStatus("Doing")).toBe(false);
    expect(isTaskStatus("archived")).toBe(false);
    expect(isTaskStatus(undefined)).toBe(false);
    expect(isTaskStatus(3)).toBe(false);
  });

  it("returns an empty label for an unknown status", () => {
    expect(taskStatusLabel("done")).toBe("Done");
    expect(taskStatusLabel("nope")).toBe("");
  });
});

describe("task priority model", () => {
  it("lists the three priorities in order", () => {
    expect(TASK_PRIORITIES).toEqual(["Low", "Medium", "High"]);
  });

  it("defaults a new task to Medium", () => {
    expect(DEFAULT_TASK_PRIORITY).toBe("Medium");
  });

  it("keeps the default inside the ordered list", () => {
    expect(TASK_PRIORITIES).toContain(DEFAULT_TASK_PRIORITY);
    expect(TASK_PRIORITIES[1]).toBe(DEFAULT_TASK_PRIORITY);
  });
});
