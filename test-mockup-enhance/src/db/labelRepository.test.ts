import { describe, expect, it } from "vitest";

import type { LabelRow } from "./labelMappers.js";
import {
  DuplicateLabelNameError,
  FALLBACK_LABEL_COLOR,
  MissingLabelNameError,
  createLabelRepository,
  type LabelDataSource,
} from "./labelRepository.js";

/** An in-memory stand-in for the datastore, implementing the whole interface. */
class FakeLabelSource implements LabelDataSource {
  rows: LabelRow[];
  private counter = 0;

  constructor(initial: readonly LabelRow[] = []) {
    this.rows = initial.map((row: LabelRow): LabelRow => ({ ...row }));
  }

  listRows(): Promise<LabelRow[]> {
    return Promise.resolve(this.rows.map((row: LabelRow): LabelRow => ({ ...row })));
  }

  findRowByName(name: string): Promise<LabelRow | null> {
    const found = this.rows.find((row: LabelRow): boolean => row.name === name);
    return Promise.resolve(found === undefined ? null : { ...found });
  }

  insertRow(name: string, color: string): Promise<LabelRow> {
    this.counter += 1;
    const row: LabelRow = { id: `label-${String(this.counter)}`, name, color };
    this.rows.push(row);
    return Promise.resolve({ ...row });
  }
}

describe("label repository", () => {
  it("lists every label ordered by name", async () => {
    const source = new FakeLabelSource([
      { id: "label-urgent", name: "Urgent", color: "warning" },
      { id: "label-bug", name: "Bug", color: "danger" },
      { id: "label-design", name: "Design", color: "info" },
    ]);

    const labels = await createLabelRepository(source).list();

    expect(labels.map((label) => label.name)).toEqual(["Bug", "Design", "Urgent"]);
    expect(labels[0]).toEqual({ id: "label-bug", name: "Bug", color: "danger" });
  });

  it("creates a label and returns it as the shared model", async () => {
    const source = new FakeLabelSource();
    const repository = createLabelRepository(source);

    const created = await repository.create({ name: "  Improvement  ", color: "success" });

    expect(created.name).toBe("Improvement");
    expect(created.color).toBe("success");
    expect(created.id).not.toBe("");
    expect(source.rows).toHaveLength(1);
    expect(source.rows[0]?.name).toBe("Improvement");
  });

  it("rejects a duplicate name and stores nothing", async () => {
    const source = new FakeLabelSource([
      { id: "label-bug", name: "Bug", color: "danger" },
    ]);
    const repository = createLabelRepository(source);

    await expect(repository.create({ name: "Bug", color: "info" })).rejects.toBeInstanceOf(
      DuplicateLabelNameError,
    );
    await expect(repository.create({ name: "  Bug  ", color: "info" })).rejects.toThrow(
      'A label named "Bug" already exists.',
    );

    expect(source.rows).toHaveLength(1);
  });

  it("rejects a label with no name", async () => {
    const source = new FakeLabelSource();
    const repository = createLabelRepository(source);

    await expect(repository.create({ name: "   ", color: "info" })).rejects.toBeInstanceOf(
      MissingLabelNameError,
    );
    await expect(repository.create({ name: "", color: "info" })).rejects.toThrow(
      "A label name is required.",
    );

    expect(source.rows).toHaveLength(0);
  });

  it("falls back to the default colour token when none was given", async () => {
    const source = new FakeLabelSource();

    const created = await createLabelRepository(source).create({
      name: "Documentation",
      color: "   ",
    });

    expect(created.color).toBe(FALLBACK_LABEL_COLOR);
    expect(source.rows[0]?.color).toBe(FALLBACK_LABEL_COLOR);
  });
});
