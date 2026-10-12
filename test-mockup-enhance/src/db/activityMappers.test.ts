import { describe, expect, it } from "vitest";

import {
  activityTextOrNull,
  normaliseActivityLimit,
  toActivityKind,
  toActivityWriteData,
  toTaskActivity,
  type TaskActivityRow,
} from "./activityMappers.js";
import { DEFAULT_TASK_ACTIVITY_KIND } from "../models/activity.js";

function makeRow(overrides: Partial<TaskActivityRow> = {}): TaskActivityRow {
  const base: TaskActivityRow = {
    id: "activity-one",
    taskId: "task-one",
    kind: "status_changed",
    field: "status",
    fromValue: "todo",
    toValue: "doing",
    actor: "Priya Natarajan",
    message: "Moved to Doing.",
    createdAt: new Date("2026-02-18T09:30:00.000Z"),
  };
  return { ...base, ...overrides };
}

describe("toTaskActivity", () => {
  it("maps a stored row onto the shared domain type", () => {
    expect(toTaskActivity(makeRow())).toEqual({
      id: "activity-one",
      taskId: "task-one",
      kind: "status_changed",
      field: "status",
      fromValue: "todo",
      toValue: "doing",
      actor: "Priya Natarajan",
      message: "Moved to Doing.",
      createdAt: "2026-02-18T09:30:00.000Z",
    });
  });

  it("keeps the nulls a note row carries", () => {
    const mapped = toTaskActivity(
      makeRow({
        kind: "commented",
        field: null,
        fromValue: null,
        toValue: null,
        actor: null,
        message: "Checked with the designer.",
      }),
    );
    expect(mapped.field).toBeNull();
    expect(mapped.fromValue).toBeNull();
    expect(mapped.toValue).toBeNull();
    expect(mapped.actor).toBeNull();
    expect(mapped.kind).toBe("commented");
  });

  it("falls back for a kind the model does not know", () => {
    expect(toTaskActivity(makeRow({ kind: "teleported" })).kind).toBe(
      DEFAULT_TASK_ACTIVITY_KIND,
    );
    expect(toActivityKind("created")).toBe("created");
    expect(toActivityKind(42)).toBe(DEFAULT_TASK_ACTIVITY_KIND);
  });
});

describe("activityTextOrNull", () => {
  it("trims text and turns nothing into null", () => {
    expect(activityTextOrNull("  status  ")).toBe("status");
    expect(activityTextOrNull("   ")).toBeNull();
    expect(activityTextOrNull(null)).toBeNull();
    expect(activityTextOrNull(undefined)).toBeNull();
  });
});

describe("toActivityWriteData", () => {
  it("writes every optional field as null and the message as empty text", () => {
    expect(toActivityWriteData({ taskId: " task-two ", kind: "created" })).toEqual({
      taskId: "task-two",
      kind: "created",
      field: null,
      fromValue: null,
      toValue: null,
      actor: null,
      message: "",
    });
  });

  it("trims the values a change carries", () => {
    expect(
      toActivityWriteData({
        taskId: "task-three",
        kind: "priority_changed",
        field: " priority ",
        fromValue: " Medium ",
        toValue: " High ",
        actor: " Alex QA ",
        message: "  Raised to High.  ",
      }),
    ).toEqual({
      taskId: "task-three",
      kind: "priority_changed",
      field: "priority",
      fromValue: "Medium",
      toValue: "High",
      actor: "Alex QA",
      message: "Raised to High.",
    });
  });
});

describe("normaliseActivityLimit", () => {
  it("means every entry when no limit is given", () => {
    expect(normaliseActivityLimit()).toBeUndefined();
    expect(normaliseActivityLimit(Number.NaN)).toBeUndefined();
    expect(normaliseActivityLimit(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it("rounds a limit down to a whole count", () => {
    expect(normaliseActivityLimit(5)).toBe(5);
    expect(normaliseActivityLimit(5.8)).toBe(5);
  });

  it("means no entries for a limit of zero or less", () => {
    expect(normaliseActivityLimit(0)).toBe(0);
    expect(normaliseActivityLimit(-3)).toBe(0);
  });
});
