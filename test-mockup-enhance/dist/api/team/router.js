import express from "express";
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
/** A non-blank trimmed string, or null when the value is missing/blank/not a string. */
function readRequiredString(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}
function failure(error) {
    return { error: error instanceof Error ? error.message : String(error) };
}
/**
 * The team roster API, mounted by the composition root under `/api`:
 *
 *   GET    /api/members      every member with the live open-task count
 *   POST   /api/members      create from { name, role }; 400 when either is blank
 *   DELETE /api/members/:id  remove the member; the repository unassigns any
 *                            tasks that still pointed at them, so those tasks
 *                            stay visible on the board
 */
export function createTeamRouter(deps) {
    const router = express.Router();
    // Idempotent: body-parser skips a request whose body another layer already read.
    router.use(express.json());
    router.get("/members", async (_req, res) => {
        try {
            const roster = await deps.members.listWithWorkload();
            res.status(200).json(roster);
        }
        catch (error) {
            res.status(500).json(failure(error));
        }
    });
    router.post("/members", async (req, res) => {
        const body = req.body;
        const name = isRecord(body) ? readRequiredString(body.name) : null;
        const role = isRecord(body) ? readRequiredString(body.role) : null;
        if (name === null) {
            const problem = { error: "Name is required." };
            res.status(400).json(problem);
            return;
        }
        if (role === null) {
            const problem = { error: "Role is required." };
            res.status(400).json(problem);
            return;
        }
        const input = { name, role };
        try {
            const created = await deps.members.create(input);
            res.status(201).json(created);
        }
        catch (error) {
            res.status(500).json(failure(error));
        }
    });
    router.delete("/members/:id", async (req, res) => {
        const id = readRequiredString(req.params.id);
        if (id === null) {
            const problem = { error: "Member not found." };
            res.status(404).json(problem);
            return;
        }
        try {
            const existing = await deps.members.findById(id);
            if (existing === null) {
                const problem = { error: "Member not found." };
                res.status(404).json(problem);
                return;
            }
            // The repository unassigns the member's tasks in the same transaction.
            await deps.members.remove(id);
            res.status(200).json({ id });
        }
        catch (error) {
            res.status(500).json(failure(error));
        }
    });
    return router;
}
