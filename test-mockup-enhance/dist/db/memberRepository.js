import { prisma } from "./client.js";
import { toTeamMember, withWorkload } from "./mappers.js";
/** Prisma-backed roster repository, including derived open-task counts. */
export function createTeamMemberRepository(client = prisma) {
    return {
        async list() {
            const rows = await client.teamMember.findMany({
                orderBy: [{ name: "asc" }, { id: "asc" }],
            });
            return rows.map((row) => toTeamMember(row));
        },
        async listWithWorkload() {
            const members = await client.teamMember.findMany({
                orderBy: [{ name: "asc" }, { id: "asc" }],
            });
            const openTasks = await client.task.findMany({
                where: { status: { not: "done" }, assigneeId: { not: null } },
                select: { assigneeId: true },
            });
            return withWorkload(members, openTasks);
        },
        async findById(id) {
            const row = await client.teamMember.findUnique({ where: { id } });
            return row === null ? null : toTeamMember(row);
        },
        async create(input) {
            const row = await client.teamMember.create({
                data: { name: input.name.trim(), role: input.role.trim() },
            });
            return toTeamMember(row);
        },
        async remove(id) {
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
