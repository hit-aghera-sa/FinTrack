/**
 * The reports screen's read of `GET /api/reports`.
 *
 * The address comes from the one shared module (`src/shared/api-paths.ts`), the
 * same one the server mounts the router from. The payload is taken as the
 * server computed it: nothing here recounts, re-sums or re-derives a figure.
 */

import { REPORTS_ENDPOINT } from "../../shared/api-paths.js";
import type { MemberReport, WorkloadReport } from "../../api/reports/types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function decodeMemberReport(value: unknown): MemberReport {
  if (!isRecord(value)) {
    throw new Error("The report contained an entry that could not be read.");
  }
  return {
    memberId: textOf(value.memberId),
    memberName: textOf(value.memberName),
    role: textOf(value.role),
    todo: numberOf(value.todo),
    doing: numberOf(value.doing),
    done: numberOf(value.done),
    overdue: numberOf(value.overdue),
    total: numberOf(value.total),
  };
}

function decodeReport(value: unknown): WorkloadReport {
  if (!isRecord(value) || !Array.isArray(value.members)) {
    throw new Error("The server returned an unexpected report payload.");
  }
  return {
    generatedAt: textOf(value.generatedAt),
    members: value.members.map((entry: unknown): MemberReport => decodeMemberReport(entry)),
  };
}

function problemMessage(body: unknown, status: number): string {
  if (isRecord(body)) {
    const message: unknown = body.message;
    if (typeof message === "string" && message.trim() !== "") {
      return message;
    }
  }
  return `The report request failed with status ${String(status)}.`;
}

/** Reads the member-workload report from the backend. */
export async function fetchWorkloadReport(): Promise<WorkloadReport> {
  const init: RequestInit = { method: "GET", headers: { Accept: "application/json" } };

  let response: Response;
  try {
    response = await fetch(REPORTS_ENDPOINT, init);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`The report could not be reached: ${detail}`);
  }

  const text = await response.text();
  let body: unknown = null;
  if (text.trim() !== "") {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new Error(problemMessage(body, response.status));
  }
  return decodeReport(body);
}
