import { describe, expect, it } from "vitest";

import {
  countOpenTasksByAssignee,
  formatDueDate,
  parseDueDate,
  toTask,
  toTaskComment,
  toTeamMember,
  withWorkload,
} from "./mappers.js";
import type {
  CommentRow,
  OpenTaskAssigneeRow,
  TaskRow,
  TeamMemberRow,
} from "./mappers.js";

const taskRow: TaskRow = {
  id: "task-a1",
  title: "Draft launch checklist",
  description: "Collect the open items",
  assigneeId: "member-a1",
  dueDate: new Date("2024-05-01T00:00:00.000Z"),
  status: "doing",
  priority: "Medium",
  createdAt: new Date("2024-04-01T09:30:00.000Z"),
};

const memberRows: TeamMemberRow[] = [
  { id: "member-a1", name: "Alex Rivera", role: "Engineer" },
  { id: "member-b2", name: "Priya Nair", role: "Designer" },
];

describe("due date conversion", () => {
  it("formats a stored timestamp as a calendar day", () => {
    expect(formatDueDate(new Date("2024-05-01T00:00:00.000Z"))).toBe("2024-05-01");
  });

  it("formats a missing due date as null", () => {
    expect(formatDueDate(null)).toBeNull();
  });

  it("parses a date-only value at UTC midnight", () => {
    const parsed = parseDueDate("2024-05-01");
    expect(parsed?.toISOString()).toBe("2024-05-01T00:00:00.000Z");
  });

  it("parses a full ISO timestamp", () => {
    const parsed = parseDueDate("2024-05-01T12:15:00.000Z");
    expect(parsed?.toISOString()).toBe("2024-05-01T12:15:00.000Z");
  });

  it("treats null, undefined and blank input as no due date", () => {
    expect(parseDueDate(null)).toBeNull();
    expect(parseDueDate(undefined)).toBeNull();
    expect(parseDueDate("   ")).toBeNull();
  });

  it("rejects an unparseable value", () => {
    expect(() => parseDueDate("next tuesday-ish")).toThrow(
      "Invalid due date: next tuesday-ish",
    );
  });

  it("round-trips a calendar day", () => {
    expect(formatDueDate(parseDueDate("2024-12-24"))).toBe("2024-12-24");
  });
});

describe("row mapping", () => {
  it("maps a task row to the shared Task model", () => {
    expect(toTask(taskRow)).toEqual({
      id: "task-a1",
      title: "Draft launch checklist",
      description: "Collect the open items",
      assigneeId: "member-a1",
      dueDate: "2024-05-01",
      status: "doing",
      priority: "Medium",
      createdAt: "2024-04-01T09:30:00.000Z",
    });
  });

  it("carries the stored priority through unchanged", () => {
    expect(toTask({ ...taskRow, priority: "High" }).priority).toBe("High");
    expect(toTask({ ...taskRow, priority: "Low" }).priority).toBe("Low");
  });

  it("maps an unassigned task without a due date", () => {
    const mapped = toTask({ ...taskRow, assigneeId: null, dueDate: null });
    expect(mapped.assigneeId).toBeNull();
    expect(mapped.dueDate).toBeNull();
    expect(mapped.priority).toBe("Medium");
  });

  it("maps a member row to the shared TeamMember model", () => {
    expect(toTeamMember(memberRows[0])).toEqual({
      id: "member-a1",
      name: "Alex Rivera",
      role: "Engineer",
    });
  });

  it("maps a comment row to the shared TaskComment model", () => {
    const commentRow: CommentRow = {
      id: "comment-c3",
      taskId: "task-a1",
      body: "Checklist reviewed",
      createdAt: new Date("2024-04-02T08:00:00.000Z"),
    };
    expect(toTaskComment(commentRow)).toEqual({
      id: "comment-c3",
      taskId: "task-a1",
      body: "Checklist reviewed",
      createdAt: "2024-04-02T08:00:00.000Z",
    });
  });
});

describe("workload derivation", () => {
  const openTasks: OpenTaskAssigneeRow[] = [
    { assigneeId: "member-a1" },
    { assigneeId: "member-a1" },
    { assigneeId: null },
  ];

  it("counts open tasks per assignee and ignores unassigned rows", () => {
    const counts = countOpenTasksByAssignee(openTasks);
    expect(counts.get("member-a1")).toBe(2);
    expect(counts.has("member-b2")).toBe(false);
    expect(counts.size).toBe(1);
  });

  it("attaches an open-task count to every member", () => {
    expect(withWorkload(memberRows, openTasks)).toEqual([
      {
        id: "member-a1",
        name: "Alex Rivera",
        role: "Engineer",
        openTaskCount: 2,
      },
      {
        id: "member-b2",
        name: "Priya Nair",
        role: "Designer",
        openTaskCount: 0,
      },
    ]);
  });

  it("reports zero for everyone when nothing is open", () => {
    const rows = withWorkload(memberRows, []);
    expect(rows.map((row) => row.openTaskCount)).toEqual([0, 0]);
  });
});
