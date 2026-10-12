// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ReportsView } from "./ReportsPage.js";
import type { WorkloadReport } from "../../api/reports/types.js";

/** The report a stubbed client answers with: totals 6, 3 and 0. */
const REPORT: WorkloadReport = {
  generatedAt: "2026-03-10T09:00:00.000Z",
  members: [
    {
      memberId: "m-priya",
      memberName: "Priya Lunch",
      role: "Engineering Lead",
      todo: 2,
      doing: 1,
      done: 3,
      overdue: 1,
      total: 6,
    },
    {
      memberId: "m-alex",
      memberName: "Alex QA",
      role: "QA Engineer",
      todo: 1,
      doing: 0,
      done: 2,
      overdue: 0,
      total: 3,
    },
    {
      memberId: "m-mei",
      memberName: "Mei Harbour",
      role: "Product Designer",
      todo: 0,
      doing: 0,
      done: 0,
      overdue: 0,
      total: 0,
    },
  ],
};

afterEach(() => {
  cleanup();
});

/** A stubbed reports client that answers with the given report. */
function stubReader(report: WorkloadReport): () => Promise<WorkloadReport> {
  return vi.fn((): Promise<WorkloadReport> => Promise.resolve(report));
}

function widthOf(testId: string): string {
  return screen.getByTestId(testId).style.width;
}

describe("ReportsView", () => {
  it("shows a loading state until the reports client answers", () => {
    const pending = vi.fn(
      (): Promise<WorkloadReport> => new Promise<WorkloadReport>(() => undefined),
    );

    render(<ReportsView readReport={pending} />);

    expect(screen.getByText(/Loading the workload report/)).toBeTruthy();
    expect(pending).toHaveBeenCalledTimes(1);
  });

  it("renders one row per member with the server's counts and total", async () => {
    render(<ReportsView readReport={stubReader(REPORT)} />);

    expect(await screen.findByText("Priya Lunch")).toBeTruthy();
    expect(screen.getByText("Engineering Lead")).toBeTruthy();
    expect(screen.getByText("Alex QA")).toBeTruthy();
    expect(screen.getByText("Mei Harbour")).toBeTruthy();
    expect(screen.getByText("Product Designer")).toBeTruthy();

    expect(screen.getByTestId("reports-todo-m-priya").textContent).toBe("2");
    expect(screen.getByTestId("reports-doing-m-priya").textContent).toBe("1");
    expect(screen.getByTestId("reports-done-m-priya").textContent).toBe("3");
    expect(screen.getByTestId("reports-total-m-priya").textContent).toBe("6");

    expect(screen.getByTestId("reports-todo-m-alex").textContent).toBe("1");
    expect(screen.getByTestId("reports-doing-m-alex").textContent).toBe("0");
    expect(screen.getByTestId("reports-done-m-alex").textContent).toBe("2");
    expect(screen.getByTestId("reports-total-m-alex").textContent).toBe("3");

    // A member with no tasks is still reported, with zeros across the board.
    expect(screen.getByTestId("reports-todo-m-mei").textContent).toBe("0");
    expect(screen.getByTestId("reports-total-m-mei").textContent).toBe("0");
  });

  it("highlights an overdue count greater than zero, and words it as well", async () => {
    render(<ReportsView readReport={stubReader(REPORT)} />);

    const overdue = await screen.findByTestId("reports-overdue-m-priya");
    expect(overdue.className).toContain("is-overdue");
    expect(overdue.getAttribute("data-overdue")).toBe("yes");
    expect(overdue.textContent).toContain("1");
    expect(overdue.textContent).toContain("overdue");

    const clear = screen.getByTestId("reports-overdue-m-alex");
    expect(clear.className).not.toContain("is-overdue");
    expect(clear.getAttribute("data-overdue")).toBe("no");
    expect(clear.textContent).toContain("on time");
  });

  it("draws each bar in proportion to the largest total in the report", async () => {
    render(<ReportsView readReport={stubReader(REPORT)} />);

    await screen.findByTestId("reports-bar-m-priya");

    expect(widthOf("reports-bar-m-priya")).toBe("100%");
    expect(widthOf("reports-bar-m-alex")).toBe("50%");
    expect(widthOf("reports-bar-m-mei")).toBe("0%");
  });

  it("renders an empty-roster state when the report has no members", async () => {
    const empty: WorkloadReport = { generatedAt: REPORT.generatedAt, members: [] };

    render(<ReportsView readReport={stubReader(empty)} />);

    expect(await screen.findByText("No team members yet")).toBeTruthy();
    expect(screen.queryByTestId("reports-bar-m-priya")).toBeNull();
  });

  it("reports a failed read and loads the report again on retry", async () => {
    let calls = 0;
    const readReport = vi.fn((): Promise<WorkloadReport> => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new Error("The workload report could not be produced."))
        : Promise.resolve(REPORT);
    });

    render(<ReportsView readReport={readReport} />);

    expect(await screen.findByText("The workload report could not be produced.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Priya Lunch")).toBeTruthy();
    expect(readReport).toHaveBeenCalledTimes(2);
  });
});
