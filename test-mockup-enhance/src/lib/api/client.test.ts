import { describe, expect, it } from "vitest";

import { ApiError, createBoardApi, type FetchLike } from "./client.js";
import { DEFAULT_TASK_PRIORITY, type Task } from "../../models/task.js";
import type { TaskComment } from "../../models/comment.js";
import type {
  TeamMember,
  TeamMemberWithWorkload,
} from "../../models/member.js";

interface RecordedCall {
  url: string;
  method: string | undefined;
  body: string | null;
}

interface Recorder {
  calls: RecordedCall[];
  fetch: FetchLike;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

function recorder(responses: readonly Response[]): Recorder {
  const calls: RecordedCall[] = [];
  const queue: Response[] = [...responses];
  const fetchImpl: FetchLike = (input: string, init?: RequestInit): Promise<Response> => {
    const rawBody = init?.body;
    calls.push({
      url: input,
      method: init?.method,
      body: typeof rawBody === "string" ? rawBody : null,
    });
    const next = queue.shift();
    if (next === undefined) {
      return Promise.reject(new Error("no queued response"));
    }
    return Promise.resolve(next);
  };
  return { calls, fetch: fetchImpl };
}

const TASK: Task = {
  id: "task-alpha",
  title: "Draft the release notes",
  description: "Summarise what shipped this week.",
  assigneeId: "member-priya",
  dueDate: "2026-02-18",
  status: "todo",
  priority: "Medium",
  createdAt: "2026-02-01T09:00:00.000Z",
};

const COMMENT: TaskComment = {
  id: "comment-one",
  taskId: TASK.id,
  body: "Checked with the design team.",
  createdAt: "2026-02-02T10:30:00.000Z",
};

const MEMBER: TeamMember = {
  id: "member-priya",
  name: "Priya Natarajan",
  role: "Engineering Lead",
};

const MEMBER_WITH_WORKLOAD: TeamMemberWithWorkload = {
  ...MEMBER,
  openTaskCount: 3,
};

describe("board api client — reads", () => {
  it("lists tasks from GET /api/tasks", async () => {
    const { calls, fetch } = recorder([jsonResponse(200, [TASK])]);
    const api = createBoardApi({ fetch });

    const tasks = await api.listTasks();

    expect(tasks).toEqual([TASK]);
    const call = calls[0];
    expect(call?.url).toBe("/api/tasks");
    expect(call?.method).toBe("GET");
  });

  it("fetches one task and encodes the id into the path", async () => {
    const { calls, fetch } = recorder([jsonResponse(200, TASK)]);
    const api = createBoardApi({ fetch });

    const task = await api.getTask("task alpha/1");

    expect(task.title).toBe(TASK.title);
    expect(calls[0]?.url).toBe("/api/tasks/task%20alpha%2F1");
  });

  it("carries the stored priority through to the screen", async () => {
    const { fetch } = recorder([jsonResponse(200, { ...TASK, priority: "High" })]);
    const api = createBoardApi({ fetch });

    const task = await api.getTask(TASK.id);

    expect(task.priority).toBe("High");
  });

  it("defaults a missing or unknown priority to the shared default", async () => {
    const { fetch } = recorder([
      jsonResponse(200, [{ ...TASK, priority: undefined }, { ...TASK, priority: "Urgent" }]),
    ]);
    const api = createBoardApi({ fetch });

    const tasks = await api.listTasks();

    expect(tasks[0]?.priority).toBe(DEFAULT_TASK_PRIORITY);
    expect(tasks[1]?.priority).toBe(DEFAULT_TASK_PRIORITY);
  });

  it("lists a task's comment thread", async () => {
    const { calls, fetch } = recorder([jsonResponse(200, [COMMENT])]);
    const api = createBoardApi({ fetch });

    const comments = await api.listComments(TASK.id);

    expect(comments).toEqual([COMMENT]);
    expect(calls[0]?.url).toBe(`/api/tasks/${TASK.id}/comments`);
  });

  it("lists members with their open-task counts", async () => {
    const { calls, fetch } = recorder([jsonResponse(200, [MEMBER_WITH_WORKLOAD])]);
    const api = createBoardApi({ fetch });

    const roster = await api.listMembers();

    expect(roster).toEqual([MEMBER_WITH_WORKLOAD]);
    expect(calls[0]?.url).toBe("/api/members");
    expect(calls[0]?.method).toBe("GET");
  });

  it("defaults a missing open-task count to zero", async () => {
    const { fetch } = recorder([jsonResponse(200, [MEMBER])]);
    const api = createBoardApi({ fetch });

    const roster = await api.listMembers();

    expect(roster[0]?.openTaskCount).toBe(0);
  });
});

describe("board api client — writes", () => {
  it("creates a task with a JSON POST body", async () => {
    const { calls, fetch } = recorder([jsonResponse(201, TASK)]);
    const api = createBoardApi({ fetch });

    const created = await api.createTask({ title: TASK.title, status: "todo" });

    expect(created.id).toBe(TASK.id);
    const call = calls[0];
    expect(call?.url).toBe("/api/tasks");
    expect(call?.method).toBe("POST");
    expect(call?.body).toBe(JSON.stringify({ title: TASK.title, status: "todo" }));
  });

  it("sends a chosen priority with the create", async () => {
    const { calls, fetch } = recorder([jsonResponse(201, { ...TASK, priority: "High" })]);
    const api = createBoardApi({ fetch });

    const created = await api.createTask({ title: TASK.title, priority: "High" });

    expect(created.priority).toBe("High");
    expect(calls[0]?.body).toBe(JSON.stringify({ title: TASK.title, priority: "High" }));
  });

  it("moves a task with a PATCH of just the status", async () => {
    const { calls, fetch } = recorder([jsonResponse(200, { ...TASK, status: "doing" })]);
    const api = createBoardApi({ fetch });

    const moved = await api.updateTask(TASK.id, { status: "doing" });

    expect(moved.status).toBe("doing");
    const call = calls[0];
    expect(call?.url).toBe(`/api/tasks/${TASK.id}`);
    expect(call?.method).toBe("PATCH");
    expect(call?.body).toBe(JSON.stringify({ status: "doing" }));
  });

  it("adds a comment as { body }", async () => {
    const { calls, fetch } = recorder([jsonResponse(201, COMMENT)]);
    const api = createBoardApi({ fetch });

    const added = await api.addComment(TASK.id, COMMENT.body);

    expect(added).toEqual(COMMENT);
    const call = calls[0];
    expect(call?.url).toBe(`/api/tasks/${TASK.id}/comments`);
    expect(call?.method).toBe("POST");
    expect(call?.body).toBe(JSON.stringify({ body: COMMENT.body }));
  });

  it("adds a member", async () => {
    const { calls, fetch } = recorder([jsonResponse(201, MEMBER)]);
    const api = createBoardApi({ fetch });

    const created = await api.addMember({ name: MEMBER.name, role: MEMBER.role });

    expect(created).toEqual(MEMBER);
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe("/api/members");
  });

  it("removes a member and tolerates an empty 204 body", async () => {
    const { calls, fetch } = recorder([emptyResponse(204)]);
    const api = createBoardApi({ fetch });

    await api.removeMember(MEMBER.id);

    const call = calls[0];
    expect(call?.url).toBe(`/api/members/${MEMBER.id}`);
    expect(call?.method).toBe("DELETE");
  });
});

describe("ApiError", () => {
  it("carries the status and a { message } problem body", async () => {
    const { fetch } = recorder([
      jsonResponse(400, { message: "A task title is required." }),
    ]);
    const api = createBoardApi({ fetch });

    await expect(api.createTask({ title: "" })).rejects.toBeInstanceOf(ApiError);

    const { fetch: again } = recorder([
      jsonResponse(400, { message: "A task title is required." }),
    ]);
    try {
      await createBoardApi({ fetch: again }).createTask({ title: "" });
      expect.unreachable("the request should have failed");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApiError);
      if (error instanceof ApiError) {
        expect(error.status).toBe(400);
        expect(error.message).toBe("A task title is required.");
      }
    }
  });

  it("reads the team router's { error } problem body", async () => {
    const { fetch } = recorder([jsonResponse(400, { error: "Name is required." })]);
    const api = createBoardApi({ fetch });

    try {
      await api.addMember({ name: "", role: "QA Engineer" });
      expect.unreachable("the request should have failed");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApiError);
      if (error instanceof ApiError) {
        expect(error.status).toBe(400);
        expect(error.message).toBe("Name is required.");
      }
    }
  });

  it("reports a 404 for a task that does not exist", async () => {
    const { fetch } = recorder([
      jsonResponse(404, { error: "task_not_found", message: "That task could not be found." }),
    ]);
    const api = createBoardApi({ fetch });

    try {
      await api.getTask("task-missing");
      expect.unreachable("the request should have failed");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApiError);
      if (error instanceof ApiError) {
        expect(error.status).toBe(404);
        expect(error.message).toBe("That task could not be found.");
      }
    }
  });

  it("wraps a transport failure as status 0", async () => {
    const failing: FetchLike = (): Promise<Response> =>
      Promise.reject(new Error("network down"));
    const api = createBoardApi({ fetch: failing });

    try {
      await api.listTasks();
      expect.unreachable("the request should have failed");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApiError);
      if (error instanceof ApiError) {
        expect(error.status).toBe(0);
        expect(error.message).toContain("network down");
      }
    }
  });

  it("rejects a payload that is not the expected shape", async () => {
    const { fetch } = recorder([jsonResponse(200, { unexpected: true })]);
    const api = createBoardApi({ fetch });

    await expect(api.listTasks()).rejects.toBeInstanceOf(ApiError);
  });

  it("honours a custom base url", async () => {
    const { calls, fetch } = recorder([jsonResponse(200, [])]);
    const api = createBoardApi({ fetch, baseUrl: "http://localhost:3000/api" });

    await api.listTasks();

    expect(calls[0]?.url).toBe("http://localhost:3000/api/tasks");
  });
});
