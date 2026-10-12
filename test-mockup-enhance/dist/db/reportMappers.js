/**
 * Pure aggregation behind the member workload report.
 *
 * No database driver is imported here, so every rule below can be unit tested
 * on its own; `reportRepository.ts` beside it supplies the stored rows through
 * Prisma.
 */
/**
 * Midnight UTC of the day `moment` falls in.
 *
 * Due dates are stored at UTC midnight (see `parseDueDate`), so comparing
 * against the UTC start of today makes "before today" a whole-day comparison
 * rather than one that shifts with the hour the report is asked for.
 */
export function startOfUtcDay(moment) {
    return new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate()));
}
/** A task is overdue when its due date is before today and it is not Done. */
export function isOverdue(task, startOfToday) {
    if (task.status === "done" || task.dueDate === null) {
        return false;
    }
    return task.dueDate.getTime() < startOfToday.getTime();
}
/** A member's report before any of their tasks have been counted. */
export function emptyMemberReport(member) {
    return {
        memberId: member.id,
        memberName: member.name,
        role: member.role,
        todo: 0,
        doing: 0,
        done: 0,
        overdue: 0,
        total: 0,
    };
}
/**
 * One entry per team member, in the order the roster was given, with the
 * per-status counts, the overdue count and the total.
 *
 * Members with no tasks are included with zero counts across the board; tasks
 * with no assignee, and tasks pointing at somebody who is no longer on the
 * roster, are counted for nobody.
 */
export function buildMemberReports(members, tasks, startOfToday) {
    const reports = new Map();
    for (const member of members) {
        reports.set(member.id, emptyMemberReport(member));
    }
    for (const task of tasks) {
        if (task.assigneeId === null) {
            continue;
        }
        const report = reports.get(task.assigneeId);
        if (report === undefined) {
            continue;
        }
        if (task.status === "todo") {
            report.todo += 1;
        }
        else if (task.status === "doing") {
            report.doing += 1;
        }
        else {
            report.done += 1;
        }
        report.total += 1;
        if (isOverdue(task, startOfToday)) {
            report.overdue += 1;
        }
    }
    return [...reports.values()];
}
