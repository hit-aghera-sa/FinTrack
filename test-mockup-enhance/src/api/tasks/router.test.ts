// @vitest-environment node
import express from "express";
import type { Router } from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTaskRouter } from "./router.js";
import type { TaskRepository } from "../../db/taskRepository.js";
import type { TeamMemberRepository } from "../../db/memberRepository.js";
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  type NewTask,
  type Task,
  type TaskUpdate,
} from "../../models/task.js";
import type {
  NewTeamMember,
  TeamMember,
  TeamMemberWithWorkload,
} from "../../models/member.js";

class FakeTaskRepository implements TaskRepository {
  rows: Task[];
  private counter = 0;

  constructor(initial: readonly Task[] = []) {
    this.rows = initial.map((row) => ({ ...row }));
  }

  list(): Promise<Task[]> {
    return Promise.resolve(this.rows.map((row) => ({ ...row })));
  }

  findById(id: string): Promise<Task | null> {
    const found = this.rows.find((row) => row.id === id);
    return Promise.resolve(found === undefined ? null : { ...found });
  }

  create(input: NewTask): Promise<Task> {
    this.counter += 1;
    const created: Task = {
      id: `task-${this.counter}`,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ?? null,
      status: input.status ?? DEFAULT_TASK_STATUS,
      priority: input.priority ?? DEFAULT_TASK_PRIORITY,
      createdAt: "2026-02-01T09:00:00.000Z",
    };
    this.rows.push(created);
    return Promise.resolve({ ...created });
  }

  update(id: string, patch: TaskUpdate): Promise<Task> {
    const index = this.rows.findIndex((row) => row.id === id);
    const current = index === -1 ? undefined : this.rows[index];
    if (current === undefined) {
      return Promise.reject(new Error("That task does not exist."));
    }
    const next: Task = {
      id: current.id,
      title: patch.title === undefined ? current.title : patch.title.trim(),
      description: patch.description === undefined ? current.description : patch.description,
      assigneeId: patch.assigneeId === undefined ? current.assigneeId : patch.assigneeId,
      dueDate: patch.dueDate === undefined ? current.dueDate : patch.dueDate,
      status: patch.status === undefined ? current.status : patch.status,
      priority: patch.priority === undefined ? current.priority : patch.priority,
      createdAt: current.createdAt,
    };
    this.rows[index] = next;
    return Promise.resolve({ ...next });
  }
}

class FakeTeamMemberRepository implements TeamMemberRepository {
  rows: TeamMember[];
  private counter = 0;

  constructor(initial: readonly TeamMember[] = []) {
    this.rows = initial.map((row) => ({ ...row }));
  }

  list(): Promise<TeamMember[]> {
    return Promise.resolve(this.rows.map((row) => ({ ...row })));
  }

  listWithWorkload(): Promise<TeamMemberWithWorkload[]> {
    return Promise.resolve(this.rows.map((row) => ({ ...row, openTaskCount: 0 })));
  }

  findById(id: string): Promise<TeamMember | null> {
    const found = this.rows.find((row) => row.id === id);
    return Promise.resolve(found === undefined ? null : { ...found });
  }

  create(input: NewTeamMember): Promise<TeamMember> {
    this.counter += 1;
    const created: TeamMember = {
      id: `member-${this.counter}`,
      name: input.name.trim(),
      role: input.role.trim(),
    };
    this.rows.push(created);
    return Promise.resolve({ ...created });
  }

  remove(id: string): Promise<void> {
    this.rows = this.rows.filter((row) => row.id !== id);
    return Promise.resolve();
  }
}

interface Harness {
  base: string;
  close: () => Promise<void>;
}

async function startServer(router: Router): Promise<Harness> {
  const app = express();
  app.use("/api", router);
  const server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once("listening", () => {
      resolve();
    });
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

interface Reply {
  status: number;
  body: unknown;
}

function fields(body: unknown): Record<string, unknown> {
  expect(typeof body).toBe("object");
  expect(body).not.toBeNull();
  return body as Record<string, unknown>;
}

function rows(body: unknown): Record<string, unknown>[] {
  expect(Array.isArray(body)).toBe(true);
  return body as Record<string, unknown>[];
}

const SEED_TASK: Task = {
  id: "task-seed",
  title: "Design the onboarding email",
  description: "Draft copy and layout.",
  assigneeId: "member-priya",
  dueDate: "2026-02-18",
  status: "todo",
  priority: DEFAULT_TASK_PRIORITY,
  createdAt: "2026-01-20T10:00:00.000Z",
};

const SEED_MEMBER: TeamMember = {
  id: "member-priya",
  name: "Priya Natarajan",
  role: "Engineering Lead",
};

let harness: Harness;
let tasks: FakeTaskRepository;
let members: FakeTeamMemberRepository;

async function send(path: string, init?: RequestInit): Promise<Reply> {
  const response = await fetch(`${harness.base}${path}`, init);
  const text = await response.text();
  return {
    status: response.status,
    body: text === "" ? null : (JSON.parse(text) as unknown),
  };
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}

beforeEach(async () => {
  tasks = new FakeTaskRepository([SEED_TASK]);
  members = new FakeTeamMemberRepository([SEED_MEMBER]);
  harness = await startServer(createTaskRouter({ tasks, members }));
});

afterEach(async () => {
  await harness.close();
});

describe("GET /api/tasks", () => {
  it("returns every task for the three columns", async () => {
    const reply = await send("/api/tasks");
    expect(reply.status).toBe(200);
    const list = rows(reply.body);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("task-seed");
    expect(list[0]?.status).toBe("todo");
  });
});

describe("GET /api/tasks/:id", () => {
  it("returns the task", async () => {
    const reply = await send("/api/tasks/task-seed");
    expect(reply.status).toBe(200);
    expect(fields(reply.body).title).toBe("Design the onboarding email");
  });

  it("answers 404 with a message for an unknown task", async () => {
    const reply = await send("/api/tasks/task-missing");
    expect(reply.status).toBe(404);
    expect(fields(reply.body).message).toBe("That task does not exist.");
  });
});

describe("POST /api/tasks", () => {
  it("creates a task and defaults the status to To do", async () => {
    const reply = await send(
      "/api/tasks",
      jsonInit("POST", { title: "Write release notes run-b7" }),
    );
    expect(reply.status).toBe(201);
    const created = fields(reply.body);
    expect(created.title).toBe("Write release notes run-b7");
    expect(created.status).toBe("todo");
    expect(created.description).toBe("");
    expect(created.assigneeId).toBeNull();
    expect(created.dueDate).toBeNull();
    expect(tasks.rows).toHaveLength(2);
  });

  it("defaults the priority to Medium", async () => {
    const reply = await send("/api/tasks", jsonInit("POST", { title: "Alex QA default priority" }));
    expect(reply.status).toBe(201);
    expect(fields(reply.body).priority).toBe(DEFAULT_TASK_PRIORITY);
    expect(tasks.rows[1]?.priority).toBe(DEFAULT_TASK_PRIORITY);
  });

  it("stores the priority chosen in the form", async () => {
    const reply = await send(
      "/api/tasks",
      jsonInit("POST", { title: "Alex QA urgent handover", priority: "High" }),
    );
    expect(reply.status).toBe(201);
    expect(fields(reply.body).priority).toBe("High");
    expect(tasks.rows[1]?.priority).toBe("High");
  });

  it("accepts a known assignee, a due date and an explicit status", async () => {
    const reply = await send(
      "/api/tasks",
      jsonInit("POST", {
        title: "Pair on the board layout",
        description: "Walk through the three columns.",
        assigneeId: "member-priya",
        dueDate: "2026-03-02",
        status: "doing",
      }),
    );
    expect(reply.status).toBe(201);
    const created = fields(reply.body);
    expect(created.assigneeId).toBe("member-priya");
    expect(created.dueDate).toBe("2026-03-02");
    expect(created.status).toBe("doing");
  });

  it("rejects a missing title with 400", async () => {
    const reply = await send("/api/tasks", jsonInit("POST", { title: "   " }));
    expect(reply.status).toBe(400);
    expect(fields(reply.body).message).toBe("A task title is required.");
    expect(tasks.rows).toHaveLength(1);
  });

  it("rejects a status outside the three values with 400", async () => {
    const reply = await send(
      "/api/tasks",
      jsonInit("POST", { title: "Alex QA review", status: "blocked" }),
    );
    expect(reply.status).toBe(400);
    expect(fields(reply.body).message).toBe("The status must be one of: todo, doing, done.");
  });

  it("rejects a priority outside the three levels with 400", async () => {
    const reply = await send(
      "/api/tasks",
      jsonInit("POST", { title: "Alex QA review", priority: "Urgent" }),
    );
    expect(reply.status).toBe(400);
    expect(fields(reply.body).message).toBe("The priority must be one of: Low, Medium, High.");
    expect(tasks.rows).toHaveLength(1);
  });

  it("rejects an assignee who is not on the team with 400", async () => {
    const reply = await send(
      "/api/tasks",
      jsonInit("POST", { title: "Alex QA review", assigneeId: "member-ghost" }),
    );
    expect(reply.status).toBe(400);
    expect(fields(reply.body).message).toBe("The assignee is not a member of the team.");
  });
});

describe("PATCH /api/tasks/:id", () => {
  it("moves a card between columns", async () => {
    const reply = await send("/api/tasks/task-seed", jsonInit("PATCH", { status: "done" }));
    expect(reply.status).toBe(200);
    expect(fields(reply.body).status).toBe("done");
    expect(tasks.rows[0]?.status).toBe("done");
  });

  it("applies a partial edit of the other fields", async () => {
    const reply = await send(
      "/api/tasks/task-seed",
      jsonInit("PATCH", {
        title: "Design the onboarding email run-c2",
        description: "Second draft with the new banner.",
        assigneeId: "",
        dueDate: "",
      }),
    );
    expect(reply.status).toBe(200);
    const updated = fields(reply.body);
    expect(updated.title).toBe("Design the onboarding email run-c2");
    expect(updated.description).toBe("Second draft with the new banner.");
    expect(updated.assigneeId).toBeNull();
    expect(updated.dueDate).toBeNull();
    expect(updated.status).toBe("todo");
  });

  it("saves a new priority", async () => {
    const reply = await send("/api/tasks/task-seed", jsonInit("PATCH", { priority: "High" }));
    expect(reply.status).toBe(200);
    expect(fields(reply.body).priority).toBe("High");
    expect(tasks.rows[0]?.priority).toBe("High");
  });

  it("leaves the priority alone when the patch does not mention it", async () => {
    const reply = await send("/api/tasks/task-seed", jsonInit("PATCH", { status: "doing" }));
    expect(reply.status).toBe(200);
    expect(fields(reply.body).priority).toBe(DEFAULT_TASK_PRIORITY);
    expect(tasks.rows[0]?.priority).toBe(DEFAULT_TASK_PRIORITY);
  });

  it("answers 404 for an unknown task", async () => {
    const reply = await send("/api/tasks/task-missing", jsonInit("PATCH", { status: "doing" }));
    expect(reply.status).toBe(404);
    expect(fields(reply.body).message).toBe("That task does not exist.");
  });

  it("rejects an invalid status with 400", async () => {
    const reply = await send("/api/tasks/task-seed", jsonInit("PATCH", { status: "archived" }));
    expect(reply.status).toBe(400);
    expect(fields(reply.body).message).toBe("The status must be one of: todo, doing, done.");
    expect(tasks.rows[0]?.status).toBe("todo");
  });

  it("rejects an invalid priority with 400", async () => {
    const reply = await send("/api/tasks/task-seed", jsonInit("PATCH", { priority: "Later" }));
    expect(reply.status).toBe(400);
    expect(fields(reply.body).message).toBe("The priority must be one of: Low, Medium, High.");
    expect(tasks.rows[0]?.priority).toBe(DEFAULT_TASK_PRIORITY);
  });

  it("rejects an unknown assignee with 400", async () => {
    const reply = await send(
      "/api/tasks/task-seed",
      jsonInit("PATCH", { assigneeId: "member-ghost" }),
    );
    expect(reply.status).toBe(400);
    expect(fields(reply.body).message).toBe("The assignee is not a member of the team.");
  });

  it("rejects an unparseable due date with 400", async () => {
    const reply = await send(
      "/api/tasks/task-seed",
      jsonInit("PATCH", { dueDate: "next tuesday-ish" }),
    );
    expect(reply.status).toBe(400);
    expect(fields(reply.body).message).toBe("The due date must be a valid date.");
  });
});

describe("team member lookups", () => {
  it("consults the member repository when validating an assignee", async () => {
    const created = await members.create({ name: "Alex QA", role: "QA Engineer" });
    const reply = await send(
      "/api/tasks",
      jsonInit("POST", { title: "Smoke the board", assigneeId: created.id }),
    );
    expect(reply.status).toBe(201);
    expect(fields(reply.body).assigneeId).toBe(created.id);
  });
});
