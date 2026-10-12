// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  CHECKLIST_API_PATHS,
  CHECKLIST_ROUTE_PATHS,
  CHECKLIST_SUMMARY_QUERY_PARAM,
  MAX_CHECKLIST_TITLE_LENGTH,
  checklistItemUrl,
  checklistProgressLabel,
  checklistSummaryUrl,
  compareChecklistItems,
  countChecklistProgress,
  normaliseChecklistTitle,
  parseChecklistTaskIds,
  taskChecklistUrl,
  uniqueTaskIds,
  type ChecklistItem,
} from "./index.js";
import { API_PREFIX } from "../../shared/api-paths.js";

function item(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  const base: ChecklistItem = {
    id: "checklist-one",
    taskId: "task-one",
    title: "Draft the Alex QA brief",
    done: false,
    position: 1,
    createdAt: "2026-03-01T09:00:00.000Z",
  };
  return { ...base, ...overrides };
}

describe("the checklist route table", () => {
  it("names the three route templates once, relative to the API scope", () => {
    expect(CHECKLIST_ROUTE_PATHS.items).toBe("/tasks/:taskId/checklist");
    expect(CHECKLIST_ROUTE_PATHS.item).toBe("/tasks/:taskId/checklist/:itemId");
    expect(CHECKLIST_ROUTE_PATHS.summary).toBe("/checklist/summary");
  });

  it("addresses one task's checklist and one item of it", () => {
    expect(CHECKLIST_API_PATHS.items("task-one")).toBe(
      `${API_PREFIX}/tasks/task-one/checklist`,
    );
    expect(CHECKLIST_API_PATHS.item("task-one", "checklist-two")).toBe(
      `${API_PREFIX}/tasks/task-one/checklist/checklist-two`,
    );
    expect(CHECKLIST_API_PATHS.summary).toBe(`${API_PREFIX}/checklist/summary`);
  });

  it("passes a route parameter token through, so the router can build its own paths", () => {
    expect(CHECKLIST_API_PATHS.items(":taskId")).toBe(
      `${API_PREFIX}/tasks/:taskId/checklist`,
    );
    expect(CHECKLIST_API_PATHS.item(":taskId", ":itemId")).toBe(
      `${API_PREFIX}/tasks/:taskId/checklist/:itemId`,
    );
  });

  it("offers the same addresses through the url helpers", () => {
    expect(taskChecklistUrl("task-one")).toBe(`${API_PREFIX}/tasks/task-one/checklist`);
    expect(checklistItemUrl("task-one", "checklist-two")).toBe(
      `${API_PREFIX}/tasks/task-one/checklist/checklist-two`,
    );
  });

  it("escapes an id that needs it", () => {
    expect(taskChecklistUrl("task one/two")).toBe(
      `${API_PREFIX}/tasks/task%20one%2Ftwo/checklist`,
    );
  });

  it("addresses the progress counts of a set of task ids", () => {
    expect(checklistSummaryUrl(["task-one", "task-two"])).toBe(
      `${API_PREFIX}/checklist/summary?${CHECKLIST_SUMMARY_QUERY_PARAM}=task-one%2Ctask-two`,
    );
  });

  it("drops blanks and repeats, and asks for nothing when no task is named", () => {
    expect(checklistSummaryUrl(["task-one", "task-one", "  "])).toBe(
      `${API_PREFIX}/checklist/summary?${CHECKLIST_SUMMARY_QUERY_PARAM}=task-one`,
    );
    expect(checklistSummaryUrl([])).toBe(`${API_PREFIX}/checklist/summary`);
  });
});

describe("uniqueTaskIds", () => {
  it("keeps the order, without blanks or repeats", () => {
    expect(uniqueTaskIds([" task-two ", "task-one", "task-two", ""])).toEqual([
      "task-two",
      "task-one",
    ]);
  });
});

describe("parseChecklistTaskIds", () => {
  it("reads a comma-separated query value", () => {
    expect(parseChecklistTaskIds("task-one,task-two")).toEqual(["task-one", "task-two"]);
  });

  it("reads a repeated query parameter", () => {
    expect(parseChecklistTaskIds(["task-one", "task-two,task-three"])).toEqual([
      "task-one",
      "task-two",
      "task-three",
    ]);
  });

  it("ignores blanks, repeats and anything that is not text", () => {
    expect(parseChecklistTaskIds("task-one, ,task-one")).toEqual(["task-one"]);
    expect(parseChecklistTaskIds(["task-one", 7, null])).toEqual(["task-one"]);
    expect(parseChecklistTaskIds(undefined)).toEqual([]);
    expect(parseChecklistTaskIds({ taskIds: "task-one" })).toEqual([]);
  });
});

describe("normaliseChecklistTitle", () => {
  it("collapses whitespace and trims", () => {
    expect(normaliseChecklistTitle("  Check   the   copy ")).toBe("Check the copy");
  });

  it("reports a title that is only whitespace as empty", () => {
    expect(normaliseChecklistTitle("   ")).toBe("");
    expect(normaliseChecklistTitle("")).toBe("");
  });

  it("caps an over-long title", () => {
    const long = "a".repeat(MAX_CHECKLIST_TITLE_LENGTH + 40);
    expect(normaliseChecklistTitle(long)).toHaveLength(MAX_CHECKLIST_TITLE_LENGTH);
  });
});

describe("compareChecklistItems", () => {
  it("orders a checklist by its stored position", () => {
    const items: ChecklistItem[] = [
      item({ id: "checklist-three", position: 3 }),
      item({ id: "checklist-one", position: 1 }),
      item({ id: "checklist-two", position: 2 }),
    ];
    expect([...items].sort(compareChecklistItems).map((row: ChecklistItem): string => row.id)).toEqual([
      "checklist-one",
      "checklist-two",
      "checklist-three",
    ]);
  });

  it("falls back to the creation stamp when two positions match", () => {
    const older = item({ id: "checklist-older", createdAt: "2026-03-01T09:00:00.000Z" });
    const newer = item({ id: "checklist-newer", createdAt: "2026-03-02T09:00:00.000Z" });
    expect(
      [newer, older].sort(compareChecklistItems).map((row: ChecklistItem): string => row.id),
    ).toEqual(["checklist-older", "checklist-newer"]);
  });
});

describe("countChecklistProgress", () => {
  it("counts the ticked items of one task only", () => {
    const items: ChecklistItem[] = [
      item({ id: "checklist-one", position: 1, done: true }),
      item({ id: "checklist-two", position: 2, done: false }),
      item({ id: "checklist-other", taskId: "task-two", position: 1, done: true }),
    ];

    expect(countChecklistProgress("task-one", items)).toEqual({
      taskId: "task-one",
      done: 1,
      total: 2,
    });
    expect(countChecklistProgress("task-two", items)).toEqual({
      taskId: "task-two",
      done: 1,
      total: 1,
    });
  });

  it("reports a task with no items as nothing out of nothing", () => {
    expect(countChecklistProgress("task-empty", [])).toEqual({
      taskId: "task-empty",
      done: 0,
      total: 0,
    });
  });
});

describe("checklistProgressLabel", () => {
  it("reads as done out of total", () => {
    expect(checklistProgressLabel({ taskId: "task-one", done: 2, total: 5 })).toBe("2/5");
    expect(checklistProgressLabel({ taskId: "task-one", done: 0, total: 0 })).toBe("0/0");
  });
});
