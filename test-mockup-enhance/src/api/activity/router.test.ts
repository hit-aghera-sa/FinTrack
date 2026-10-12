// @vitest-environment node
import express from "express";
import type { Router } from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createActivityRouter, type ActivityRouterDeps } from "./router.js";
import { createMemoryActivityRepository } from "./repository.js";
import { TaskActivityService } from "./service.js";
import type { TaskRepository } from "../../db/taskRepository.js";
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  type NewTask,
  type Task,
  type TaskUpdate,
} from "../../models/task.js";

/** An in-memory task store implementing the full shared interface. */
class StubTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>();
  private sequence = 0;

  seed(task: Task): void {
    this.tasks.set(task.id, task);
  }

  list(): Promise<Task[]> {
    return Promise.resolve([...this.tasks.values()]);
  }

  findById(id: string): Promise<Task | null> {
    return Promise.resolve(this.tasks.get(id) ?? null);
  }

  create(input: NewTask): Promise<Task> {
    this.sequence += 1;
    const task: Task = {
      id: `task-${String(this.sequence)}`,
      title: input.title,
      description: input.description ?? "",
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ?? null,
      status: input.status ?? DEFAULT_TASK_STATUS,
      priority: input.priority ?? DEFAULT_TASK_PRIORITY,
      createdAt: "2026-02-01T09:00:00.000Z",
    };
    this.tasks.set(task.id, task);
    return Promise.resolve(task);
  }

  update(id: string, patch: TaskUpdate): Promise<Task> {
    const existing = this.tasks.get(id);
    if (existing === undefined) {
      return Promise.reject(new Error("That task does not exist."));
    }
    const next: Task = {
      id: existing.id,
      title: patch.title ?? existing.title,
      description: patch.description ?? existing.description,
      assigneeId: patch.assigneeId === undefined ? existing.assigneeId : patch.assigneeId,
      dueDate: patch.dueDate === undefined ? existing.dueDate : patch.dueDate,
      status: patch.status ?? existing.status,
      priority: patch.priority ?? existing.priority,
      createdAt: existing.createdAt,
    };
    this.tasks.set(next.id, next);
    return Promise.resolve(next);
  }
}

interface Harness {
  url: string;
  close: () => Promise<void>;
}

async function startHarness(router: Router): Promise<Harness> {
  const app = express();
  app.use("/api", router);

  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => {
      resolve();
    });
    server.once("error", (error: Error) => {
      reject(error);
    });
  });

  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;

  return {
    url: `http://127.0.0.1:${String(port)}`,
    close: (): Promise<void> =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

const EXISTING_TASK_ID = "task-alpha";

function seededTask(): Task {
  return {
    id: EXISTING_TASK_ID,
    title: "Design the onboarding email",
    description: "Draft copy and layout.",
    assigneeId: null,
    dueDate: "2026-02-18",
    status: DEFAULT_TASK_STATUS,
    priority: DEFAULT_TASK_PRIORITY,
    createdAt: "2026-01-20T10:00:00.000Z",
  };
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

let tasks: StubTaskRepository;
let service: TaskActivityService;
let harness: Harness;
let tick = 0;

beforeEach(async () => {
  tick = 0;
  tasks = new StubTaskRepository();
  tasks.seed(seededTask());
  service = new TaskActivityService({
    activity: createMemoryActivityRepository({
      now: (): Date => {
        tick += 1;
        return new Date(Date.UTC(2026, 2, 1, 9, 0, tick));
      },
    }),
  });
  const deps: ActivityRouterDeps = { activity: service, tasks };
  harness = await startHarness(createActivityRouter(deps));
});

afterEach(async () => {
  await harness.close();
});

function feedUrl(taskId: string, query = ""): string {
  return `${harness.url}/api/tasks/${taskId}/activity${query}`;
}

describe("GET /api/tasks/:taskId/activity", () => {
  it("serves an empty feed for a task nothing has happened to", async () => {
    const response = await fetch(feedUrl(EXISTING_TASK_ID));

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual([]);
  });

  it("serves the task's entries newest first", async () => {
    const task = seededTask();
    await service.logTaskCreated(task);
    await service.logCommentAdded(task.id, "Picked this up.");
    await service.logTaskUpdated(task, { ...task, status: "doing" });
    await service.logCommentAdded("task-other", "Belongs to another task.");

    const response = await fetch(feedUrl(EXISTING_TASK_ID));
    expect(response.status).toBe(200);

    const listed = rows(await response.json());
    expect(listed.map((row: Record<string, unknown>): unknown => row.kind)).toEqual([
      "status_changed",
      "comment_added",
      "task_created",
    ]);
    for (const row of listed) {
      expect(row.taskId).toBe(EXISTING_TASK_ID);
      expect(typeof row.message).toBe("string");
      expect(typeof row.createdAt).toBe("string");
    }
  });

  it("honours ?limit", async () => {
    const task = seededTask();
    await service.logTaskCreated(task);
    await service.logCommentAdded(task.id, "Picked this up.");
    await service.logTaskUpdated(task, { ...task, priority: "High" });

    const response = await fetch(feedUrl(EXISTING_TASK_ID, "?limit=1"));
    expect(response.status).toBe(200);

    const listed = rows(await response.json());
    expect(listed).toHaveLength(1);
    expect(listed[0]?.kind).toBe("priority_changed");
  });

  it("ignores an empty ?limit and serves the whole feed", async () => {
    await service.logTaskCreated(seededTask());

    const response = await fetch(feedUrl(EXISTING_TASK_ID, "?limit="));
    expect(response.status).toBe(200);
    expect(rows(await response.json())).toHaveLength(1);
  });

  it("rejects a ?limit that is not a whole number of at least 1", async () => {
    for (const query of ["?limit=abc", "?limit=0", "?limit=-3", "?limit=2.5"]) {
      const response = await fetch(feedUrl(EXISTING_TASK_ID, query));
      expect(response.status).toBe(400);
      const body = fields(await response.json());
      expect(body.error).toBe("invalid_limit");
      expect(typeof body.message).toBe("string");
    }
  });

  it("answers 404 for a task that does not exist, saying so plainly", async () => {
    const response = await fetch(feedUrl("task-missing"));

    expect(response.status).toBe(404);
    const body = fields(await response.json());
    expect(body.error).toBe("task_not_found");
    expect(body.message).toBe("That task does not exist.");
  });
});
