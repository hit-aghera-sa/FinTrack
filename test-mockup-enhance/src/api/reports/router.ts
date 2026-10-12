/**
 * The reporting HTTP API.
 *
 * Mounted under `/api` by the server composition root, so the endpoint is:
 *   GET /api/reports → 200 WorkloadReport
 *                      500 { message } when the query fails
 *
 * The router computes today's date on the SERVER and hands it to the report
 * repository; every number in the payload is produced server-side.
 *
 * Values come off the `express` DEFAULT import (safe under NodeNext for a
 * CommonJS package); types come through `import type`.
 */

import express from "express";
import type { Request, Response, Router } from "express";

import { REPORTS_SUBPATH } from "../../shared/api-paths.js";
import type { ReportRepository } from "./repository.js";
import type { MemberReport, WorkloadReport } from "./types.js";
import { serverToday } from "./workload.js";

/** The one spelling of the report path, relative to the `/api` mount. */
export const REPORT_ROUTE_PATH = REPORTS_SUBPATH;

/** What the report router needs. */
export interface ReportRouterDeps {
  reports: ReportRepository;
  /** The server clock. Defaults to the real one; the tests pin it. */
  now?: () => Date;
}

/** The body of the problem response this router sends. */
interface ProblemBody {
  message: string;
}

function describe(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "The workload report could not be produced.";
}

async function handleReport(deps: ReportRouterDeps, res: Response): Promise<void> {
  const moment = deps.now === undefined ? new Date() : deps.now();
  try {
    const members: MemberReport[] = await deps.reports.memberWorkload(serverToday(moment));
    const payload: WorkloadReport = {
      generatedAt: moment.toISOString(),
      members,
    };
    res.status(200).json(payload);
  } catch (error: unknown) {
    const problem: ProblemBody = { message: describe(error) };
    res.status(500).json(problem);
  }
}

/**
 * Builds the report router. The composition root mounts it with
 * `app.use("/api", createReportRouter(deps))`.
 */
export function createReportRouter(deps: ReportRouterDeps): Router {
  const router: Router = express.Router();

  router.get(REPORT_ROUTE_PATH, (_req: Request, res: Response): void => {
    void handleReport(deps, res);
  });

  return router;
}
