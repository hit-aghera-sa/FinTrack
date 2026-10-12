// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  DuplicateLabelNameError,
  UnknownLabelError,
  createMemoryLabelRepository,
  type LabelRepository,
} from "./repository.js";
import type { Label, NewLabel } from "../../models/label.js";

const SEED: readonly NewLabel[] = [
  { name: "Urgent", color: "warning" },
  { name: "Design", color: "info" },
];

function names(labels: readonly Label[]): string[] {
  return labels.map((label: Label): string => label.name);
}

function store(): LabelRepository {
  return createMemoryLabelRepository(SEED);
}

describe("the label store", () => {
  it("lists its seeded labels ordered by name", async () => {
    const labels = await store().list();
    expect(names(labels)).toEqual(["Design", "Urgent"]);
  });

  it("creates a label and keeps the list in name order", async () => {
    const repository = store();
    const created = await repository.create({ name: "Backend", color: "primary" });

    expect(created.name).toBe("Backend");
    expect(created.color).toBe("primary");
    expect(created.id).not.toBe("");
    expect(names(await repository.list())).toEqual(["Backend", "Design", "Urgent"]);
  });

  it("normalises the stored name", async () => {
    const repository = store();
    const created = await repository.create({ name: "  Needs   review ", color: "neutral" });
    expect(created.name).toBe("Needs review");
  });

  it("rejects a duplicate name, whatever its case", async () => {
    const repository = store();

    await expect(repository.create({ name: "Design", color: "info" })).rejects.toBeInstanceOf(
      DuplicateLabelNameError,
    );
    await expect(repository.create({ name: "  design ", color: "danger" })).rejects.toBeInstanceOf(
      DuplicateLabelNameError,
    );

    expect(names(await repository.list())).toEqual(["Design", "Urgent"]);
  });

  it("carries the taken name on the duplicate failure", async () => {
    const repository = store();
    try {
      await repository.create({ name: "urgent", color: "warning" });
      expect.unreachable("a duplicate name must be refused");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DuplicateLabelNameError);
      if (error instanceof DuplicateLabelNameError) {
        expect(error.labelName).toBe("urgent");
        expect(error.message).toContain("already exists");
      }
    }
  });

  it("starts a task with no labels", async () => {
    expect(await store().listForTask("task-one")).toEqual([]);
  });

  it("replaces a task's label set wholesale", async () => {
    const repository = store();
    const all = await repository.list();
    const design = all[0];
    const urgent = all[1];
    expect(design).toBeDefined();
    expect(urgent).toBeDefined();
    if (design === undefined || urgent === undefined) {
      throw new Error("The seeded labels are missing.");
    }

    const first = await repository.replaceTaskLabels("task-one", [urgent.id, design.id]);
    expect(names(first)).toEqual(["Design", "Urgent"]);
    expect(names(await repository.listForTask("task-one"))).toEqual(["Design", "Urgent"]);

    const second = await repository.replaceTaskLabels("task-one", [urgent.id]);
    expect(names(second)).toEqual(["Urgent"]);
    expect(names(await repository.listForTask("task-one"))).toEqual(["Urgent"]);

    const cleared = await repository.replaceTaskLabels("task-one", []);
    expect(cleared).toEqual([]);
    expect(await repository.listForTask("task-one")).toEqual([]);
  });

  it("ignores a repeated id in a replacement", async () => {
    const repository = store();
    const all = await repository.list();
    const design = all[0];
    if (design === undefined) {
      throw new Error("The seeded labels are missing.");
    }

    const result = await repository.replaceTaskLabels("task-two", [design.id, design.id]);
    expect(names(result)).toEqual(["Design"]);
  });

  it("leaves other tasks alone", async () => {
    const repository = store();
    const all = await repository.list();
    const design = all[0];
    if (design === undefined) {
      throw new Error("The seeded labels are missing.");
    }

    await repository.replaceTaskLabels("task-one", [design.id]);
    expect(await repository.listForTask("task-two")).toEqual([]);
  });

  it("refuses a replacement naming a label that does not exist", async () => {
    const repository = store();

    await expect(
      repository.replaceTaskLabels("task-one", ["label-nope"]),
    ).rejects.toBeInstanceOf(UnknownLabelError);
    expect(await repository.listForTask("task-one")).toEqual([]);
  });
});
