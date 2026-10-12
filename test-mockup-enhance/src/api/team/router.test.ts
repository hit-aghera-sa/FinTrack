// @vitest-environment node
import express, { type Router } from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { createTeamRouter } from "./router.js";
import type { TeamMemberRepository } from "../../db/memberRepository.js";
import type {
  NewTeamMember,
  TeamMember,
  TeamMemberWithWorkload,
} from "../../models/member.js";

/** A fake roster repository that records what the router asked it to do. */
interface FakeRepository extends TeamMemberRepository {
  readonly removed: string[];
  readonly created: NewTeamMember[];
}

function createFakeRepository(
  initial: readonly TeamMember[],
  openTaskCounts: ReadonlyMap<string, number> = new Map<string, number>(),
): FakeRepository {
  const roster: TeamMember[] = [...initial];
  const removed: string[] = [];
  const created: NewTeamMember[] = [];
  let sequence = roster.length;

  return {
    removed,
    created,
    async list(): Promise<TeamMember[]> {
      return [...roster];
    },
    async listWithWorkload(): Promise<TeamMemberWithWorkload[]> {
      return roster.map((member: TeamMember): TeamMemberWithWorkload => ({
        id: member.id,
        name: member.name,
        role: member.role,
        openTaskCount: openTaskCounts.get(member.id) ?? 0,
      }));
    },
    async findById(id: string): Promise<TeamMember | null> {
      return roster.find((member: TeamMember): boolean => member.id === id) ?? null;
    },
    async create(input: NewTeamMember): Promise<TeamMember> {
      created.push(input);
      sequence += 1;
      const member: TeamMember = {
        id: `m-${String(sequence)}`,
        name: input.name,
        role: input.role,
      };
      roster.push(member);
      return member;
    },
    async remove(id: string): Promise<void> {
      removed.push(id);
      const index = roster.findIndex((member: TeamMember): boolean => member.id === id);
      if (index >= 0) {
        roster.splice(index, 1);
      }
    },
  };
}

/** A repository whose every call fails, to exercise the 500 path. */
function createFailingRepository(message: string): TeamMemberRepository {
  const fail = async (): Promise<never> => {
    throw new Error(message);
  };
  return {
    list: fail,
    listWithWorkload: fail,
    findById: fail,
    create: fail,
    remove: fail,
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

const PRIYA: TeamMember = { id: "m-1", name: "Priya Natarajan", role: "Engineering Lead" };
const ALEX: TeamMember = { id: "m-2", name: "Alex QA", role: "QA Engineer" };

let harness: Harness | null = null;

afterEach(async () => {
  if (harness !== null) {
    await harness.close();
    harness = null;
  }
});

async function mount(repository: TeamMemberRepository): Promise<string> {
  harness = await start(createTeamRouter({ members: repository }));
  return harness.url;
}

describe("team members HTTP API", () => {
  it("lists every member with the live open-task count", async () => {
    const counts = new Map<string, number>([
      [PRIYA.id, 3],
    ]);
    const url = await mount(createFakeRepository([PRIYA, ALEX], counts));

    const response = await fetch(`${url}/api/members`);
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      { id: PRIYA.id, name: PRIYA.name, role: PRIYA.role, openTaskCount: 3 },
      { id: ALEX.id, name: ALEX.name, role: ALEX.role, openTaskCount: 0 },
    ]);
  });

  it("creates a member from a name and a role, trimming both", async () => {
    const repository = createFakeRepository([PRIYA]);
    const url = await mount(repository);

    const response = await fetch(`${url}/api/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "  Jordan Blake  ", role: "  Product Designer " }),
    });
    const body: unknown = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ id: "m-2", name: "Jordan Blake", role: "Product Designer" });
    expect(repository.created).toEqual([{ name: "Jordan Blake", role: "Product Designer" }]);
  });

  it("rejects a blank name with 400 and never touches the repository", async () => {
    const repository = createFakeRepository([]);
    const url = await mount(repository);

    const response = await fetch(`${url}/api/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "   ", role: "Project Manager" }),
    });
    const body: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Name is required." });
    expect(repository.created).toHaveLength(0);
  });

  it("rejects a blank role with 400", async () => {
    const repository = createFakeRepository([]);
    const url = await mount(repository);

    const response = await fetch(`${url}/api/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Mei Lin", role: "" }),
    });
    const body: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Role is required." });
    expect(repository.created).toHaveLength(0);
  });

  it("rejects a non-string name with 400", async () => {
    const repository = createFakeRepository([]);
    const url = await mount(repository);

    const response = await fetch(`${url}/api/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: 42, role: "Backend Engineer" }),
    });

    expect(response.status).toBe(400);
    expect(repository.created).toHaveLength(0);
  });

  it("removes a member and drops them from the roster", async () => {
    const repository = createFakeRepository([PRIYA, ALEX]);
    const url = await mount(repository);

    const response = await fetch(`${url}/api/members/${ALEX.id}`, { method: "DELETE" });
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ id: ALEX.id });
    expect(repository.removed).toEqual([ALEX.id]);

    const after = await fetch(`${url}/api/members`);
    const roster: unknown = await after.json();
    expect(roster).toEqual([
      { id: PRIYA.id, name: PRIYA.name, role: PRIYA.role, openTaskCount: 0 },
    ]);
  });

  it("answers 404 when removing a member that does not exist", async () => {
    const repository = createFakeRepository([PRIYA]);
    const url = await mount(repository);

    const response = await fetch(`${url}/api/members/m-nope`, { method: "DELETE" });
    const body: unknown = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Member not found." });
    expect(repository.removed).toHaveLength(0);
  });

  it("answers 500 with the failure message when the repository throws", async () => {
    const url = await mount(createFailingRepository("roster unavailable"));

    const response = await fetch(`${url}/api/members`);
    const body: unknown = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "roster unavailable" });
  });
});
