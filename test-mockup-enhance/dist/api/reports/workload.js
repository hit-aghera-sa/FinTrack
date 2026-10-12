/**
 * The server-side workload aggregation.
 *
 * Deliberately free of Express and of any database driver, so every counting
 * rule here is unit tested on its own. The shared domain models come from the
 * data lane (`src/models/**`) and are never re-declared.
 *
 * Every number the API reports is computed here, on the server, from the
 * stored tasks: the client derives no counts of its own.
 */
/** Renders a moment as the calendar day the comparisons below use. */
export function toIsoDay(moment) {
    return moment.toISOString().slice(0, 10);
}
/**
 * Today, as the server sees it. The router calls this so the overdue rule is
 * never evaluated against a clock the client controls.
 */
export function serverToday(now = new Date()) {
    return toIsoDay(now);
}
/** Just the day part of a stored due date, or an empty string when there is none. */
function dueDay(dueDate) {
    if (dueDate === null) {
        return "";
    }
    const trimmed = dueDate.trim();
    if (trimmed === "") {
        return "";
    }
    return trimmed.slice(0, 10);
}
/**
 * A task is overdue when its due date is before today AND its status is not
 * "done". A task with no due date is never overdue, and neither is one due
 * today.
 */
export function isOverdue(task, today) {
    if (task.status === "done") {
        return false;
    }
    const day = dueDay(task.dueDate);
    if (day === "") {
        return false;
    }
    return day < today;
}
function emptyReport(member) {
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
 * One {@link MemberReport} per team member, in the order the roster was given.
 *
 * The report covers the WHOLE roster: a member with no tasks appears with zero
 * counts across the board. A task with no assignee, or one pointing at a
 * member who is no longer on the roster, is attributed to nobody.
 */
export function buildMemberReports(members, tasks, today) {
    const byMember = new Map();
    const reports = [];
    for (const member of members) {
        const report = emptyReport(member);
        reports.push(report);
        byMember.set(member.id, report);
    }
    for (const task of tasks) {
        const assigneeId = task.assigneeId;
        if (assigneeId === null) {
            continue;
        }
        const report = byMember.get(assigneeId);
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
        if (isOverdue(task, today)) {
            report.overdue += 1;
        }
    }
    return reports;
}
