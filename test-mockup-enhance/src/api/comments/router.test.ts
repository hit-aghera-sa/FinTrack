import type { Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCommentRouter, type CommentRouterDeps } from "./router.js";
import type { CommentRepository } from "../../db/commentRepository.js";
import type { TaskRepository } from "../../db/taskRepository.js";
import type { NewComment, TaskComment } from "../../models/comment.js";
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  type NewTask,
  type Task,
  type TaskUpdate,
} from "../../models/task.js";

/** In-memory comment repository implementing the full shared interface. */
class FakeCommentRepository implements CommentRepository {
  private readonly rows: TaskComment[] = [];
  private sequence = 0;

  listByTask(taskId: string): Promise<TaskComment[]> {
    return Promise.resolve(this.rows.filter((row: TaskComment): boolean => row.taskId === taskId));
  }

  create(taskId: string, input: NewComment): Promise<TaskComment> {
    this.sequence += 1;
    const row: TaskComment = {
      id: `comment-${String(this.sequence)}`,
      taskId,
      body: input.body.trim(),
      createdAt: new Date(Date.UTC(2026, 1, this.sequence, 9, 0, 0)).toISOString(),
    };
    this.rows.push(row);
    return Promise.resolve(row);
  }

  /** Everything stored, for assertions about writes that must not happen. */
  stored(): readonly TaskComment[] {
    return this.rows;
  }
}

/** In-memory task repository implementing the full shared interface. */
class FakeTaskRepository implements TaskRepository {
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
      createdAt: new Date(Date.UTC(2026, 0, 5, 9, 0, 0)).toISOString(),
    };
    this.tasks.set(task.id, task);
    return Promise.resolve(task);
  }

  update(id: string, patch: TaskUpdate): Promise<Task> {
    const existing = this.tasks.get(id);
    if (existing === undefined) {
      return Promise.reject(new Error("No such task"));
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

async function startHarness(deps: CommentRouterDeps): Promise<Harness> {
  const app = express();
  app.use("/api", createCommentRouter(deps));

  const server: Server = app.listen(0);
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
    close: () =>
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
    createdAt: new Date(Date.UTC(2026, 0, 5, 9, 0, 0)).toISOString(),
  };
}

describe("comment thread HTTP API", () => {
  let comments: FakeCommentRepository;
  let tasks: FakeTaskRepository;
  let harness: Harness;

  beforeEach(async () => {
    comments = new FakeCommentRepository();
    tasks = new FakeTaskRepository();
    tasks.seed(seededTask());
    harness = await startHarness({ comments, tasks });
  });

  afterEach(async () => {
    await harness.close();
  });

  function threadUrl(taskId: string): string {
    return `${harness.url}/api/tasks/${taskId}/comments`;
  }

  function postComment(taskId: string, payload: unknown): Promise<Response> {
    return fetch(threadUrl(taskId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  it("lists an empty thread for a task with no comments", async () => {
    const response = await fetch(threadUrl(EXISTING_TASK_ID));
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual([]);
  });

  it("lists the task's comments in creation order", async () => {
    await comments.create(EXISTING_TASK_ID, { body: "Checked with the design team" });
    await comments.create(EXISTING_TASK_ID, { body: "Copy is ready for review" });
    await comments.create("task-other", { body: "Belongs to another task" });

    const response = await fetch(threadUrl(EXISTING_TASK_ID));
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual([
      expect.objectContaining({ body: "Checked with the design team", taskId: EXISTING_TASK_ID }),
      expect.objectContaining({ body: "Copy is ready for review", taskId: EXISTING_TASK_ID }),
    ]);
  });

  it("returns 404 when listing the thread of a task that does not exist", async () => {
    const response = await fetch(threadUrl("task-missing"));
    expect(response.status).toBe(404);
    const body: unknown = await response.json();
    expect(body).toMatchObject({ error: "task_not_found" });
  });

  it("creates a comment and returns it, then shows it in the thread", async () => {
    const response = await postComment(EXISTING_TASK_ID, { body: "  Priya reviewed the draft  " });
    expect(response.status).toBe(201);
    const created: unknown = await response.json();
    expect(created).toMatchObject({
      taskId: EXISTING_TASK_ID,
      body: "Priya reviewed the draft",
    });

    const listed = await fetch(threadUrl(EXISTING_TASK_ID));
    const body: unknown = await listed.json();
    expect(body).toEqual([
      expect.objectContaining({ body: "Priya reviewed the draft", taskId: EXISTING_TASK_ID }),
    ]);
  });

  it("rejects an empty comment body with 400 and stores nothing", async () => {
    const response = await postComment(EXISTING_TASK_ID, { body: "   " });
    expect(response.status).toBe(400);
    const body: unknown = await response.json();
    expect(body).toMatchObject({ error: "invalid_body" });
    expect(comments.stored()).toHaveLength(0);
  });

  it("rejects a payload with no body field with 400", async () => {
    const response = await postComment(EXISTING_TASK_ID, { note: "Priya reviewed the draft" });
    expect(response.status).toBe(400);
    expect(comments.stored()).toHaveLength(0);
  });

  it("returns 404 when commenting on a task that does not exist", async () => {
    const response = await postComment("task-missing", { body: "Priya reviewed the draft" });
    expect(response.status).toBe(404);
    const body: unknown = await response.json();
    expect(body).toMatchObject({ error: "task_not_found" });
    expect(comments.stored()).toHaveLength(0);
  });
});
