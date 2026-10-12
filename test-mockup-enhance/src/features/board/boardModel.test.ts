import { describe, expect, it } from "vitest";

import { ApiError } from "../../lib/api/client.js";
import {
  DEFAULT_TASK_PRIORITY,
  TASK_STATUS_LABELS,
  type Task,
} from "../../models/task.js";
import type { TeamMemberWithWorkload } from "../../models/member.js";
import {
  assigneeName,
  buildColumns,
  describeError,
  formatDueDate,
  moveTargets,
  NO_DUE_DATE_LABEL,
  replaceTask,
  taskCountLabel,
  UNASSIGNED_LABEL,
} from "./boardModel.js";

function makeTask(id: string, title: string, status: Task["status"]): Task {
  return {
    id,
    title,
    description: "",
    assigneeId: null,
    dueDate: null,
    status,
    priority: DEFAULT_TASK_PRIORITY,
    createdAt: "2026-01-05T09:00:00.000Z",
  };
}

const ROSTER: readonly TeamMemberWithWorkload[] = [
  { id: "m-priya", name: "Priya Natarajan", role: "Engineering Lead", openTaskCount: 2 },
  { id: "m-dan", name: "Dan Okafor", role: "Backend Engineer", openTaskCount: 1 },
];

describe("buildColumns", () => {
  it("returns the three columns in board order, even when they are empty", () => {
    const columns = buildColumns([]);
    expect(columns.map((column) => column.status)).toEqual(["todo", "doing", "done"]);
    expect(columns.map((column) => column.label)).toEqual([
      TASK_STATUS_LABELS.todo,
      TASK_STATUS_LABELS.doing,
      TASK_STATUS_LABELS.done,
    ]);
    expect(columns.every((column) => column.tasks.length === 0)).toBe(true);
  });

  it("places every task in exactly the column matching its status", () => {
    const tasks: Task[] = [
      makeTask("t-one", "Draft the brief", "todo"),
      makeTask("t-two", "Wire the board API", "doing"),
      makeTask("t-three", "Publish release notes", "done"),
      makeTask("t-four", "Review the copy", "todo"),
    ];
    const columns = buildColumns(tasks);
    expect(columns[0]?.tasks.map((task) => task.id)).toEqual(["t-one", "t-four"]);
    expect(columns[1]?.tasks.map((task) => task.id)).toEqual(["t-two"]);
    expect(columns[2]?.tasks.map((task) => task.id)).toEqual(["t-three"]);
  });
});

describe("moveTargets", () => {
  it("offers every column except the task's own", () => {
    expect(moveTargets("todo")).toEqual(["doing", "done"]);
    expect(moveTargets("doing")).toEqual(["todo", "done"]);
    expect(moveTargets("done")).toEqual(["todo", "doing"]);
  });
});

describe("assigneeName", () => {
  it("resolves the member's name", () => {
    expect(assigneeName(ROSTER, "m-dan")).toBe("Dan Okafor");
  });

  it("falls back to the unassigned label for no assignee or an unknown one", () => {
    expect(assigneeName(ROSTER, null)).toBe(UNASSIGNED_LABEL);
    expect(assigneeName(ROSTER, "m-nobody")).toBe(UNASSIGNED_LABEL);
  });
});

describe("formatDueDate", () => {
  it("renders a stored calendar day without shifting it", () => {
    expect(formatDueDate("2026-02-18")).toBe("18 Feb 2026");
    expect(formatDueDate("2026-01-09")).toBe("9 Jan 2026");
  });

  it("reports a missing due date", () => {
    expect(formatDueDate(null)).toBe(NO_DUE_DATE_LABEL);
    expect(formatDueDate("   ")).toBe(NO_DUE_DATE_LABEL);
  });

  it("returns anything it cannot read unchanged", () => {
    expect(formatDueDate("next Tuesday")).toBe("next Tuesday");
    expect(formatDueDate("2026-13-01")).toBe("2026-13-01");
  });
});

describe("replaceTask", () => {
  it("swaps in the saved task and leaves the others alone", () => {
    const tasks: Task[] = [
      makeTask("t-one", "Draft the brief", "todo"),
      makeTask("t-two", "Wire the board API", "doing"),
    ];
    const moved: Task = { ...makeTask("t-one", "Draft the brief", "done") };
    const next = replaceTask(tasks, moved);
    expect(next[0]?.status).toBe("done");
    expect(next[1]).toBe(tasks[1]);
    expect(tasks[0]?.status).toBe("todo");
  });
});

describe("taskCountLabel", () => {
  it("reads naturally for none, one and many", () => {
    expect(taskCountLabel(0)).toBe("No tasks");
    expect(taskCountLabel(1)).toBe("1 task");
    expect(taskCountLabel(4)).toBe("4 tasks");
  });
});

describe("describeError", () => {
  it("surfaces the server's own message", () => {
    expect(describeError(new ApiError(500, "Board unavailable"), "fallback")).toBe(
      "Board unavailable",
    );
  });

  it("explains an unreachable backend", () => {
    expect(describeError(new ApiError(0, "Failed to fetch"), "fallback")).toBe(
      "The board could not be reached. Check your connection and try again.",
    );
  });

  it("falls back for a value that carries no message", () => {
    expect(describeError("oops", "fallback")).toBe("fallback");
    expect(describeError(new Error("   "), "fallback")).toBe("fallback");
  });
});
