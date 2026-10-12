/**
 * The label store the label endpoints read and write through.
 *
 * `LabelRepository` is the INTERFACE the HTTP layer is written against, so the
 * storage behind it can change without touching a route: the data lane's
 * Prisma-backed implementation of this same interface drops straight into the
 * composition root.
 *
 * `createMemoryLabelRepository` is the implementation this build ships with. It
 * keeps labels and each task's label set in memory, seeded with a handful of
 * labels, and enforces the two rules the endpoints rely on: a label name is
 * unique (compared without regard to case), and replacing a task's label set
 * replaces it wholesale.
 */

import {
  compareLabels,
  normaliseLabelName,
  sameLabelName,
  type Label,
  type LabelColor,
  type NewLabel,
} from "../../models/label.js";

/** Raised when a label with that name already exists. The router answers 409. */
export class DuplicateLabelNameError extends Error {
  /** The name that was already taken. */
  readonly labelName: string;

  constructor(labelName: string) {
    super(`A label called "${labelName}" already exists.`);
    this.name = "DuplicateLabelNameError";
    this.labelName = labelName;
  }
}

/** Raised when a write names a label that does not exist. The router answers 400. */
export class UnknownLabelError extends Error {
  /** The ids that matched no label. */
  readonly labelIds: readonly string[];

  constructor(labelIds: readonly string[]) {
    super(
      labelIds.length === 1
        ? "One of those labels does not exist."
        : "Some of those labels do not exist.",
    );
    this.name = "UnknownLabelError";
    this.labelIds = [...labelIds];
  }
}

/** Everything the label endpoints ask of their store. */
export interface LabelRepository {
  /** Every label, ordered by name. */
  list(): Promise<Label[]>;
  /**
   * Creates a label from a already-validated input.
   *
   * Rejects with {@link DuplicateLabelNameError} when the name is taken.
   */
  create(input: NewLabel): Promise<Label>;
  /** The labels attached to one task, ordered by name. */
  listForTask(taskId: string): Promise<Label[]>;
  /**
   * Replaces a task's whole label set and returns the resulting labels,
   * ordered by name.
   *
   * Rejects with {@link UnknownLabelError} when an id matches no label.
   */
  replaceTaskLabels(taskId: string, labelIds: readonly string[]): Promise<Label[]>;
}

/** The labels a fresh store starts with. */
export const SEED_LABELS: readonly NewLabel[] = [
  { name: "Bug", color: "danger" },
  { name: "Design", color: "info" },
  { name: "Documentation", color: "neutral" },
  { name: "Feature", color: "primary" },
  { name: "Urgent", color: "warning" },
];

/**
 * Builds an in-memory label store. The composition root creates one for the
 * lifetime of the process, so every request sees the same labels.
 */
export function createMemoryLabelRepository(
  seed: readonly NewLabel[] = SEED_LABELS,
): LabelRepository {
  const labels: Label[] = [];
  const assigned = new Map<string, string[]>();
  let sequence = 0;

  function insert(name: string, color: LabelColor): Label {
    const stored = normaliseLabelName(name);
    if (labels.some((row: Label): boolean => sameLabelName(row.name, stored))) {
      throw new DuplicateLabelNameError(stored);
    }
    sequence += 1;
    const label: Label = { id: `label-${String(sequence)}`, name: stored, color };
    labels.push(label);
    return label;
  }

  function resolve(ids: readonly string[]): Label[] {
    const found: Label[] = [];
    for (const id of ids) {
      const row = labels.find((candidate: Label): boolean => candidate.id === id);
      if (row !== undefined) {
        found.push(row);
      }
    }
    return found.sort(compareLabels);
  }

  for (const entry of seed) {
    insert(entry.name, entry.color);
  }

  return {
    async list(): Promise<Label[]> {
      return [...labels].sort(compareLabels);
    },

    async create(input: NewLabel): Promise<Label> {
      return insert(input.name, input.color);
    },

    async listForTask(taskId: string): Promise<Label[]> {
      return resolve(assigned.get(taskId) ?? []);
    },

    async replaceTaskLabels(taskId: string, labelIds: readonly string[]): Promise<Label[]> {
      const unknown = labelIds.filter(
        (id: string): boolean => !labels.some((row: Label): boolean => row.id === id),
      );
      if (unknown.length > 0) {
        throw new UnknownLabelError(unknown);
      }
      const unique: string[] = [];
      for (const id of labelIds) {
        if (!unique.includes(id)) {
          unique.push(id);
        }
      }
      assigned.set(taskId, unique);
      return resolve(unique);
    },
  };
}
