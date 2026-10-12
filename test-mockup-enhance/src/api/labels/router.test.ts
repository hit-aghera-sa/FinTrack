// @vitest-environment node
import express from "express";
import type { Router } from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLabelRouter, MAX_LABEL_NAME_LENGTH, type LabelRouterDeps } from "./router.js";
import {
  DuplicateLabelNameError,
  UnknownLabelError,
  type LabelRepository,
} from "./repository.js";
import type { TaskRepository } from "../../db/taskRepository.js";
import {
  compareLabels,
  normaliseLabelName,
  sameLabelName,
  type Label,
  type LabelColor,
  type NewLabel,
} from "../../models/label.js";
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  type NewTask,
  type Task,
  type TaskUpdate,
} from "../../models/task.js";

/** An in-memory label store implementing the full shared interface. */
class StubLabelRepository implements LabelRepository {
  private readonly rows: Label[] = [];
  private readonly assigned = new Map<string, string[]>();
  private sequence = 0;

  /** Puts a label in place without going through the HTTP surface. */
  seed(name: string, color: LabelColor): Label {
    return this.insert({ name, color });
  }

  async list(): Promise<Label[]> {
    return [...this.rows].sort(compareLabels);
  }

  async create(input: NewLabel): Promise<Label> {
    return this.insert(input);
  }

  async listForTask(taskId: string): Promise<Label[]> {
    return this.resolve(this.assigned.get(taskId) ?? []);
  }

  async replaceTaskLabels(taskId: string, labelIds: readonly string[]): Promise<Label[]> {
    const unknown = labelIds.filter(
      (id: string): boolean => !this.rows.some((row: Label): boolean => row.id === id),
    );
    if (unknown.length > 0) {
      throw new UnknownLabelError(unknown);
    }
    const unique: string[] = [];
    for (const id of labelIds) {
      if (!unique.includes(id)) {
        unique.push(id);
      }
    }
    this.assigned.set(taskId, unique);
    return this.resolve(unique);
  }

  /** Everything stored, for assertions about writes that must not happen. */
  stored(): readonly Label[] {
    return this.rows;
  }

  /** The ids attached to one task. */
  attached(taskId: string): readonly string[] {
    return this.assigned.get(taskId) ?? [];
  }

  private insert(input: NewLabel): Label {
    const name = normaliseLabelName(input.name);
    if (this.rows.some((row: Label): boolean => sameLabelName(row.name, name))) {
      throw new DuplicateLabelNameError(name);
    }
    this.sequence += 1;
    const label: Label = { id: `label-${String(this.sequence)}`, name, color: input.color };
    this.rows.push(label);
    return label;
  }

  private resolve(ids: readonly string[]): Label[] {
    const found: Label[] = [];
    for (const id of ids) {
      const row = this.rows.find((candidate: Label): boolean => candidate.id === id);
      if (row !== undefined) {
        found.push(row);
      }
    }
    return found.sort(compareLabels);
  }
}

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

function nameList(body: unknown): unknown[] {
  return rows(body).map((row: Record<string, unknown>): unknown => row.name);
}

describe("label HTTP API", () => {
  let labels: StubLabelRepository;
  let tasks: StubTaskRepository;
  let harness: Harness;

  beforeEach(async () => {
    labels = new StubLabelRepository();
    tasks = new StubTaskRepository();
    tasks.seed(seededTask());
    const deps: LabelRouterDeps = { labels, tasks };
    harness = await startHarness(createLabelRouter(deps));
  });

  afterEach(async () => {
    await harness.close();
  });

  function send(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${harness.url}${path}`, init);
  }

  function jsonInit(method: string, payload: unknown): RequestInit {
    return {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    };
  }

  describe("GET /api/labels", () => {
    it("returns an empty list when there are no labels", async () => {
      const response = await send("/api/labels");
      expect(response.status).toBe(200);
      const body: unknown = await response.json();
      expect(body).toEqual([]);
    });

    it("returns every label ordered by name", async () => {
      labels.seed("Urgent", "warning");
      labels.seed("Backend", "primary");
      labels.seed("Design", "info");

      const response = await send("/api/labels");
      expect(response.status).toBe(200);
      const body: unknown = await response.json();
      expect(nameList(body)).toEqual(["Backend", "Design", "Urgent"]);
    });
  });

  describe("POST /api/labels", () => {
    it("creates a label and returns 201 with it", async () => {
      const response = await send(
        "/api/labels",
        jsonInit("POST", { name: "  Needs   design ", color: "info" }),
      );
      expect(response.status).toBe(201);

      const created = fields(await response.json());
      expect(created.name).toBe("Needs design");
      expect(created.color).toBe("info");
      expect(typeof created.id).toBe("string");
      expect(labels.stored()).toHaveLength(1);

      const listed = await send("/api/labels");
      expect(nameList(await listed.json())).toEqual(["Needs design"]);
    });

    it("rejects a blank name with 400 and stores nothing", async () => {
      const response = await send("/api/labels", jsonInit("POST", { name: "   ", color: "info" }));
      expect(response.status).toBe(400);

      const body = fields(await response.json());
      expect(body.error).toBe("invalid_name");
      expect(typeof body.message).toBe("string");
      expect(labels.stored()).toHaveLength(0);
    });

    it("rejects a payload with no name with 400", async () => {
      const response = await send("/api/labels", jsonInit("POST", { color: "info" }));
      expect(response.status).toBe(400);
      expect(labels.stored()).toHaveLength(0);
    });

    it("rejects a name longer than the maximum with 400", async () => {
      const response = await send(
        "/api/labels",
        jsonInit("POST", { name: "a".repeat(MAX_LABEL_NAME_LENGTH + 1), color: "info" }),
      );
      expect(response.status).toBe(400);
      const body = fields(await response.json());
      expect(String(body.message)).toContain(String(MAX_LABEL_NAME_LENGTH));
      expect(labels.stored()).toHaveLength(0);
    });

    it("rejects a colour outside the allowed list with 400", async () => {
      const response = await send(
        "/api/labels",
        jsonInit("POST", { name: "Needs design", color: "chartreuse" }),
      );
      expect(response.status).toBe(400);

      const body = fields(await response.json());
      expect(body.error).toBe("invalid_color");
      expect(String(body.message)).toContain("neutral");
      expect(labels.stored()).toHaveLength(0);
    });

    it("rejects a missing colour with 400", async () => {
      const response = await send("/api/labels", jsonInit("POST", { name: "Needs design" }));
      expect(response.status).toBe(400);
      expect(labels.stored()).toHaveLength(0);
    });

    it("rejects a payload that is not an object with 400", async () => {
      const response = await send("/api/labels", jsonInit("POST", ["Needs design"]));
      expect(response.status).toBe(400);
      expect(labels.stored()).toHaveLength(0);
    });

    it("answers 409 when the name already exists", async () => {
      labels.seed("Design", "info");

      const response = await send(
        "/api/labels",
        jsonInit("POST", { name: "design", color: "danger" }),
      );
      expect(response.status).toBe(409);

      const body = fields(await response.json());
      expect(body.error).toBe("duplicate_label_name");
      expect(String(body.message)).toContain("already exists");
      expect(labels.stored()).toHaveLength(1);
    });
  });

  describe("PUT /api/tasks/:taskId/labels", () => {
    it("replaces the task's label set and returns the resulting labels", async () => {
      const design = labels.seed("Design", "info");
      const urgent = labels.seed("Urgent", "warning");

      const response = await send(
        `/api/tasks/${EXISTING_TASK_ID}/labels`,
        jsonInit("PUT", { labelIds: [urgent.id, design.id] }),
      );
      expect(response.status).toBe(200);
      expect(nameList(await response.json())).toEqual(["Design", "Urgent"]);
      expect(labels.attached(EXISTING_TASK_ID)).toEqual([urgent.id, design.id]);

      const replaced = await send(
        `/api/tasks/${EXISTING_TASK_ID}/labels`,
        jsonInit("PUT", { labelIds: [design.id] }),
      );
      expect(replaced.status).toBe(200);
      expect(nameList(await replaced.json())).toEqual(["Design"]);
      expect(labels.attached(EXISTING_TASK_ID)).toEqual([design.id]);
    });

    it("clears the set when given an empty array", async () => {
      const design = labels.seed("Design", "info");
      await labels.replaceTaskLabels(EXISTING_TASK_ID, [design.id]);

      const response = await send(
        `/api/tasks/${EXISTING_TASK_ID}/labels`,
        jsonInit("PUT", { labelIds: [] }),
      );
      expect(response.status).toBe(200);
      const body: unknown = await response.json();
      expect(body).toEqual([]);
      expect(labels.attached(EXISTING_TASK_ID)).toEqual([]);
    });

    it("answers 404 when the task does not exist", async () => {
      const design = labels.seed("Design", "info");

      const response = await send(
        "/api/tasks/task-missing/labels",
        jsonInit("PUT", { labelIds: [design.id] }),
      );
      expect(response.status).toBe(404);

      const body = fields(await response.json());
      expect(body.error).toBe("task_not_found");
      expect(labels.attached("task-missing")).toEqual([]);
    });

    it("rejects a payload with no labelIds array with 400", async () => {
      const response = await send(
        `/api/tasks/${EXISTING_TASK_ID}/labels`,
        jsonInit("PUT", { labels: ["Design"] }),
      );
      expect(response.status).toBe(400);

      const body = fields(await response.json());
      expect(body.error).toBe("invalid_label_ids");
      expect(labels.attached(EXISTING_TASK_ID)).toEqual([]);
    });

    it("rejects labelIds holding something other than ids with 400", async () => {
      const response = await send(
        `/api/tasks/${EXISTING_TASK_ID}/labels`,
        jsonInit("PUT", { labelIds: [42] }),
      );
      expect(response.status).toBe(400);
      expect(labels.attached(EXISTING_TASK_ID)).toEqual([]);
    });

    it("rejects a label that does not exist with 400", async () => {
      const response = await send(
        `/api/tasks/${EXISTING_TASK_ID}/labels`,
        jsonInit("PUT", { labelIds: ["label-nope"] }),
      );
      expect(response.status).toBe(400);

      const body = fields(await response.json());
      expect(body.error).toBe("unknown_label");
      expect(labels.attached(EXISTING_TASK_ID)).toEqual([]);
    });
  });
});
