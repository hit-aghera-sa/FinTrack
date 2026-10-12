// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  MissingChecklistTitleError,
  UnknownChecklistItemError,
  createChecklistRepository,
  createMemoryChecklistDataSource,
  toChecklistItem,
  type ChecklistDataSource,
  type ChecklistItemRow,
  type ChecklistRepository,
} from "./checklistRepository.js";
import type { ChecklistItem } from "../../models/checklist/index.js";

/** A repository over a fresh in-memory store, with the data source to hand. */
function harness(): { repository: ChecklistRepository; source: ChecklistDataSource } {
  const source = createMemoryChecklistDataSource();
  return { repository: createChecklistRepository(source), source };
}

function titles(items: readonly ChecklistItem[]): string[] {
  return items.map((row: ChecklistItem): string => row.title);
}

describe("toChecklistItem", () => {
  it("maps a stored row onto the shared model", () => {
    const row: ChecklistItemRow = {
      id: "checklist-one",
      taskId: "task-one",
      title: "Draft the Alex QA brief",
      done: true,
      position: 2,
      createdAt: new Date("2026-03-01T09:00:00.000Z"),
    };

    expect(toChecklistItem(row)).toEqual({
      id: "checklist-one",
      taskId: "task-one",
      title: "Draft the Alex QA brief",
      done: true,
      position: 2,
      createdAt: "2026-03-01T09:00:00.000Z",
    });
  });
});

describe("the checklist repository", () => {
  it("starts a task with an empty checklist", async () => {
    const { repository } = harness();
    expect(await repository.listByTask("task-one")).toEqual([]);
  });

  it("creates an item not done, at the end of the list", async () => {
    const { repository } = harness();

    const first = await repository.create({ taskId: "task-one", title: "Draft the copy" });
    const second = await repository.create({ taskId: "task-one", title: "Review with Priya" });

    expect(first.taskId).toBe("task-one");
    expect(first.title).toBe("Draft the copy");
    expect(first.done).toBe(false);
    expect(first.position).toBe(1);
    expect(first.id).not.toBe("");
    expect(Number.isNaN(Date.parse(first.createdAt))).toBe(false);

    expect(second.position).toBe(2);
    expect(titles(await repository.listByTask("task-one"))).toEqual([
      "Draft the copy",
      "Review with Priya",
    ]);
  });

  it("lists a task's items in position order and nobody else's", async () => {
    const { repository } = harness();

    await repository.create({ taskId: "task-one", title: "Step one" });
    await repository.create({ taskId: "task-two", title: "Another task's step" });
    await repository.create({ taskId: "task-one", title: "Step two" });

    const mine = await repository.listByTask("task-one");
    expect(titles(mine)).toEqual(["Step one", "Step two"]);
    expect(mine.map((row: ChecklistItem): number => row.position)).toEqual([1, 2]);
    expect(titles(await repository.listByTask("task-two"))).toEqual(["Another task's step"]);
  });

  it("numbers each task's positions independently", async () => {
    const { repository } = harness();

    const one = await repository.create({ taskId: "task-one", title: "First of one" });
    const two = await repository.create({ taskId: "task-two", title: "First of two" });

    expect(one.position).toBe(1);
    expect(two.position).toBe(1);
  });

  it("normalises the stored title", async () => {
    const { repository } = harness();

    const created = await repository.create({
      taskId: "task-one",
      title: "  Check   the   Alex QA copy ",
    });

    expect(created.title).toBe("Check the Alex QA copy");
  });

  it("refuses an item with no title and stores nothing", async () => {
    const { repository } = harness();

    await expect(
      repository.create({ taskId: "task-one", title: "   " }),
    ).rejects.toBeInstanceOf(MissingChecklistTitleError);
    await expect(repository.create({ taskId: "task-one", title: "" })).rejects.toThrow(
      "A checklist item title is required.",
    );

    expect(await repository.listByTask("task-one")).toEqual([]);
  });

  it("ticks and unticks one item, leaving its position and the others alone", async () => {
    const { repository } = harness();
    const first = await repository.create({ taskId: "task-one", title: "Step one" });
    await repository.create({ taskId: "task-one", title: "Step two" });

    const ticked = await repository.setDone("task-one", first.id, true);
    expect(ticked).not.toBeNull();
    expect(ticked?.done).toBe(true);
    expect(ticked?.id).toBe(first.id);
    expect(ticked?.position).toBe(first.position);
    expect(ticked?.title).toBe("Step one");

    const listed = await repository.listByTask("task-one");
    expect(listed.map((row: ChecklistItem): boolean => row.done)).toEqual([true, false]);

    const unticked = await repository.setDone("task-one", first.id, false);
    expect(unticked?.done).toBe(false);
  });

  it("keeps a fully ticked checklist on the same task, changing nothing else", async () => {
    const { repository } = harness();
    const first = await repository.create({ taskId: "task-one", title: "Step one" });
    const second = await repository.create({ taskId: "task-one", title: "Step two" });

    await repository.setDone("task-one", first.id, true);
    await repository.setDone("task-one", second.id, true);

    // Completion is a property of the checklist alone: the repository offers no
    // way to move the task, and the items still belong to the same task.
    const [progress] = await repository.progress(["task-one"]);
    expect(progress).toEqual({ taskId: "task-one", done: 2, total: 2 });
    for (const row of await repository.listByTask("task-one")) {
      expect(row.taskId).toBe("task-one");
    }
  });

  it("answers null when the task has no such item", async () => {
    const { repository } = harness();
    const mine = await repository.create({ taskId: "task-one", title: "Step one" });

    expect(await repository.setDone("task-one", "checklist-nope", true)).toBeNull();
    // …and an item of ANOTHER task can never be ticked through this task.
    expect(await repository.setDone("task-two", mine.id, true)).toBeNull();

    const listed = await repository.listByTask("task-one");
    expect(listed.map((row: ChecklistItem): boolean => row.done)).toEqual([false]);
  });

  it("removes an item straight away, keeping the rest of the list", async () => {
    const { repository } = harness();
    const first = await repository.create({ taskId: "task-one", title: "Step one" });
    await repository.create({ taskId: "task-one", title: "Step two" });

    expect(await repository.remove("task-one", first.id)).toBe(true);

    expect(titles(await repository.listByTask("task-one"))).toEqual(["Step two"]);
  });

  it("answers false when there is nothing to remove", async () => {
    const { repository } = harness();
    const mine = await repository.create({ taskId: "task-one", title: "Step one" });

    expect(await repository.remove("task-one", "checklist-nope")).toBe(false);
    expect(await repository.remove("task-two", mine.id)).toBe(false);

    expect(titles(await repository.listByTask("task-one"))).toEqual(["Step one"]);
  });

  it("counts the progress of a set of task ids, in the order asked for", async () => {
    const { repository } = harness();
    const one = await repository.create({ taskId: "task-one", title: "Step one" });
    await repository.create({ taskId: "task-one", title: "Step two" });
    const other = await repository.create({ taskId: "task-two", title: "Only step" });
    await repository.setDone("task-one", one.id, true);
    await repository.setDone("task-two", other.id, true);

    expect(await repository.progress(["task-two", "task-one"])).toEqual([
      { taskId: "task-two", done: 1, total: 1 },
      { taskId: "task-one", done: 1, total: 2 },
    ]);
  });

  it("reports a task with no items as nothing out of nothing", async () => {
    const { repository } = harness();
    await repository.create({ taskId: "task-one", title: "Step one" });

    expect(await repository.progress(["task-one", "task-empty"])).toEqual([
      { taskId: "task-one", done: 0, total: 1 },
      { taskId: "task-empty", done: 0, total: 0 },
    ]);
  });

  it("counts a repeated or blank id once, and no ids not at all", async () => {
    const { repository } = harness();
    await repository.create({ taskId: "task-one", title: "Step one" });

    expect(await repository.progress(["task-one", "task-one", "  "])).toEqual([
      { taskId: "task-one", done: 0, total: 1 },
    ]);
    expect(await repository.progress([])).toEqual([]);
  });

  it("reports every task that has a checklist when no ids are named", async () => {
    const { repository } = harness();
    const one = await repository.create({ taskId: "task-one", title: "Step one" });
    await repository.create({ taskId: "task-one", title: "Step two" });
    await repository.create({ taskId: "task-two", title: "Only step" });
    await repository.setDone("task-one", one.id, true);

    expect(await repository.progress()).toEqual([
      { taskId: "task-one", done: 1, total: 2 },
      { taskId: "task-two", done: 0, total: 1 },
    ]);
  });

  it("reports nothing at all when no task has a checklist", async () => {
    const { repository } = harness();
    expect(await repository.progress()).toEqual([]);
  });
});

describe("the in-memory data source", () => {
  it("can be seeded, and hands its rows back in position order", async () => {
    const source = createMemoryChecklistDataSource(
      [
        { taskId: "task-one", title: "Second", done: false, position: 2 },
        { taskId: "task-one", title: "First", done: true, position: 1 },
      ],
      { now: (): Date => new Date("2026-03-01T09:00:00.000Z") },
    );

    const repository = createChecklistRepository(source);

    expect(titles(await repository.listByTask("task-one"))).toEqual(["First", "Second"]);
    expect((await repository.create({ taskId: "task-one", title: "Third" })).position).toBe(3);
  });

  it("reads the rows of several tasks at once", async () => {
    const source = createMemoryChecklistDataSource([
      { taskId: "task-one", title: "One", done: false, position: 1 },
      { taskId: "task-two", title: "Two", done: true, position: 1 },
      { taskId: "task-three", title: "Three", done: false, position: 1 },
    ]);

    const rows = await source.listRowsByTasks(["task-one", "task-three"]);

    expect(rows.map((row: ChecklistItemRow): string => row.taskId).sort()).toEqual([
      "task-one",
      "task-three",
    ]);
    expect((await source.listAllRows()).length).toBe(3);
  });

  it("scopes a row lookup to the task it belongs to", async () => {
    const source = createMemoryChecklistDataSource([
      { taskId: "task-one", title: "One", done: false, position: 1 },
    ]);
    const [row] = await source.listRowsByTask("task-one");
    expect(row).toBeDefined();
    if (row === undefined) {
      throw new Error("The seeded row is missing.");
    }

    expect(await source.findRow("task-one", row.id)).not.toBeNull();
    expect(await source.findRow("task-two", row.id)).toBeNull();
  });

  it("refuses to write a row that is not there", async () => {
    const source = createMemoryChecklistDataSource();

    await expect(source.updateRowDone("checklist-nope", true)).rejects.toBeInstanceOf(
      UnknownChecklistItemError,
    );
    await expect(source.deleteRow("checklist-nope")).rejects.toThrow(
      "That checklist item does not exist.",
    );

    try {
      await source.deleteRow("checklist-nope");
      expect.unreachable("deleting an unknown row must be refused");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(UnknownChecklistItemError);
      if (error instanceof UnknownChecklistItemError) {
        expect(error.itemId).toBe("checklist-nope");
      }
    }
  });
});
