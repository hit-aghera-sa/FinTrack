import { describe, expect, it } from "vitest";

import { createMemoryTaskActivityRepository } from "./activityMemory.js";
import type { TaskActivity, TaskActivityRepository } from "../models/activity.js";

function kinds(feed: readonly TaskActivity[]): string[] {
  return feed.map((entry: TaskActivity): string => entry.kind);
}

describe("createMemoryTaskActivityRepository", () => {
  it("records one entry and gives it back as stored", async () => {
    const store: TaskActivityRepository = createMemoryTaskActivityRepository();

    const entry = await store.record({
      taskId: "task-one",
      kind: "created",
      actor: "Alex QA",
      message: "Task created.",
    });

    expect(entry.id).not.toBe("");
    expect(entry.taskId).toBe("task-one");
    expect(entry.kind).toBe("created");
    expect(entry.actor).toBe("Alex QA");
    expect(entry.message).toBe("Task created.");
    expect(entry.field).toBeNull();
    expect(Number.isNaN(Date.parse(entry.createdAt))).toBe(false);
  });

  it("records several entries in the order given", async () => {
    const store = createMemoryTaskActivityRepository();

    const written = await store.recordMany([
      { taskId: "task-one", kind: "created", message: "Task created." },
      {
        taskId: "task-one",
        kind: "status_changed",
        field: "status",
        fromValue: "todo",
        toValue: "doing",
      },
    ]);

    expect(kinds(written)).toEqual(["created", "status_changed"]);
    expect(written[1]?.fromValue).toBe("todo");
    expect(written[1]?.toValue).toBe("doing");
  });

  it("lists one task's feed newest first", async () => {
    const store = createMemoryTaskActivityRepository();
    await store.recordMany([
      { taskId: "task-one", kind: "created" },
      { taskId: "task-one", kind: "status_changed", field: "status" },
      { taskId: "task-one", kind: "commented", message: "Ready for review." },
    ]);

    const feed = await store.listByTask("task-one");

    expect(kinds(feed)).toEqual(["commented", "status_changed", "created"]);
  });

  it("keeps each task's feed to itself", async () => {
    const store = createMemoryTaskActivityRepository();
    await store.record({ taskId: "task-one", kind: "created" });
    await store.record({ taskId: "task-two", kind: "commented" });

    expect(kinds(await store.listByTask("task-one"))).toEqual(["created"]);
    expect(kinds(await store.listByTask("task-two"))).toEqual(["commented"]);
    expect(await store.listByTask("task-missing")).toEqual([]);
  });

  it("returns only the newest entries when a limit is given", async () => {
    const store = createMemoryTaskActivityRepository();
    await store.recordMany([
      { taskId: "task-one", kind: "created" },
      { taskId: "task-one", kind: "priority_changed", field: "priority" },
      { taskId: "task-one", kind: "commented", message: "Looks good." },
    ]);

    expect(kinds(await store.listByTask("task-one", 2))).toEqual([
      "commented",
      "priority_changed",
    ]);
    expect(await store.listByTask("task-one", 0)).toEqual([]);
    expect(await store.listByTask("task-one", -1)).toEqual([]);
    expect(kinds(await store.listByTask("task-one", 99))).toHaveLength(3);
  });
});
