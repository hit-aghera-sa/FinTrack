/**
 * The label repository.
 *
 * Lists every label ordered by name, and creates a label while REFUSING a name
 * that is already taken. Nothing happens at import time: the Prisma client is
 * only reached when a repository is built without an explicit data source.
 *
 * The shared `Label` model lives in src/models/label.ts and is imported as a
 * TYPE only, so this module depends on no runtime export of that file. The
 * HTTP-facing label store interface belongs to src/api/labels and is never
 * re-declared here.
 */
import { prisma } from "./client.js";
import { toLabel, toLabels } from "./labelMappers.js";
/** The colour token a label falls back to — the same default the schema sets. */
export const FALLBACK_LABEL_COLOR = "neutral";
/** Raised when a label with that name already exists. */
export class DuplicateLabelNameError extends Error {
    /** The name that is already taken. */
    labelName;
    constructor(labelName) {
        super(`A label named "${labelName}" already exists.`);
        this.name = "DuplicateLabelNameError";
        this.labelName = labelName;
    }
}
/** Raised when a label is created with no name. */
export class MissingLabelNameError extends Error {
    constructor() {
        super("A label name is required.");
        this.name = "MissingLabelNameError";
    }
}
/** Orders two label names the way the label list shows them. */
export function compareLabelNames(left, right) {
    return left.localeCompare(right, "en");
}
/** The Prisma-backed data source. Built on call, never at import time. */
export function prismaLabelDataSource(client = prisma) {
    return {
        async listRows() {
            return client.label.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] });
        },
        async findRowByName(name) {
            return client.label.findUnique({ where: { name } });
        },
        async insertRow(name, color) {
            return client.label.create({ data: { name, color } });
        },
    };
}
/**
 * Builds the label repository. With no argument it reads and writes the real
 * database through Prisma; the unit tests pass an in-memory data source.
 */
export function createLabelRepository(source) {
    const data = source ?? prismaLabelDataSource();
    return {
        async list() {
            const rows = await data.listRows();
            const ordered = [...rows].sort((left, right) => compareLabelNames(left.name, right.name));
            return toLabels(ordered);
        },
        async create(input) {
            const name = input.name.trim();
            if (name === "") {
                throw new MissingLabelNameError();
            }
            const existing = await data.findRowByName(name);
            if (existing !== null) {
                throw new DuplicateLabelNameError(name);
            }
            const color = input.color.trim();
            const row = await data.insertRow(name, color === "" ? FALLBACK_LABEL_COLOR : color);
            return toLabel(row);
        },
    };
}
