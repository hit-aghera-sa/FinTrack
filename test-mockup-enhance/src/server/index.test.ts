import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createServer } from "./index.js";

interface Captured {
  status: number;
  body: unknown;
}

let server: Server | null = null;
let baseUrl = "";

async function call(method: string, route: string, payload?: unknown): Promise<Captured> {
  const init: RequestInit =
    payload === undefined
      ? { method }
      : {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        };
  const response = await fetch(`${baseUrl}${route}`, init);
  const text = await response.text();
  let body: unknown = null;
  if (text !== "") {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  return { status: response.status, body };
}

function firstTaskId(body: unknown): string {
  if (!Array.isArray(body) || body.length === 0) {
    throw new Error("The task list endpoint returned no tasks.");
  }
  const first: unknown = body[0];
  if (typeof first !== "object" || first === null || !("id" in first)) {
    throw new Error("A listed task carries no id.");
  }
  const id: unknown = first.id;
  if (typeof id !== "string") {
    throw new Error("A listed task id is not a string.");
  }
  return id;
}

/** The fields of a JSON object body, for assertions about a single payload. */
function fields(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("The endpoint did not return a JSON object.");
  }
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    record[key] = value;
  }
  return record;
}

beforeAll(async () => {
  process.env.APP_DB = "memory";
  const app = createServer();
  const listening = await new Promise<Server>((resolve) => {
    const started = app.listen(0, () => {
      resolve(started);
    });
  });
  server = listening;
  const address = listening.address();
  if (address === null || typeof address === "string") {
    throw new Error("The test server did not report a TCP address.");
  }
  const info: AddressInfo = address;
  baseUrl = `http://127.0.0.1:${String(info.port)}`;
});

afterAll(async () => {
  const running = server;
  server = null;
  if (running === null) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    running.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

describe("server composition root", () => {
  it("answers the health endpoint", async () => {
    const result = await call("GET", "/api/health");

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: "ok" });
  });

  it("mounts the task router under /api", async () => {
    const result = await call("GET", "/api/tasks");

    expect(result.status).toBe(200);
    expect(Array.isArray(result.body)).toBe(true);
    expect(firstTaskId(result.body).length).toBeGreaterThan(0);
  });

  it("creates a task through the mounted task router", async () => {
    const result = await call("POST", "/api/tasks", { title: "Shell wiring check run-c4" });

    expect([200, 201]).toContain(result.status);

    const listed = await call("GET", "/api/tasks");
    const titles = Array.isArray(listed.body)
      ? listed.body.map((task: unknown) =>
          typeof task === "object" && task !== null && "title" in task ? task.title : null,
        )
      : [];
    expect(titles).toContain("Shell wiring check run-c4");
  });

  it("mounts the comment router under /api", async () => {
    const tasks = await call("GET", "/api/tasks");
    const taskId = firstTaskId(tasks.body);

    const thread = await call("GET", `/api/tasks/${taskId}/comments`);

    expect(thread.status).toBe(200);
    expect(Array.isArray(thread.body)).toBe(true);
  });

  it("mounts the team router under /api", async () => {
    const result = await call("GET", "/api/members");

    expect(result.status).toBe(200);
    expect(Array.isArray(result.body)).toBe(true);
    expect(Array.isArray(result.body) ? result.body.length : 0).toBeGreaterThan(0);
  });

  it("mounts the label router under /api", async () => {
    const result = await call("GET", "/api/labels");

    expect(result.status).toBe(200);
    // A bare array, or an envelope carrying one: either way the labels are served.
    const listed: unknown = Array.isArray(result.body)
      ? result.body
      : fields(result.body).labels;
    expect(Array.isArray(listed)).toBe(true);
  });

  it("mounts the report router under /api", async () => {
    const result = await call("GET", "/api/reports");

    expect(result.status).toBe(200);

    const payload = fields(result.body);
    expect(typeof payload.generatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(String(payload.generatedAt)))).toBe(false);
    expect(Array.isArray(payload.members)).toBe(true);
  });

  it("reports one entry per roster member, with numeric counts", async () => {
    const roster = await call("GET", "/api/members");
    const rosterSize = Array.isArray(roster.body) ? roster.body.length : 0;

    const report = await call("GET", "/api/reports");
    const members = fields(report.body).members;
    expect(Array.isArray(members)).toBe(true);
    const rows: unknown[] = Array.isArray(members) ? members : [];
    expect(rows).toHaveLength(rosterSize);

    for (const row of rows) {
      const entry = fields(row);
      expect(typeof entry.memberId).toBe("string");
      expect(typeof entry.memberName).toBe("string");
      expect(typeof entry.role).toBe("string");
      expect(typeof entry.todo).toBe("number");
      expect(typeof entry.doing).toBe("number");
      expect(typeof entry.done).toBe("number");
      expect(typeof entry.overdue).toBe("number");
      expect(typeof entry.total).toBe("number");
    }
  });

  it("answers an unknown api address with a json 404, never the client shell", async () => {
    const result = await call("GET", "/api/not-a-real-endpoint");

    expect(result.status).toBe(404);
    expect(result.body).toEqual({ message: "Unknown API endpoint" });
  });

  it("keeps the web root for the client shell", async () => {
    const result = await call("GET", "/team");

    // 200 once the client bundle exists in dist/, 503 with the build hint before then.
    expect([200, 503]).toContain(result.status);
  });

  it("keeps the reports address for the client shell too", async () => {
    const result = await call("GET", "/reports");

    expect([200, 503]).toContain(result.status);
  });
});
