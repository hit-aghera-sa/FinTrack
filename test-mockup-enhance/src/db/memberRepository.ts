import type { PrismaClient } from "./generated.js";

import { prisma } from "./client.js";
import { toTeamMember, withWorkload } from "./mappers.js";
import type {
  NewTeamMember,
  TeamMember,
  TeamMemberWithWorkload,
} from "../models/member.js";

export interface TeamMemberRepository {
  list(): Promise<TeamMember[]>;
  listWithWorkload(): Promise<TeamMemberWithWorkload[]>;
  findById(id: string): Promise<TeamMember | null>;
  create(input: NewTeamMember): Promise<TeamMember>;
  remove(id: string): Promise<void>;
}

/** Prisma-backed roster repository, including derived open-task counts. */
export function createTeamMemberRepository(
  client: PrismaClient = prisma,
): TeamMemberRepository {
  return {
    async list(): Promise<TeamMember[]> {
      const rows = await client.teamMember.findMany({
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      return rows.map((row) => toTeamMember(row));
    },

    async listWithWorkload(): Promise<TeamMemberWithWorkload[]> {
      const members = await client.teamMember.findMany({
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      const openTasks = await client.task.findMany({
        where: { status: { not: "done" }, assigneeId: { not: null } },
        select: { assigneeId: true },
      });
      return withWorkload(members, openTasks);
    },

    async findById(id: string): Promise<TeamMember | null> {
      const row = await client.teamMember.findUnique({ where: { id } });
      return row === null ? null : toTeamMember(row);
    },

    async create(input: NewTeamMember): Promise<TeamMember> {
      const row = await client.teamMember.create({
        data: { name: input.name.trim(), role: input.role.trim() },
      });
      return toTeamMember(row);
    },

    async remove(id: string): Promise<void> {
      // Tasks that pointed at the removed member stay on the board, unassigned.
      await client.$transaction([
        client.task.updateMany({
          where: { assigneeId: id },
          data: { assigneeId: null },
        }),
        client.teamMember.delete({ where: { id } }),
      ]);
    },
  };
}
