// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import {
  BOARD_ACTOR,
  TaskActivityService,
  commentExtract,
  describeAssigneeId,
  diffTaskFields,
  MAX_COMMENT_EXTRACT,
} from "./service.js";
import { createMemoryActivityRepository, type ActivityRepository } from "./repository.js";
import {
  MAX_ACTIVITY_LIMIT,
  type NewTaskActivity,
  type TaskActivity,
} from "./types.js";
import type { TeamMemberRepository } from "../../db/memberRepository.js";
import type {
  NewTeamMember,
  TeamMember,
  TeamMemberWithWorkload,
} from "../../models/member.js";
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  type Task,
} from "../../models/task.js";

/** An in-memory activity store implementing the full shared interface. */
class StubActivityRepository implements ActivityRepository {
  /** Every entry the service asked to be written, in order. */
  readonly written: NewTaskActivity[] = [];
  private readonly rows: TaskActivity[] = [];
  private sequence = 0;

  create(entry: NewTaskActivity): Promise<TaskActivity> {
    this.written.push(entry);
    this.sequence += 1;
    const stored: TaskActivity = {
      id: `activity-${String(this.sequence)}`,
      taskId: entry.taskId,
      kind: entry.kind,
      field: entry.field ?? null,
      fromValue: entry.fromValue ?? null,
      toValue: entry.toValue ?? null,
      actor: entry.actor ?? null,
      message: entry.message,
      createdAt: new Date(Date.UTC(2026, 2, 1, 9, 0, this.sequence)).toISOString(),
    };
    this.rows.push(stored);
    return Promise.resolve(stored);
  }

  listByTask(taskId: string, limit?: number): Promise<TaskActivity[]> {
    const newestFirst = this.rows
      .filter((row: TaskActivity): boolean => row.taskId === taskId)
      .reverse();
    return Promise.resolve(limit === undefined ? newestFirst : newestFirst.slice(0, limit));
  }
}

/** An in-memory roster implementing the full shared interface. */
class StubMemberRepository implements TeamMemberRepository {
  private readonly rows: TeamMember[];

  constructor(rows: readonly TeamMember[]) {
    this.rows = [...rows];
  }

  list(): Promise<TeamMember[]> {
    return Promise.resolve([...this.rows]);
  }

  listWithWorkload(): Promise<TeamMemberWithWorkload[]> {
    return Promise.resolve(
      this.rows.map(
        (member: TeamMember): TeamMemberWithWorkload => ({
          id: member.id,
          name: member.name,
          role: member.role,
          openTaskCount: 0,
        }),
      ),
    );
  }

  findById(id: string): Promise<TeamMember | null> {
    return Promise.resolve(
      this.rows.find((member: TeamMember): boolean => member.id === id) ?? null,
    );
  }

  create(input: NewTeamMember): Promise<TeamMember> {
    const created: TeamMember = {
      id: `member-${String(this.rows.length + 1)}`,
      name: input.name,
      role: input.role,
    };
    this.rows.push(created);
    return Promise.resolve(created);
  }

  remove(id: string): Promise<void> {
    const index = this.rows.findIndex((member: TeamMember): boolean => member.id === id);
    if (index >= 0) {
      this.rows.splice(index, 1);
    }
    return Promise.resolve();
  }
}

const PRIYA: TeamMember = {
  id: "member-priya",
  name: "Priya Natarajan",
  role: "Engineering Lead",
};
const DAN: TeamMember = { id: "member-dan", name: "Dan Okafor", role: "Backend Engineer" };

function makeTask(overrides: Partial<Task> = {}): Task {
  const base: Task = {
    id: "task-alpha",
    title: "Design the onboarding email",
    description: "Draft copy and layout.",
    assigneeId: null,
    dueDate: "2026-02-18",
    status: DEFAULT_TASK_STATUS,
    priority: DEFAULT_TASK_PRIORITY,
    createdAt: "2026-02-01T09:00:00.000Z",
  };
  return { ...base, ...overrides };
}

let store: StubActivityRepository;
let service: TaskActivityService;

beforeEach(() => {
  store = new StubActivityRepository();
  service = new TaskActivityService({
    activity: store,
    members: new StubMemberRepository([PRIYA, DAN]),
  });
});

describe("logTaskCreated", () => {
  it("records one task_created entry with a human-readable message", async () => {
    const created = await service.logTaskCreated(makeTask());

    expect(store.written).toHaveLength(1);
    expect(created.kind).toBe("task_created");
    expect(created.taskId).toBe("task-alpha");
    expect(created.field).toBeNull();
    expect(created.toValue).toBe(DEFAULT_TASK_STATUS);
    expect(created.message).toBe('Created the task "Design the onboarding email" in To do.');
  });

  it("attributes the entry to the real name of the member it belongs to", async () => {
    const created = await service.logTaskCreated(makeTask({ assigneeId: PRIYA.id }));

    expect(created.actor).toBe("Priya Natarajan");
  });

  it("attributes a task nobody is assigned to the board, never to nobody at all", async () => {
    const created = await service.logTaskCreated(makeTask({ assigneeId: null }));

    expect(created.actor).toBe(BOARD_ACTOR);
    expect(created.actor).not.toBe("");
  });
});

describe("logTaskUpdated", () => {
  it("records nothing at all for an edit that changed nothing", async () => {
    const before = makeTask();
    const after = makeTask();

    const recorded = await service.logTaskUpdated(before, after);

    expect(recorded).toEqual([]);
    expect(store.written).toHaveLength(0);
  });

  it("uses the status kind for a move between columns", async () => {
    const recorded = await service.logTaskUpdated(
      makeTask({ status: "todo" }),
      makeTask({ status: "doing" }),
    );

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.kind).toBe("status_changed");
    expect(recorded[0]?.field).toBe("status");
    expect(recorded[0]?.fromValue).toBe("todo");
    expect(recorded[0]?.toValue).toBe("doing");
    expect(recorded[0]?.message).toBe("Status moved from To do to Doing.");
  });

  it("attributes every entry of an edit to the member the task belongs to", async () => {
    const recorded = await service.logTaskUpdated(
      makeTask({ assigneeId: PRIYA.id, status: "todo", priority: "Medium" }),
      makeTask({ assigneeId: PRIYA.id, status: "doing", priority: "High" }),
    );

    expect(recorded).toHaveLength(2);
    for (const entry of recorded) {
      expect(entry.actor).toBe("Priya Natarajan");
    }
  });

  it("attributes a reassignment to the person it moved to", async () => {
    const recorded = await service.logTaskUpdated(
      makeTask({ assigneeId: PRIYA.id }),
      makeTask({ assigneeId: DAN.id }),
    );

    expect(recorded[0]?.actor).toBe("Dan Okafor");
  });

  it("attributes an unassignment to the person it moved away from", async () => {
    const recorded = await service.logTaskUpdated(
      makeTask({ assigneeId: PRIYA.id }),
      makeTask({ assigneeId: null }),
    );

    expect(recorded[0]?.actor).toBe("Priya Natarajan");
  });

  it("uses the priority kind for a change of level", async () => {
    const recorded = await service.logTaskUpdated(
      makeTask({ priority: "Medium" }),
      makeTask({ priority: "High" }),
    );

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.kind).toBe("priority_changed");
    expect(recorded[0]?.field).toBe("priority");
    expect(recorded[0]?.message).toBe("Priority changed from Medium to High.");
  });

  it("uses the assignee kind and names both people", async () => {
    const recorded = await service.logTaskUpdated(
      makeTask({ assigneeId: PRIYA.id }),
      makeTask({ assigneeId: DAN.id }),
    );

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.kind).toBe("assignee_changed");
    expect(recorded[0]?.field).toBe("assignee");
    expect(recorded[0]?.fromValue).toBe(PRIYA.id);
    expect(recorded[0]?.toValue).toBe(DAN.id);
    expect(recorded[0]?.message).toBe(
      "Assignee changed from Priya Natarajan to Dan Okafor.",
    );
  });

  it("says Unassigned when a task is handed to nobody", async () => {
    const recorded = await service.logTaskUpdated(
      makeTask({ assigneeId: PRIYA.id }),
      makeTask({ assigneeId: null }),
    );

    expect(recorded[0]?.message).toBe("Assignee changed from Priya Natarajan to Unassigned.");
    expect(recorded[0]?.toValue).toBeNull();
  });

  it("uses the labels kind for a change of label set", async () => {
    const recorded = await service.logTaskUpdated(
      makeTask({ labels: [{ id: "label-design", name: "Design", color: "info" }] }),
      makeTask({
        labels: [
          { id: "label-design", name: "Design", color: "info" },
          { id: "label-urgent", name: "Urgent", color: "warning" },
        ],
      }),
    );

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.kind).toBe("labels_changed");
    expect(recorded[0]?.field).toBe("labels");
    expect(recorded[0]?.fromValue).toBe("Design");
    expect(recorded[0]?.toValue).toBe("Design, Urgent");
    expect(recorded[0]?.message).toBe("Labels changed from Design to Design, Urgent.");
  });

  it("records nothing when the same labels come back in another order", async () => {
    const recorded = await service.logTaskUpdated(
      makeTask({
        labels: [
          { id: "label-urgent", name: "Urgent", color: "warning" },
          { id: "label-design", name: "Design", color: "info" },
        ],
      }),
      makeTask({
        labels: [
          { id: "label-design", name: "Design", color: "info" },
          { id: "label-urgent", name: "Urgent", color: "warning" },
        ],
      }),
    );

    expect(recorded).toEqual([]);
  });

  it("uses field_changed for the title, the description and the due date", async () => {
    const recorded = await service.logTaskUpdated(
      makeTask({
        title: "Design the onboarding email",
        description: "Draft copy and layout.",
        dueDate: "2026-02-18",
      }),
      makeTask({
        title: "Design the onboarding email run-b7",
        description: "Second draft with the new banner.",
        dueDate: null,
      }),
    );

    expect(recorded.map((entry: TaskActivity): string => entry.field ?? "")).toEqual([
      "title",
      "description",
      "dueDate",
    ]);
    for (const entry of recorded) {
      expect(entry.kind).toBe("field_changed");
    }
    expect(recorded[0]?.message).toBe(
      'Title changed from "Design the onboarding email" to "Design the onboarding email run-b7".',
    );
    expect(recorded[1]?.message).toBe("Description updated.");
    expect(recorded[2]?.message).toBe("Due date changed from 2026-02-18 to none.");
  });

  it("reads the day out of a full due-date timestamp and ignores a same-day edit", async () => {
    const recorded = await service.logTaskUpdated(
      makeTask({ dueDate: "2026-02-18" }),
      makeTask({ dueDate: "2026-02-18T00:00:00.000Z" }),
    );

    expect(recorded).toEqual([]);
  });

  it("records one entry per changed field for an edit that touched several", async () => {
    const recorded = await service.logTaskUpdated(
      makeTask({ title: "Old title", status: "todo", priority: "Medium" }),
      makeTask({ title: "New title", status: "done", priority: "High" }),
    );

    expect(recorded).toHaveLength(3);
    expect(recorded.map((entry: TaskActivity): string => entry.kind)).toEqual([
      "field_changed",
      "status_changed",
      "priority_changed",
    ]);
    expect(store.written).toHaveLength(3);
    for (const entry of recorded) {
      expect(entry.taskId).toBe("task-alpha");
    }
  });
});

describe("diffTaskFields", () => {
  it("is pure and needs no store at all", () => {
    const changes = diffTaskFields(
      makeTask({ status: "todo" }),
      makeTask({ status: "done" }),
    );

    expect(changes).toEqual([
      {
        kind: "status_changed",
        field: "status",
        from: "todo",
        to: "done",
        message: "Status moved from To do to Done.",
      },
    ]);
  });

  it("falls back to a nameless assignee description with no roster", () => {
    expect(describeAssigneeId(null)).toBe("Unassigned");
    expect(describeAssigneeId("member-priya")).toBe("a team member");

    const changes = diffTaskFields(
      makeTask({ assigneeId: null }),
      makeTask({ assigneeId: "member-priya" }),
    );
    expect(changes[0]?.message).toBe("Assignee changed from Unassigned to a team member.");
  });

  it("says when a description was added or removed", () => {
    const added = diffTaskFields(makeTask({ description: "" }), makeTask({ description: "Now written." }));
    expect(added[0]?.message).toBe("Description added.");

    const removed = diffTaskFields(makeTask({ description: "Was written." }), makeTask({ description: "" }));
    expect(removed[0]?.message).toBe("Description removed.");
  });
});

describe("logCommentAdded", () => {
  it("records a comment entry carrying what was said", async () => {
    const recorded = await service.logCommentAdded("task-alpha", "  Copy approved by Priya.  ");

    expect(recorded.kind).toBe("comment_added");
    expect(recorded.taskId).toBe("task-alpha");
    expect(recorded.field).toBeNull();
    expect(recorded.toValue).toBe("Copy approved by Priya.");
    expect(recorded.message).toBe('Comment added: "Copy approved by Priya."');
  });

  it("attributes a comment to the real name of the member the task belongs to", async () => {
    const recorded = await service.logCommentAdded(
      "task-alpha",
      "Copy approved.",
      DAN.id,
    );

    expect(recorded.actor).toBe("Dan Okafor");
  });

  it("attributes a comment on an unassigned task to the board", async () => {
    const recorded = await service.logCommentAdded("task-alpha", "Copy approved.");

    expect(recorded.actor).toBe(BOARD_ACTOR);
  });

  it("shortens a long comment for the feed", () => {
    const extract = commentExtract("a".repeat(MAX_COMMENT_EXTRACT + 40));
    expect(extract.length).toBe(MAX_COMMENT_EXTRACT + 1);
    expect(extract.endsWith("…")).toBe(true);
  });
});

describe("logTaskDeleted", () => {
  it("records a deletion entry", async () => {
    const recorded = await service.logTaskDeleted(makeTask({ status: "doing" }));

    expect(recorded.kind).toBe("task_deleted");
    expect(recorded.fromValue).toBe("doing");
    expect(recorded.toValue).toBeNull();
    expect(recorded.message).toBe('Deleted the task "Design the onboarding email".');
  });
});

describe("attribution without a roster", () => {
  it("still records the entry, attributed to the board", async () => {
    const nameless = new TaskActivityService({ activity: store });

    const created = await nameless.logTaskCreated(makeTask({ assigneeId: PRIYA.id }));

    expect(created.actor).toBe(BOARD_ACTOR);
  });
});

describe("listActivity", () => {
  it("serves an empty feed for a task nothing has happened to", async () => {
    expect(await service.listActivity("task-quiet")).toEqual([]);
  });

  it("serves the task's own entries, newest first", async () => {
    let tick = 0;
    const clockService = new TaskActivityService({
      activity: createMemoryActivityRepository({
        now: (): Date => {
          tick += 1;
          return new Date(Date.UTC(2026, 2, 1, 9, 0, tick));
        },
      }),
    });

    await clockService.logTaskCreated(makeTask());
    await clockService.logCommentAdded("task-alpha", "Picked this up.");
    await clockService.logTaskUpdated(makeTask({ status: "todo" }), makeTask({ status: "done" }));
    await clockService.logCommentAdded("task-other", "Belongs to another task.");

    const feed = await clockService.listActivity("task-alpha");
    expect(feed.map((entry: TaskActivity): string => entry.kind)).toEqual([
      "status_changed",
      "comment_added",
      "task_created",
    ]);

    // Every served entry carries the name the timeline shows.
    for (const entry of feed) {
      expect(entry.actor).not.toBeNull();
      expect(entry.actor).not.toBe("");
    }

    const limited = await clockService.listActivity("task-alpha", 2);
    expect(limited.map((entry: TaskActivity): string => entry.kind)).toEqual([
      "status_changed",
      "comment_added",
    ]);
  });

  it("clamps a limit that is too small or too large", async () => {
    const asked: (number | undefined)[] = [];
    const recording: ActivityRepository = {
      create: (entry: NewTaskActivity): Promise<TaskActivity> =>
        Promise.resolve({
          id: "activity-1",
          taskId: entry.taskId,
          kind: entry.kind,
          field: entry.field ?? null,
          fromValue: entry.fromValue ?? null,
          toValue: entry.toValue ?? null,
          actor: entry.actor ?? null,
          message: entry.message,
          createdAt: "2026-03-01T09:00:00.000Z",
        }),
      listByTask: (_taskId: string, limit?: number): Promise<TaskActivity[]> => {
        asked.push(limit);
        return Promise.resolve([]);
      },
    };
    const clamping = new TaskActivityService({ activity: recording });

    await clamping.listActivity("task-alpha");
    await clamping.listActivity("task-alpha", 0);
    await clamping.listActivity("task-alpha", MAX_ACTIVITY_LIMIT + 500);

    expect(asked).toEqual([undefined, 1, MAX_ACTIVITY_LIMIT]);
  });
});
