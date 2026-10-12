// @vitest-environment node
/// <reference types="node" />
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createServer } from "./index.js";

// The assembled server is booted on the in-memory datastore, so the wiring can
// be exercised with no external database. Read at startup by createServer().
process.env.APP_DB = "memory";

/** One task, as the mounted task router serialises it. */
interface TaskRow {
  id: string;
  title: string;
  status: string;
}

/** One checklist item, as the mounted checklist router serialises it. */
interface ChecklistRow {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  position: number;
}

/** One task's progress counts. */
interface ProgressRow {
  taskId: string;
  done: number;
  total: number;
}

let server: Server;
let base = "";

function url(path: string): string {
  return `${base}${path}`;
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}

async function createTask(title: string): Promise<TaskRow> {
  const response = await fetch(url("/api/tasks"), jsonInit("POST", { title }));
  expect([200, 201]).toContain(response.status);
  const body: unknown = await response.json();
  return body as TaskRow;
}

async function listItems(taskId: string): Promise<ChecklistRow[]> {
  const response = await fetch(url(`/api/tasks/${taskId}/checklist`));
  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  expect(Array.isArray(body)).toBe(true);
  return body as ChecklistRow[];
}

async function addItem(taskId: string, title: string): Promise<ChecklistRow> {
  const response = await fetch(
    url(`/api/tasks/${taskId}/checklist`),
    jsonInit("POST", { title }),
  );
  expect(response.status).toBe(201);
  const body: unknown = await response.json();
  return body as ChecklistRow;
}

beforeAll(async () => {
  server = createServer().listen(0);
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
  base = `http://127.0.0.1:${String(port)}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
});

describe("the assembled server's checklist wiring", () => {
  it("serves an empty checklist for a task that has no items", async () => {
    const task = await createTask("Alex QA wiring empty");

    expect(await listItems(task.id)).toEqual([]);
  });

  it("creates, ticks and removes an item through the mounted router", async () => {
    const task = await createTask("Alex QA wiring lifecycle");

    const first = await addItem(task.id, "  Draft the   release note ");
    expect(first.taskId).toBe(task.id);
    expect(first.title).toBe("Draft the release note");
    expect(first.done).toBe(false);
    expect(first.position).toBe(1);

    const second = await addItem(task.id, "Review with Priya Lunch");
    expect(second.position).toBe(2);

    const ticked = await fetch(
      url(`/api/tasks/${task.id}/checklist/${first.id}`),
      jsonInit("PATCH", { done: true }),
    );
    expect(ticked.status).toBe(200);
    const updated = (await ticked.json()) as ChecklistRow;
    expect(updated.id).toBe(first.id);
    expect(updated.done).toBe(true);

    const removed = await fetch(url(`/api/tasks/${task.id}/checklist/${second.id}`), {
      method: "DELETE",
    });
    expect(removed.status).toBe(204);
    expect(await removed.text()).toBe("");

    const remaining = await listItems(task.id);
    expect(remaining.map((row: ChecklistRow): string => row.title)).toEqual([
      "Draft the release note",
    ]);
  });

  it("reports the progress counts the board card reads", async () => {
    const task = await createTask("Priya Lunch wiring summary");
    const first = await addItem(task.id, "Collect the notes");
    await addItem(task.id, "Send the summary");

    const ticked = await fetch(
      url(`/api/tasks/${task.id}/checklist/${first.id}`),
      jsonInit("PATCH", { done: true }),
    );
    expect(ticked.status).toBe(200);

    const response = await fetch(url("/api/checklist/summary"));
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(Array.isArray(body)).toBe(true);
    const counts = body as ProgressRow[];
    const row = counts.find((entry: ProgressRow): boolean => entry.taskId === task.id);
    expect(row).toBeDefined();
    expect(row?.done).toBe(1);
    expect(row?.total).toBe(2);
  });

  it("refuses a blank title and an unknown task", async () => {
    const task = await createTask("Alex QA wiring refusals");

    const blank = await fetch(
      url(`/api/tasks/${task.id}/checklist`),
      jsonInit("POST", { title: "   " }),
    );
    expect(blank.status).toBe(400);

    const unknownTask = await fetch(url("/api/tasks/task-missing/checklist"));
    expect(unknownTask.status).toBe(404);

    const unknownItem = await fetch(
      url(`/api/tasks/${task.id}/checklist/checklist-nope`),
      jsonInit("PATCH", { done: true }),
    );
    expect(unknownItem.status).toBe(404);

    expect(await listItems(task.id)).toEqual([]);
  });

  it("leaves the task's own status alone when every item is ticked", async () => {
    const task = await createTask("Alex QA wiring independent");
    expect(task.status).toBe("todo");

    const only = await addItem(task.id, "The last step");
    const ticked = await fetch(
      url(`/api/tasks/${task.id}/checklist/${only.id}`),
      jsonInit("PATCH", { done: true }),
    );
    expect(ticked.status).toBe(200);

    const reloaded = await fetch(url(`/api/tasks/${task.id}`));
    expect(reloaded.status).toBe(200);
    const stored = (await reloaded.json()) as TaskRow;
    expect(stored.status).toBe("todo");
  });

  it("answers an unknown /api address with a JSON 404 rather than the client shell", async () => {
    const response = await fetch(url("/api/not-a-real-checklist-endpoint"));

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type") ?? "").toContain("application/json");
  });
});
