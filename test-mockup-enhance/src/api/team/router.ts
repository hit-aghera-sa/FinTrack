import express, { type Request, type Response, type Router } from "express";

import type { TeamMemberRepository } from "../../db/memberRepository.js";
import type {
  NewTeamMember,
  TeamMember,
  TeamMemberWithWorkload,
} from "../../models/member.js";

/** Everything the team roster API needs: the shared roster repository. */
export interface TeamRouterDeps {
  members: TeamMemberRepository;
}

/** The shape of every error body this router sends. */
interface ApiErrorBody {
  error: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A non-blank trimmed string, or null when the value is missing/blank/not a string. */
function readRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function failure(error: unknown): ApiErrorBody {
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
export function createTeamRouter(deps: TeamRouterDeps): Router {
  const router = express.Router();
  // Idempotent: body-parser skips a request whose body another layer already read.
  router.use(express.json());

  router.get("/members", async (_req: Request, res: Response): Promise<void> => {
    try {
      const roster: TeamMemberWithWorkload[] = await deps.members.listWithWorkload();
      res.status(200).json(roster);
    } catch (error: unknown) {
      res.status(500).json(failure(error));
    }
  });

  router.post("/members", async (req: Request, res: Response): Promise<void> => {
    const body: unknown = req.body;
    const name = isRecord(body) ? readRequiredString(body.name) : null;
    const role = isRecord(body) ? readRequiredString(body.role) : null;

    if (name === null) {
      const problem: ApiErrorBody = { error: "Name is required." };
      res.status(400).json(problem);
      return;
    }
    if (role === null) {
      const problem: ApiErrorBody = { error: "Role is required." };
      res.status(400).json(problem);
      return;
    }

    const input: NewTeamMember = { name, role };
    try {
      const created: TeamMember = await deps.members.create(input);
      res.status(201).json(created);
    } catch (error: unknown) {
      res.status(500).json(failure(error));
    }
  });

  router.delete("/members/:id", async (req: Request, res: Response): Promise<void> => {
    const id = readRequiredString(req.params.id);
    if (id === null) {
      const problem: ApiErrorBody = { error: "Member not found." };
      res.status(404).json(problem);
      return;
    }

    try {
      const existing: TeamMember | null = await deps.members.findById(id);
      if (existing === null) {
        const problem: ApiErrorBody = { error: "Member not found." };
        res.status(404).json(problem);
        return;
      }
      // The repository unassigns the member's tasks in the same transaction.
      await deps.members.remove(id);
      res.status(200).json({ id });
    } catch (error: unknown) {
      res.status(500).json(failure(error));
    }
  });

  return router;
}
