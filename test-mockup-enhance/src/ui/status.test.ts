import { describe, expect, it } from "vitest";
import {
  STATUS_TONES,
  STATUS_TONE_LABELS,
  resolveStatusTone,
  statusAccent,
  statusLabel,
  statusToneClassName,
} from "./status.js";
import type { StatusTone } from "./status.js";

describe("resolveStatusTone", () => {
  it("maps the three board statuses however they are spelled", () => {
    expect(resolveStatusTone("To do")).toBe("todo");
    expect(resolveStatusTone("TODO")).toBe("todo");
    expect(resolveStatusTone("to_do")).toBe("todo");
    expect(resolveStatusTone("Doing")).toBe("doing");
    expect(resolveStatusTone("IN_PROGRESS")).toBe("doing");
    expect(resolveStatusTone("Done")).toBe("done");
    expect(resolveStatusTone("completed")).toBe("done");
  });

  it("falls back to the neutral tone for anything else", () => {
    expect(resolveStatusTone("Parked")).toBe("neutral");
    expect(resolveStatusTone("")).toBe("neutral");
  });
});

describe("statusLabel", () => {
  it("normalises known statuses to their canonical label", () => {
    expect(statusLabel("TODO")).toBe("To do");
    expect(statusLabel("in progress")).toBe("Doing");
    expect(statusLabel("DONE")).toBe("Done");
  });

  it("prints an unknown status as supplied", () => {
    expect(statusLabel("Parked")).toBe("Parked");
  });
});

describe("statusAccent", () => {
  it("pairs every tone with a label and a shape, not colour alone", () => {
    for (const tone of STATUS_TONES) {
      const accent = statusAccent(STATUS_TONE_LABELS[tone]);
      expect(accent.label.length).toBeGreaterThan(0);
      expect(accent.symbol.length).toBeGreaterThan(0);
      expect(accent.className.startsWith("ui-status--")).toBe(true);
    }
  });

  it("returns the tone class for the resolved tone", () => {
    const accent = statusAccent("Doing");
    expect(accent.tone).toBe<StatusTone>("doing");
    expect(accent.className).toBe(statusToneClassName("doing"));
    expect(accent.label).toBe("Doing");
  });

  it("gives distinct shapes to the three board tones", () => {
    const symbols = [statusAccent("To do").symbol, statusAccent("Doing").symbol, statusAccent("Done").symbol];
    expect(new Set(symbols).size).toBe(3);
  });
});
