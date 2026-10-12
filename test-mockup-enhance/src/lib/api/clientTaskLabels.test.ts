// @vitest-environment node
import { describe, expect, it } from "vitest";

import { createBoardApi, type FetchLike } from "./client.js";
import { DEFAULT_LABEL_COLOR } from "../../models/label.js";

/** A task payload exactly as the task API serialises one, without its labels. */
const BASE_TASK = {
  id: "task-one",
  title: "Alex QA labelled",
  description: "",
  assigneeId: null,
  dueDate: null,
  status: "todo",
  priority: "Medium",
  createdAt: "2026-02-01T09:00:00.000Z",
};

/** A transport that answers one request with this body and a 200. */
function answering(body: unknown): FetchLike {
  return (): Promise<Response> =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
}

describe("task label decoding", () => {
  it("keeps the labels a task payload carries", async () => {
    const api = createBoardApi({
      fetch: answering({
        ...BASE_TASK,
        labels: [{ id: "label-urgent", name: "Lane Urgent", color: "warning" }],
      }),
    });

    const task = await api.getTask("task-one");

    expect(task.labels).toEqual([
      { id: "label-urgent", name: "Lane Urgent", color: "warning" },
    ]);
  });

  it("keeps the labels of every task in a list", async () => {
    const api = createBoardApi({
      fetch: answering([
        { ...BASE_TASK, labels: [{ id: "label-design", name: "Lane Design", color: "info" }] },
        { ...BASE_TASK, id: "task-two", labels: [] },
      ]),
    });

    const tasks = await api.listTasks();

    expect(tasks[0]?.labels).toEqual([
      { id: "label-design", name: "Lane Design", color: "info" },
    ]);
    expect(tasks[1]?.labels).toEqual([]);
  });

  it("leaves the labels absent when the payload carries none", async () => {
    const api = createBoardApi({ fetch: answering(BASE_TASK) });

    const task = await api.getTask("task-one");

    expect(task.labels).toBeUndefined();
  });

  it("defaults a colour it does not know and drops a malformed label", async () => {
    const api = createBoardApi({
      fetch: answering({
        ...BASE_TASK,
        labels: [
          { id: "label-spike", name: "Lane Spike", color: "chartreuse" },
          { name: "no id at all" },
          "not a label",
        ],
      }),
    });

    const task = await api.getTask("task-one");

    expect(task.labels).toEqual([
      { id: "label-spike", name: "Lane Spike", color: DEFAULT_LABEL_COLOR },
    ]);
  });

  it("sends the chosen labels back as labelIds on an edit", async () => {
    const sent: string[] = [];
    const fetchImpl: FetchLike = (_input: string, init?: RequestInit): Promise<Response> => {
      const body = init?.body;
      sent.push(typeof body === "string" ? body : "");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...BASE_TASK,
            labels: [{ id: "label-spike", name: "Lane Spike", color: "primary" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    };

    const updated = await createBoardApi({ fetch: fetchImpl }).updateTask("task-one", {
      labelIds: ["label-spike"],
    });

    expect(sent[0]).toBe(JSON.stringify({ labelIds: ["label-spike"] }));
    expect(updated.labels).toEqual([
      { id: "label-spike", name: "Lane Spike", color: "primary" },
    ]);
  });
});
