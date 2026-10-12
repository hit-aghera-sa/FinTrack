/**
 * The reports screen at `/reports`.
 *
 * It reads `GET /api/reports` once and renders the numbers exactly as the
 * server counted them — the client performs no aggregation of its own. The
 * only derivation here is PRESENTATION: how wide each member's bar is drawn
 * relative to the largest total in the report, and how a figure is worded
 * (both live in `./reportsModel.ts` and are unit tested there).
 *
 * The page list marks every route `heading: false`, so each screen draws its
 * own heading with the shared PageHeader primitive — this one included.
 */

import { useCallback, useEffect, useState } from "react";

import { Button } from "../../components/Button.js";
import { DataTable, type DataTableColumn } from "../../components/DataTable.js";
import { EmptyState } from "../../components/EmptyState.js";
import { PageHeader } from "../../components/PageHeader.js";
import type { MemberReport, WorkloadReport } from "../../api/reports/types.js";
import { fetchWorkloadReport } from "./reportsClient.js";
import {
  barWidthPercent,
  barWidthStyle,
  isOverdueHighlighted,
  largestTotal,
  overdueLabel,
  totalLabel,
} from "./reportsModel.js";
import "./ReportsPage.css";

/** How the screen reads the report. The shipped client satisfies it. */
export type ReportsReader = () => Promise<WorkloadReport>;

export interface ReportsViewProps {
  /** The reader the screen calls. The tests pass a stub. */
  readonly readReport: ReportsReader;
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "The workload report could not be loaded.";
}

/** One plain count cell, addressable from the tests. */
function countCell(member: MemberReport, field: string, value: number): JSX.Element {
  return (
    <span className="reports-count" data-testid={`reports-${field}-${member.memberId}`}>
      {value}
    </span>
  );
}

/**
 * The table columns. `largest` is the biggest total in the report, which every
 * bar is measured against.
 */
function reportColumns(largest: number): readonly DataTableColumn<MemberReport>[] {
  return [
    {
      key: "member",
      header: "Member",
      cell: (row: MemberReport) => (
        <span className="reports-member__name">{row.memberName}</span>
      ),
    },
    { key: "role", header: "Role", cell: (row: MemberReport) => row.role },
    {
      key: "todo",
      header: "To do",
      align: "right",
      cell: (row: MemberReport) => countCell(row, "todo", row.todo),
    },
    {
      key: "doing",
      header: "Doing",
      align: "right",
      cell: (row: MemberReport) => countCell(row, "doing", row.doing),
    },
    {
      key: "done",
      header: "Done",
      align: "right",
      cell: (row: MemberReport) => countCell(row, "done", row.done),
    },
    {
      key: "overdue",
      header: "Overdue",
      align: "right",
      cell: (row: MemberReport) => (
        <span
          className={
            isOverdueHighlighted(row.overdue)
              ? "reports-overdue is-overdue"
              : "reports-overdue"
          }
          data-testid={`reports-overdue-${row.memberId}`}
          data-overdue={isOverdueHighlighted(row.overdue) ? "yes" : "no"}
          title={overdueLabel(row.overdue)}
        >
          <span className="reports-overdue__count">{row.overdue}</span>
          <span className="reports-overdue__note">
            {isOverdueHighlighted(row.overdue) ? "overdue" : "on time"}
          </span>
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (row: MemberReport) => countCell(row, "total", row.total),
    },
    {
      key: "workload",
      header: "Workload",
      cell: (row: MemberReport) => (
        <span
          className="reports-bar"
          role="img"
          aria-label={`${totalLabel(row.total)} — ${String(
            barWidthPercent(row.total, largest),
          )}% of the busiest member`}
        >
          <span
            className="reports-bar__fill"
            data-testid={`reports-bar-${row.memberId}`}
            style={{ width: barWidthStyle(row.total, largest) }}
          />
        </span>
      ),
    },
  ];
}

/** The screen with its reader injected — this is what the lane's tests drive. */
export function ReportsView({ readReport }: ReportsViewProps): JSX.Element {
  const [report, setReport] = useState<WorkloadReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void readReport()
      .then((loaded: WorkloadReport): void => {
        if (active) {
          setReport(loaded);
          setError("");
        }
      })
      .catch((failure: unknown): void => {
        if (active) {
          setError(messageOf(failure));
        }
      })
      .finally((): void => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [readReport, attempt]);

  const retry = useCallback((): void => {
    setAttempt((value: number): number => value + 1);
  }, []);

  const members: readonly MemberReport[] = report === null ? [] : report.members;
  const largest = largestTotal(members.map((member: MemberReport): number => member.total));
  const columns = reportColumns(largest);
  const ready = !loading && error === "" && report !== null;

  return (
    <div className="reports-page">
      <PageHeader title="Reports" />

      <p className="reports-intro">
        Reports of open work per team member — the To do, Doing, Done, overdue and total counts are
        all calculated on the server from the stored tasks.
      </p>

      {error !== "" ? (
        <p className="notice notice-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="notice" role="status">
          Loading the workload report…
        </p>
      ) : null}

      {!loading && error !== "" ? (
        <div className="reports-actions">
          <Button variant="primary" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : null}

      {ready && members.length === 0 ? (
        <EmptyState
          title="No team members yet"
          message="Add people on the Team page and their To do, Doing, Done, overdue and total counts will appear here."
        />
      ) : null}

      {ready && members.length > 0 ? (
        <>
          <DataTable
            caption="Member workload"
            columns={columns}
            rows={members}
            rowKey={(row: MemberReport) => row.memberId}
            emptyMessage="No team members yet, so there is no workload to report."
          />
          <p className="reports-note">
            Each bar shows that member&apos;s total relative to the busiest member in the report.
          </p>
        </>
      ) : null}
    </div>
  );
}

/** The page the shell registers for `/reports`, bound to the real API client. */
export function ReportsPage(): JSX.Element {
  return <ReportsView readReport={fetchWorkloadReport} />;
}

export default ReportsPage;
