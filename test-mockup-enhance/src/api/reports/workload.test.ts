// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildMemberReports, isOverdue, serverToday, toIsoDay } from "./workload.js";
import type { TeamMember } from "../../models/member.js";
import { DEFAULT_TASK_PRIORITY, type Task, type TaskStatus } from "../../models/task.js";

const TODAY = "2026-03-10";

const PRIYA: TeamMember = { id: "m-priya", name: "Priya Lunch", role: "Engineering Lead" };
const ALEX: TeamMember = { id: "m-alex", name: "Alex QA", role: "QA Engineer" };
const MEI: TeamMember = { id: "m-mei", name: "Mei Harbour", role: "Product Designer" };

function makeTask(
  id: string,
  assigneeId: string | null,
  status: TaskStatus,
  dueDate: string | null,
): Task {
  return {
    id,
    title: `Task ${id}`,
    description: "",
    assigneeId,
    dueDate,
    status,
    priority: DEFAULT_TASK_PRIORITY,
    createdAt: "2026-02-01T09:00:00.000Z",
  };
}

describe("server clock", () => {
  it("renders a moment as the calendar day the report counts against", () => {
    expect(toIsoDay(new Date("2026-03-10T23:30:00.000Z"))).toBe("2026-03-10");
    expect(serverToday(new Date("2026-01-05T00:00:00.000Z"))).toBe("2026-01-05");
  });
});

describe("isOverdue", () => {
  it("counts a task due before today whose status is not done", () => {
    expect(isOverdue({ dueDate: "2026-03-09", status: "todo" }, TODAY)).toBe(true);
    expect(isOverdue({ dueDate: "2026-02-01", status: "doing" }, TODAY)).toBe(true);
  });

  it("never counts a done task, however old its due date", () => {
    expect(isOverdue({ dueDate: "2025-12-01", status: "done" }, TODAY)).toBe(false);
  });

  it("does not count a task due today or later", () => {
    expect(isOverdue({ dueDate: TODAY, status: "todo" }, TODAY)).toBe(false);
    expect(isOverdue({ dueDate: "2026-04-01", status: "doing" }, TODAY)).toBe(false);
  });

  it("does not count a task with no due date", () => {
    expect(isOverdue({ dueDate: null, status: "todo" }, TODAY)).toBe(false);
    expect(isOverdue({ dueDate: "   ", status: "doing" }, TODAY)).toBe(false);
  });

  it("reads the day out of a full timestamp", () => {
    expect(isOverdue({ dueDate: "2026-03-01T12:00:00.000Z", status: "todo" }, TODAY)).toBe(true);
    expect(isOverdue({ dueDate: "2026-03-10T12:00:00.000Z", status: "todo" }, TODAY)).toBe(false);
  });
});

describe("buildMemberReports", () => {
  it("covers the whole roster, with zeros for a member who has no tasks", () => {
    const reports = buildMemberReports([PRIYA, ALEX, MEI], [], TODAY);

    expect(reports).toHaveLength(3);
    expect(reports).toEqual([
      {
        memberId: PRIYA.id,
        memberName: PRIYA.name,
        role: PRIYA.role,
        todo: 0,
        doing: 0,
        done: 0,
        overdue: 0,
        total: 0,
      },
      {
        memberId: ALEX.id,
        memberName: ALEX.name,
        role: ALEX.role,
        todo: 0,
        doing: 0,
        done: 0,
        overdue: 0,
        total: 0,
      },
      {
        memberId: MEI.id,
        memberName: MEI.name,
        role: MEI.role,
        todo: 0,
        doing: 0,
        done: 0,
        overdue: 0,
        total: 0,
      },
    ]);
  });

  it("breaks a member's tasks down by status and totals them", () => {
    const tasks: Task[] = [
      makeTask("t-one", PRIYA.id, "todo", null),
      makeTask("t-two", PRIYA.id, "todo", "2026-04-02"),
      makeTask("t-three", PRIYA.id, "doing", null),
      makeTask("t-four", PRIYA.id, "done", null),
      makeTask("t-five", ALEX.id, "doing", null),
    ];

    const reports = buildMemberReports([PRIYA, ALEX], tasks, TODAY);

    expect(reports[0]).toEqual({
      memberId: PRIYA.id,
      memberName: PRIYA.name,
      role: PRIYA.role,
      todo: 2,
      doing: 1,
      done: 1,
      overdue: 0,
      total: 4,
    });
    expect(reports[1]?.doing).toBe(1);
    expect(reports[1]?.total).toBe(1);
  });

  it("counts only tasks due before today whose status is not done as overdue", () => {
    const tasks: Task[] = [
      makeTask("t-late", PRIYA.id, "todo", "2026-03-01"),
      makeTask("t-late-doing", PRIYA.id, "doing", "2026-02-20"),
      makeTask("t-today", PRIYA.id, "todo", TODAY),
      makeTask("t-late-done", PRIYA.id, "done", "2026-01-01"),
      makeTask("t-future", PRIYA.id, "todo", "2026-12-24"),
    ];

    const reports = buildMemberReports([PRIYA], tasks, TODAY);

    expect(reports[0]?.overdue).toBe(2);
    expect(reports[0]?.total).toBe(5);
    expect(reports[0]?.done).toBe(1);
  });

  it("attributes an unassigned task, or one assigned off the roster, to nobody", () => {
    const tasks: Task[] = [
      makeTask("t-nobody", null, "todo", "2026-01-01"),
      makeTask("t-ghost", "m-removed", "doing", "2026-01-01"),
      makeTask("t-priya", PRIYA.id, "todo", null),
    ];

    const reports = buildMemberReports([PRIYA], tasks, TODAY);

    expect(reports).toHaveLength(1);
    expect(reports[0]?.total).toBe(1);
    expect(reports[0]?.overdue).toBe(0);
  });
});
