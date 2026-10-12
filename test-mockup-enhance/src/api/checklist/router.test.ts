// @vitest-environment node
import express from "express";
import type { Router } from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CHECKLIST_ITEMS_ROUTE_PATH,
  CHECKLIST_ITEM_ROUTE_PATH,
  CHECKLIST_SUMMARY_ROUTE_PATH,
  createChecklistRouter,
  type ChecklistTaskLookup,
} from "./router.js";
import {
  MissingChecklistTitleError,
  type ChecklistRepository,
} from "../../data/checklist/checklistRepository.js";
import {
  CHECKLIST_ROUTE_PATHS,
  compareChecklistItems,
  countChecklistProgress,
  normaliseChecklistTitle,
  uniqueTaskIds,
  type ChecklistItem,
  type ChecklistItemInput,
  type ChecklistProgress,
} from "../../models/checklist/index.js";

/** An in-memory checklist store implementing the full shared interface. */
class FakeChecklistRepository implements ChecklistRepository {
  private readonly rows: ChecklistItem[] = [];
  private sequence = 0;

  async listByTask(taskId: string): Promise<ChecklistItem[]> {
    return this.rows
      .filter((row: ChecklistItem): boolean => row.taskId === taskId)
      .sort(compareChecklistItems)
      .map((row: ChecklistItem): ChecklistItem => ({ ...row }));
  }

  async create(input: ChecklistItemInput): Promise<ChecklistItem> {
    const title = normaliseChecklistTitle(input.title);
    if (title === "") {
      throw new MissingChecklistTitleError();
    }
    this.sequence += 1;
    const position =
      this.rows.filter((row: ChecklistItem): boolean => row.taskId === input.taskId).length + 1;
    const created: ChecklistItem = {
      id: `checklist-${String(this.sequence)}`,
      taskId: input.taskId,
      title,
      done: false,
      position,
      createdAt: new Date(Date.UTC(2026, 2, 1, 9, 0, this.sequence)).toISOString(),
    };
    this.rows.push(created);
    return { ...created };
  }

  async setDone(taskId: string, itemId: string, done: boolean): Promise<ChecklistItem | null> {
    const index = this.rows.findIndex(
      (row: ChecklistItem): boolean => row.id === itemId && row.taskId === taskId,
    );
    const current = index === -1 ? undefined : this.rows[index];
    if (current === undefined) {
      return null;
    }
    const next: ChecklistItem = { ...current, done };
    this.rows[index] = next;
    return { ...next };
  }

  async remove(taskId: string, itemId: string): Promise<boolean> {
    const index = this.rows.findIndex(
      (row: ChecklistItem): boolean => row.id === itemId && row.taskId === taskId,
    );
    if (index === -1) {
      return false;
    }
    this.rows.splice(index, 1);
    return true;
  }

  async progress(taskIds?: readonly string[]): Promise<ChecklistProgress[]> {
    if (taskIds === undefined) {
      const seen: string[] = [];
      for (const row of this.rows) {
        if (!seen.includes(row.taskId)) {
          seen.push(row.taskId);
        }
      }
      return seen.map(
        (taskId: string): ChecklistProgress => countChecklistProgress(taskId, this.rows),
      );
    }
    return uniqueTaskIds(taskIds).map(
      (taskId: string): ChecklistProgress => countChecklistProgress(taskId, this.rows),
    );
  }

  /** Everything stored, for assertions about writes that must not happen. */
  stored(): readonly ChecklistItem[] {
    return this.rows;
  }
}

const EXISTING_TASK_ID = "task-alpha";
const OTHER_TASK_ID = "task-beta";

/** A task lookup that knows the two seeded tasks and nothing else. */
const TASKS: ChecklistTaskLookup = {
  findById(taskId: string): Promise<{ id: string } | null> {
    return Promise.resolve(
      taskId === EXISTING_TASK_ID || taskId === OTHER_TASK_ID ? { id: taskId } : null,
    );
  },
};

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

function fields(body: unknown): Record<string, unknown> {
  expect(typeof body).toBe("object");
  expect(body).not.toBeNull();
  return body as Record<string, unknown>;
}

function rows(body: unknown): Record<string, unknown>[] {
  expect(Array.isArray(body)).toBe(true);
  return body as Record<string, unknown>[];
}

let repo: FakeChecklistRepository;
let harness: Harness;

beforeEach(async () => {
  repo = new FakeChecklistRepository();
  harness = await startHarness(createChecklistRouter(repo, { tasks: TASKS }));
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

function itemsPath(taskId: string): string {
  return `/api/tasks/${taskId}/checklist`;
}

function itemPath(taskId: string, itemId: string): string {
  return `/api/tasks/${taskId}/checklist/${itemId}`;
}

describe("the checklist route strings", () => {
  it("come from the shared route table, relative to the /api mount", () => {
    expect(CHECKLIST_ITEMS_ROUTE_PATH).toBe(CHECKLIST_ROUTE_PATHS.items);
    expect(CHECKLIST_ITEM_ROUTE_PATH).toBe(CHECKLIST_ROUTE_PATHS.item);
    expect(CHECKLIST_SUMMARY_ROUTE_PATH).toBe(CHECKLIST_ROUTE_PATHS.summary);
  });
});

describe("GET /api/tasks/:taskId/checklist", () => {
  it("serves an empty checklist for a task with no items", async () => {
    const response = await send(itemsPath(EXISTING_TASK_ID));

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual([]);
  });

  it("serves the task's own items, ordered by position", async () => {
    await repo.create({ taskId: EXISTING_TASK_ID, title: "Draft the Alex QA brief" });
    await repo.create({ taskId: EXISTING_TASK_ID, title: "Review with Priya Lunch" });
    await repo.create({ taskId: OTHER_TASK_ID, title: "Another task's step" });

    const response = await send(itemsPath(EXISTING_TASK_ID));
    expect(response.status).toBe(200);

    const listed = rows(await response.json());
    expect(listed.map((row: Record<string, unknown>): unknown => row.title)).toEqual([
      "Draft the Alex QA brief",
      "Review with Priya Lunch",
    ]);
    expect(listed.map((row: Record<string, unknown>): unknown => row.position)).toEqual([1, 2]);
    for (const row of listed) {
      expect(row.taskId).toBe(EXISTING_TASK_ID);
      expect(row.done).toBe(false);
      expect(typeof row.id).toBe("string");
      expect(typeof row.createdAt).toBe("string");
    }
  });

  it("answers 404 for a task that does not exist", async () => {
    const response = await send(itemsPath("task-missing"));

    expect(response.status).toBe(404);
    const body = fields(await response.json());
    expect(body.error).toBe("task_not_found");
    expect(body.message).toBe("That task does not exist.");
  });
});

describe("POST /api/tasks/:taskId/checklist", () => {
  it("creates an item at the end of the list and returns it", async () => {
    const first = await send(
      itemsPath(EXISTING_TASK_ID),
      jsonInit("POST", { title: "  Draft the   Alex QA brief " }),
    );
    expect(first.status).toBe(201);

    const created = fields(await first.json());
    expect(created.taskId).toBe(EXISTING_TASK_ID);
    expect(created.title).toBe("Draft the Alex QA brief");
    expect(created.done).toBe(false);
    expect(created.position).toBe(1);
    expect(typeof created.id).toBe("string");

    const second = await send(
      itemsPath(EXISTING_TASK_ID),
      jsonInit("POST", { title: "Review with Priya Lunch" }),
    );
    expect(second.status).toBe(201);
    expect(fields(await second.json()).position).toBe(2);

    const listed = await send(itemsPath(EXISTING_TASK_ID));
    expect(rows(await listed.json())).toHaveLength(2);
  });

  it("rejects a blank title with 400 and stores nothing", async () => {
    const response = await send(itemsPath(EXISTING_TASK_ID), jsonInit("POST", { title: "   " }));

    expect(response.status).toBe(400);
    const body = fields(await response.json());
    expect(body.error).toBe("invalid_title");
    expect(body.message).toBe("A checklist item title is required.");
    expect(repo.stored()).toHaveLength(0);
  });

  it("rejects a payload with no title at all with 400", async () => {
    const missing = await send(itemsPath(EXISTING_TASK_ID), jsonInit("POST", {}));
    expect(missing.status).toBe(400);

    const wrongType = await send(itemsPath(EXISTING_TASK_ID), jsonInit("POST", { title: 42 }));
    expect(wrongType.status).toBe(400);

    const notAnObject = await send(itemsPath(EXISTING_TASK_ID), jsonInit("POST", ["a step"]));
    expect(notAnObject.status).toBe(400);

    expect(repo.stored()).toHaveLength(0);
  });

  it("answers 404 when the task does not exist", async () => {
    const response = await send(
      itemsPath("task-missing"),
      jsonInit("POST", { title: "Nowhere to put this" }),
    );

    expect(response.status).toBe(404);
    expect(fields(await response.json()).error).toBe("task_not_found");
    expect(repo.stored()).toHaveLength(0);
  });
});

describe("PATCH /api/tasks/:taskId/checklist/:itemId", () => {
  it("sets done as the request asks, leaving the rest of the list alone", async () => {
    const first = await repo.create({ taskId: EXISTING_TASK_ID, title: "Step one" });
    await repo.create({ taskId: EXISTING_TASK_ID, title: "Step two" });

    const ticked = await send(
      itemPath(EXISTING_TASK_ID, first.id),
      jsonInit("PATCH", { done: true }),
    );
    expect(ticked.status).toBe(200);

    const updated = fields(await ticked.json());
    expect(updated.id).toBe(first.id);
    expect(updated.done).toBe(true);
    expect(updated.position).toBe(first.position);
    expect(updated.title).toBe("Step one");

    const listed = rows(await (await send(itemsPath(EXISTING_TASK_ID))).json());
    expect(listed.map((row: Record<string, unknown>): unknown => row.done)).toEqual([true, false]);
  });

  it("toggles the stored flag when the request does not say", async () => {
    const item = await repo.create({ taskId: EXISTING_TASK_ID, title: "Step one" });

    const ticked = await send(itemPath(EXISTING_TASK_ID, item.id), { method: "PATCH" });
    expect(ticked.status).toBe(200);
    expect(fields(await ticked.json()).done).toBe(true);

    const unticked = await send(itemPath(EXISTING_TASK_ID, item.id), { method: "PATCH" });
    expect(unticked.status).toBe(200);
    expect(fields(await unticked.json()).done).toBe(false);
  });

  it("answers 404 for an item the task does not have", async () => {
    const mine = await repo.create({ taskId: EXISTING_TASK_ID, title: "Step one" });

    const unknown = await send(
      itemPath(EXISTING_TASK_ID, "checklist-nope"),
      jsonInit("PATCH", { done: true }),
    );
    expect(unknown.status).toBe(404);
    const body = fields(await unknown.json());
    expect(body.error).toBe("checklist_item_not_found");
    expect(body.message).toBe("That checklist item does not exist.");

    // …and an item of ANOTHER task can never be ticked through this task.
    const elsewhere = await send(
      itemPath(OTHER_TASK_ID, mine.id),
      jsonInit("PATCH", { done: true }),
    );
    expect(elsewhere.status).toBe(404);

    expect(repo.stored()[0]?.done).toBe(false);
  });
});

describe("DELETE /api/tasks/:taskId/checklist/:itemId", () => {
  it("removes the item straight away and answers 204 with no body", async () => {
    const first = await repo.create({ taskId: EXISTING_TASK_ID, title: "Step one" });
    await repo.create({ taskId: EXISTING_TASK_ID, title: "Step two" });

    const response = await send(itemPath(EXISTING_TASK_ID, first.id), { method: "DELETE" });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");

    const listed = rows(await (await send(itemsPath(EXISTING_TASK_ID))).json());
    expect(listed.map((row: Record<string, unknown>): unknown => row.title)).toEqual(["Step two"]);
  });

  it("answers 404 when there is nothing to remove", async () => {
    const mine = await repo.create({ taskId: EXISTING_TASK_ID, title: "Step one" });

    const unknown = await send(itemPath(EXISTING_TASK_ID, "checklist-nope"), {
      method: "DELETE",
    });
    expect(unknown.status).toBe(404);
    expect(fields(await unknown.json()).error).toBe("checklist_item_not_found");

    const elsewhere = await send(itemPath(OTHER_TASK_ID, mine.id), { method: "DELETE" });
    expect(elsewhere.status).toBe(404);

    expect(repo.stored()).toHaveLength(1);
  });
});

describe("GET /api/checklist/summary", () => {
  it("reports every task that has a checklist", async () => {
    const first = await repo.create({ taskId: EXISTING_TASK_ID, title: "Step one" });
    await repo.create({ taskId: EXISTING_TASK_ID, title: "Step two" });
    await repo.create({ taskId: OTHER_TASK_ID, title: "Only step" });
    await repo.setDone(EXISTING_TASK_ID, first.id, true);

    const response = await send("/api/checklist/summary");
    expect(response.status).toBe(200);

    const body: unknown = await response.json();
    expect(body).toEqual([
      { taskId: EXISTING_TASK_ID, done: 1, total: 2 },
      { taskId: OTHER_TASK_ID, done: 0, total: 1 },
    ]);
  });

  it("reports nothing at all when no task has a checklist", async () => {
    const response = await send("/api/checklist/summary");

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual([]);
  });

  it("reports just the tasks the query names, in the order asked for", async () => {
    const first = await repo.create({ taskId: EXISTING_TASK_ID, title: "Step one" });
    await repo.create({ taskId: EXISTING_TASK_ID, title: "Step two" });
    await repo.setDone(EXISTING_TASK_ID, first.id, true);

    const response = await send(
      `/api/checklist/summary?taskIds=${OTHER_TASK_ID},${EXISTING_TASK_ID}`,
    );
    expect(response.status).toBe(200);

    const body: unknown = await response.json();
    expect(body).toEqual([
      { taskId: OTHER_TASK_ID, done: 0, total: 0 },
      { taskId: EXISTING_TASK_ID, done: 1, total: 2 },
    ]);
  });
});

describe("the pinned one-argument form", () => {
  it("serves the checklist with no task lookup wired in", async () => {
    const plain = new FakeChecklistRepository();
    const bare = await startHarness(createChecklistRouter(plain));
    try {
      const created = await fetch(
        `${bare.url}${itemsPath(EXISTING_TASK_ID)}`,
        jsonInit("POST", { title: "Step one" }),
      );
      expect(created.status).toBe(201);

      const listed = await fetch(`${bare.url}${itemsPath(EXISTING_TASK_ID)}`);
      expect(listed.status).toBe(200);
      expect(rows(await listed.json())).toHaveLength(1);
    } finally {
      await bare.close();
    }
  });
});
