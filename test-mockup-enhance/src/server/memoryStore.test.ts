import { describe, expect, it } from "vitest";

import { createMemoryRepositories, type Repositories } from "./memoryStore.js";
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  type Task,
  type TaskPriority,
} from "../models/task.js";
import type { TeamMemberWithWorkload } from "../models/member.js";
import type { TaskComment } from "../models/comment.js";

function store(): Repositories {
  return createMemoryRepositories();
}

async function openCount(repositories: Repositories, memberId: string): Promise<number> {
  const roster = await repositories.members.listWithWorkload();
  const found = roster.find(
    (member: TeamMemberWithWorkload): boolean => member.id === memberId,
  );
  return found === undefined ? -1 : found.openTaskCount;
}

describe("in-memory repositories", () => {
  it("seeds a roster and a board with work in all three columns and a mix of priorities", async () => {
    const repositories = store();

    const tasks = await repositories.tasks.list();
    expect(tasks.length).toBeGreaterThanOrEqual(3);
    expect(new Set(tasks.map((task: Task): string => task.status))).toEqual(
      new Set(["todo", "doing", "done"]),
    );

    const priorities = new Set(tasks.map((task: Task): TaskPriority => task.priority));
    expect(priorities.size).toBeGreaterThan(1);

    const roster = await repositories.members.list();
    expect(roster.length).toBeGreaterThan(0);
    expect(roster.every((member) => member.name !== "" && member.role !== "")).toBe(true);
  });

  it("defaults a new task to the first column and the default priority", async () => {
    const repositories = store();

    const created = await repositories.tasks.create({ title: "  Alex QA run-b7  " });

    expect(created.title).toBe("Alex QA run-b7");
    expect(created.status).toBe(DEFAULT_TASK_STATUS);
    expect(created.priority).toBe(DEFAULT_TASK_PRIORITY);
    expect(created.description).toBe("");
    expect(created.assigneeId).toBeNull();
    expect(created.dueDate).toBeNull();
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);
  });

  it("persists a chosen priority and a patched one", async () => {
    const repositories = store();

    const created = await repositories.tasks.create({
      title: "Priya Lunch review run-c2",
      priority: "High",
      status: "doing",
      dueDate: "2026-03-04",
    });
    expect(created.priority).toBe("High");
    expect(created.dueDate).toBe("2026-03-04");

    const patched = await repositories.tasks.update(created.id, {
      priority: "Low",
      status: "done",
    });
    expect(patched.priority).toBe("Low");
    expect(patched.status).toBe("done");

    const reloaded = await repositories.tasks.findById(created.id);
    expect(reloaded?.priority).toBe("Low");
    expect(reloaded?.title).toBe("Priya Lunch review run-c2");
  });

  it("reports a live open-task count that ignores finished work", async () => {
    const repositories = store();

    const member = await repositories.members.create({ name: "Alex QA", role: "QA Engineer" });
    expect(await openCount(repositories, member.id)).toBe(0);

    const task = await repositories.tasks.create({
      title: "Alex QA counted run-d3",
      assigneeId: member.id,
      status: "doing",
    });
    expect(await openCount(repositories, member.id)).toBe(1);

    await repositories.tasks.update(task.id, { status: "done" });
    expect(await openCount(repositories, member.id)).toBe(0);
  });

  it("unassigns a removed member's tasks and keeps them on the board", async () => {
    const repositories = store();

    const member = await repositories.members.create({
      name: "Priya Lunch leaving",
      role: "Product Designer",
    });
    const task = await repositories.tasks.create({
      title: "Alex QA kept run-e4",
      assigneeId: member.id,
      status: "doing",
    });
    expect(task.assigneeId).toBe(member.id);

    await repositories.members.remove(member.id);

    expect(await repositories.members.findById(member.id)).toBeNull();
    const survivor = await repositories.tasks.findById(task.id);
    expect(survivor?.assigneeId).toBeNull();
    expect(survivor?.status).toBe("doing");
  });

  it("keeps each task's comment thread in creation order", async () => {
    const repositories = store();

    const task = await repositories.tasks.create({ title: "Alex QA thread run-f5" });
    await repositories.comments.create(task.id, { body: "  First: picked this up.  " });
    await repositories.comments.create(task.id, { body: "Second: waiting on copy." });

    const thread = await repositories.comments.listByTask(task.id);
    expect(thread.map((comment: TaskComment): string => comment.body)).toEqual([
      "First: picked this up.",
      "Second: waiting on copy.",
    ]);
    expect(thread.every((comment: TaskComment): boolean => comment.taskId === task.id)).toBe(true);
    expect(await repositories.comments.listByTask("task-missing")).toEqual([]);
  });
});
