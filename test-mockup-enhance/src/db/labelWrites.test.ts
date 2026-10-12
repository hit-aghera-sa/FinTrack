import { describe, expect, it } from "vitest";

import { labelConnectWrite, labelIdRefs, labelReplaceWrite } from "./labelWrites.js";

describe("labelIdRefs", () => {
  it("turns ids into references, trimming and keeping each one once", () => {
    expect(labelIdRefs([" label-bug ", "label-design", "label-bug", "   "])).toEqual([
      { id: "label-bug" },
      { id: "label-design" },
    ]);
  });

  it("is empty when no ids were supplied", () => {
    expect(labelIdRefs([])).toEqual([]);
  });
});

describe("labelConnectWrite", () => {
  it("connects the labels a new task starts with", () => {
    expect(labelConnectWrite(["label-bug", "label-urgent"])).toEqual({
      connect: [{ id: "label-bug" }, { id: "label-urgent" }],
    });
  });

  it("writes nothing when the create carries no labels", () => {
    expect(labelConnectWrite(undefined)).toBeUndefined();
    expect(labelConnectWrite([])).toBeUndefined();
  });
});

describe("labelReplaceWrite", () => {
  it("replaces the task's whole label set on update", () => {
    expect(labelReplaceWrite(["label-design", "label-improvement"])).toEqual({
      set: [{ id: "label-design" }, { id: "label-improvement" }],
    });
  });

  it("clears every label when the new set is empty", () => {
    expect(labelReplaceWrite([])).toEqual({ set: [] });
  });

  it("keeps each label once, whatever the caller sent", () => {
    expect(labelReplaceWrite(["label-bug", "label-bug", " label-design "])).toEqual({
      set: [{ id: "label-bug" }, { id: "label-design" }],
    });
  });
});
