// @vitest-environment node
import express, { type Router } from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { createReportRouter } from "./router.js";
import type { ReportRepository } from "./repository.js";
import type { MemberReport } from "./types.js";
import { buildMemberReports } from "./workload.js";
import type { TeamMember } from "../../models/member.js";
import { DEFAULT_TASK_PRIORITY, type Task, type TaskStatus } from "../../models/task.js";

/** The server clock the router is pinned to in these tests. */
const NOW = new Date("2026-03-10T09:00:00.000Z");

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

/** A fake report repository: in-memory fixtures, no database anywhere. */
interface FakeReportRepository extends ReportRepository {
  readonly asked: string[];
}

function createFakeReportRepository(
  members: readonly TeamMember[],
  tasks: readonly Task[],
): FakeReportRepository {
  const asked: string[] = [];
  return {
    asked,
    memberWorkload(today: string): Promise<MemberReport[]> {
      asked.push(today);
      return Promise.resolve(buildMemberReports(members, tasks, today));
    },
  };
}

/** A repository whose query fails, to exercise the 500 problem response. */
function createFailingRepository(message: string): ReportRepository {
  return {
    memberWorkload: (): Promise<MemberReport[]> => Promise.reject(new Error(message)),
  };
}

interface Harness {
  readonly url: string;
  readonly close: () => Promise<void>;
}

async function start(router: Router): Promise<Harness> {
  const app = express();
  app.use("/api", router);
  const server: Server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("The test server did not report a port.");
  }

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    close: (): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        server.close((error?: Error): void => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

let harness: Harness | null = null;

afterEach(async () => {
  if (harness !== null) {
    await harness.close();
    harness = null;
  }
});

async function mount(repository: ReportRepository): Promise<string> {
  harness = await start(createReportRouter({ reports: repository, now: () => NOW }));
  return harness.url;
}

function fields(body: unknown): Record<string, unknown> {
  expect(typeof body).toBe("object");
  expect(body).not.toBeNull();
  return body as Record<string, unknown>;
}

describe("GET /api/reports", () => {
  it("reports every member with the status breakdown, the overdue count and the total", async () => {
    const tasks: Task[] = [
      // Priya: two To do (one overdue, one due today), one Doing, one Done that is
      // long past its due date and therefore NOT overdue.
      makeTask("t-late", PRIYA.id, "todo", "2026-03-01"),
      makeTask("t-today", PRIYA.id, "todo", "2026-03-10"),
      makeTask("t-doing", PRIYA.id, "doing", null),
      makeTask("t-done-late", PRIYA.id, "done", "2026-02-01"),
      // Alex: a single finished task.
      makeTask("t-alex", ALEX.id, "done", null),
      // Nobody's: never attributed to a member.
      makeTask("t-nobody", null, "todo", "2026-01-01"),
    ];
    const repository = createFakeReportRepository([PRIYA, ALEX, MEI], tasks);
    const url = await mount(repository);

    const response = await fetch(`${url}/api/reports`);
    const body: unknown = await response.json();

    expect(response.status).toBe(200);

    // The date the counts were made against was computed on the server.
    expect(repository.asked).toEqual(["2026-03-10"]);
    expect(fields(body).generatedAt).toBe(NOW.toISOString());

    expect(fields(body).members).toEqual([
      {
        memberId: PRIYA.id,
        memberName: PRIYA.name,
        role: PRIYA.role,
        todo: 2,
        doing: 1,
        done: 1,
        overdue: 1,
        total: 4,
      },
      {
        memberId: ALEX.id,
        memberName: ALEX.name,
        role: ALEX.role,
        todo: 0,
        doing: 0,
        done: 1,
        overdue: 0,
        total: 1,
      },
      // Mei has no tasks at all and still appears, with zeros across the board.
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

  it("covers the whole roster when nobody has a task yet", async () => {
    const url = await mount(createFakeReportRepository([PRIYA, MEI], []));

    const response = await fetch(`${url}/api/reports`);
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(fields(body).members).toEqual([
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

  it("returns an empty member list for an empty roster, with a timestamp", async () => {
    const url = await mount(createFakeReportRepository([], []));

    const response = await fetch(`${url}/api/reports`);
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(fields(body).members).toEqual([]);
    expect(Number.isNaN(Date.parse(String(fields(body).generatedAt)))).toBe(false);
  });

  it("answers 500 with a message field when the query fails", async () => {
    const url = await mount(createFailingRepository("the report query failed"));

    const response = await fetch(`${url}/api/reports`);
    const body: unknown = await response.json();

    expect(response.status).toBe(500);
    expect(fields(body).message).toBe("the report query failed");
  });
});
