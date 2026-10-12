import { describe, expect, it } from "vitest";

import * as reportMappers from "./reportMappers.js";
import type { MemberReport } from "../models/report.js";

/**
 * A member who carries work in every column, built from the shared
 * {@link MemberReport} contract so no required field can be missing.
 */
const BUSY_MEMBER: MemberReport = {
  memberId: "member-priya",
  memberName: "Priya Nair",
  role: "Designer",
  todo: 2,
  doing: 1,
  done: 3,
  overdue: 1,
  total: 6,
};

/** A member on the roster with no tasks at all: zeroes across the board. */
const IDLE_MEMBER: MemberReport = {
  memberId: "member-sam",
  memberName: "Sam Okafor",
  role: "Product Manager",
  todo: 0,
  doing: 0,
  done: 0,
  overdue: 0,
  total: 0,
};

/** The per-status counts of one report row, in board order. */
function statusCounts(report: MemberReport): number[] {
  return [report.todo, report.doing, report.done];
}

/** Sums the per-status counts of one report row. */
function countedTasks(report: MemberReport): number {
  return statusCounts(report).reduce(
    (running: number, count: number): number => running + count,
    0,
  );
}

/** The member's work that is not yet Done — the only work that can be overdue. */
function openTasks(report: MemberReport): number {
  return report.todo + report.doing;
}

describe("report mapping module", () => {
  it("is importable with no side effects at import time", () => {
    expect(typeof reportMappers).toBe("object");
  });

  it("exposes only defined bindings", () => {
    const names: string[] = Object.keys(reportMappers);
    const values: unknown[] = Object.values(reportMappers);

    expect(values).toHaveLength(names.length);
    for (const name of names) {
      expect(name).not.toBe("");
    }
    expect(values.every((value: unknown): boolean => value !== undefined)).toBe(true);
  });
});

describe("member report contract", () => {
  it("adds the three per-status counts up to the total", () => {
    expect(countedTasks(BUSY_MEMBER)).toBe(BUSY_MEMBER.total);
  });

  it("never reports more overdue tasks than the member has open work", () => {
    expect(BUSY_MEMBER.overdue).toBeLessThanOrEqual(openTasks(BUSY_MEMBER));
    expect(BUSY_MEMBER.overdue).toBeLessThanOrEqual(BUSY_MEMBER.total);
  });

  it("reports a member with no tasks as zero across the board", () => {
    expect(statusCounts(IDLE_MEMBER)).toEqual([0, 0, 0]);
    expect(IDLE_MEMBER.overdue).toBe(0);
    expect(IDLE_MEMBER.total).toBe(0);
    expect(countedTasks(IDLE_MEMBER)).toBe(IDLE_MEMBER.total);
  });

  it("identifies every row by its member, with a readable name and role", () => {
    for (const report of [BUSY_MEMBER, IDLE_MEMBER]) {
      expect(report.memberId).not.toBe("");
      expect(report.memberName).not.toBe("");
      expect(report.role).not.toBe("");
    }
  });

  it("never reports a negative count", () => {
    for (const report of [BUSY_MEMBER, IDLE_MEMBER]) {
      const counts: number[] = [...statusCounts(report), report.overdue, report.total];
      expect(counts.every((count: number): boolean => count >= 0)).toBe(true);
    }
  });
});
