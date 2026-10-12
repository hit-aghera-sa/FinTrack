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
import { REPORTS_SUBPATH } from "../../shared/api-paths.js";
import { serverToday } from "./workload.js";
/** The one spelling of the report path, relative to the `/api` mount. */
export const REPORT_ROUTE_PATH = REPORTS_SUBPATH;
function describe(error) {
    if (error instanceof Error && error.message.trim() !== "") {
        return error.message;
    }
    return "The workload report could not be produced.";
}
async function handleReport(deps, res) {
    const moment = deps.now === undefined ? new Date() : deps.now();
    try {
        const members = await deps.reports.memberWorkload(serverToday(moment));
        const payload = {
            generatedAt: moment.toISOString(),
            members,
        };
        res.status(200).json(payload);
    }
    catch (error) {
        const problem = { message: describe(error) };
        res.status(500).json(problem);
    }
}
/**
 * Builds the report router. The composition root mounts it with
 * `app.use("/api", createReportRouter(deps))`.
 */
export function createReportRouter(deps) {
    const router = express.Router();
    router.get(REPORT_ROUTE_PATH, (_req, res) => {
        void handleReport(deps, res);
    });
    return router;
}
