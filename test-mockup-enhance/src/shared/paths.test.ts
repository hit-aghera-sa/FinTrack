import { describe, expect, it } from "vitest";

import {
  BOARD_PATH,
  NEW_TASK_PATH,
  TASK_DETAIL_PATTERN,
  TEAM_PATH,
  taskDetailPath,
  taskIdFromPath,
} from "./paths";

describe("client paths", () => {
  it("declares the four addresses of the app", () => {
    expect(BOARD_PATH).toBe("/");
    expect(NEW_TASK_PATH).toBe("/tasks/new");
    expect(TASK_DETAIL_PATTERN).toBe("/tasks/:id");
    expect(TEAM_PATH).toBe("/team");
  });

  it("builds a task detail address", () => {
    expect(taskDetailPath("task-abc")).toBe("/tasks/task-abc");
  });

  it("round-trips an id through the detail address", () => {
    expect(taskIdFromPath(taskDetailPath("task-abc"))).toBe("task-abc");
  });

  it("ignores a query string and a fragment", () => {
    expect(taskIdFromPath("/tasks/task-abc?from=board#notes")).toBe("task-abc");
  });

  it("returns an empty id for addresses that are not a task detail page", () => {
    expect(taskIdFromPath("/")).toBe("");
    expect(taskIdFromPath("/team")).toBe("");
    expect(taskIdFromPath("/tasks")).toBe("");
    expect(taskIdFromPath(NEW_TASK_PATH)).toBe("");
  });
});
