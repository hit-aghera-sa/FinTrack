/**
 * TURNING TASK EVENTS INTO ACTIVITY ENTRIES.
 *
 * Deliberately free of Express, so every rule here is unit tested against a
 * stubbed repository; `router.ts` beside it is a thin HTTP adapter. All storage
 * goes through {@link ActivityRepository}, and the domain models come from the
 * shared models (`src/models/**`) — nothing is re-declared here.
 *
 *   • logTaskCreated   one `task_created` entry with a readable message.
 *   • logTaskUpdated   diffs a before/after snapshot and records ONE entry per
 *                      changed field, using the specific kinds for status,
 *                      priority, assignee and labels and `field_changed` for
 *                      every other field. A field whose before and after values
 *                      are equal produces no entry at all.
 *   • logCommentAdded  one `comment_added` entry.
 *   • logTaskDeleted   one `task_deleted` entry.
 *   • listActivity     the reads, newest first, with an optional limit.
 *
 * EVERY ENTRY IS ATTRIBUTED TO A REAL NAME. The timeline shows `actor`, so an
 * entry recorded without one reads as a nameless "Someone". The name is
 * resolved from the roster: the team member the task belongs to (for an
 * assignee change, the person it moved to, falling back to the person it moved
 * from). This product has no accounts, so a task nobody is assigned to is
 * attributed to {@link BOARD_ACTOR} rather than to an anonymous placeholder.
 */
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, } from "../../models/task.js";
import { clampActivityLimit } from "./repository.js";
/** The longest comment extract an entry's message carries. */
export const MAX_COMMENT_EXTRACT = 120;
/**
 * Who an entry is attributed to when the task belongs to nobody. The board is
 * shared and there are no accounts, so this is the honest answer — and it is
 * never the anonymous "Someone" the timeline falls back to for an entry that
 * carries no name at all.
 */
export const BOARD_ACTOR = "The team";
/** The fallback naming, used when no roster is wired in. */
export function describeAssigneeId(assigneeId) {
    return assigneeId === null ? "Unassigned" : "a team member";
}
/** Just the calendar day of a stored due date, or null when there is none. */
function dayOf(dueDate) {
    if (dueDate === null) {
        return null;
    }
    const trimmed = dueDate.trim();
    return trimmed === "" ? null : trimmed.slice(0, 10);
}
/** "none" for a value that is not there, so a message always reads. */
function orNone(value) {
    return value === null || value === "" ? "none" : value;
}
/** The names of a task's labels, in name order. */
function sortedLabelNames(task) {
    return (task.labels ?? [])
        .map((label) => label.name)
        .sort((left, right) => left.localeCompare(right));
}
function sameNames(before, after) {
    if (before.length !== after.length) {
        return false;
    }
    return before.every((name, index) => name === after[index]);
}
/** A label list as text, or null when there are none. */
function labelList(names) {
    return names.length === 0 ? null : names.join(", ");
}
function describeDescription(before, after) {
    if (before.trim() === "") {
        return "Description added.";
    }
    if (after.trim() === "") {
        return "Description removed.";
    }
    return "Description updated.";
}
/** A comment body on one line, short enough to read in a feed. */
export function commentExtract(body) {
    const flattened = body.split(/\s+/).filter((part) => part !== "").join(" ");
    if (flattened.length <= MAX_COMMENT_EXTRACT) {
        return flattened;
    }
    return `${flattened.slice(0, MAX_COMMENT_EXTRACT).trimEnd()}…`;
}
/**
 * THE DIFFING RULES, as a pure function.
 *
 * One change per field that really changed, in a fixed field order, using the
 * specific kind for status, priority, assignee and labels and `field_changed`
 * for title, description and the due date. Equal values produce nothing.
 */
export function diffTaskFields(before, after, nameAssignee = describeAssigneeId) {
    const changes = [];
    if (before.title !== after.title) {
        changes.push({
            kind: "field_changed",
            field: "title",
            from: before.title,
            to: after.title,
            message: `Title changed from "${before.title}" to "${after.title}".`,
        });
    }
    if (before.description !== after.description) {
        changes.push({
            kind: "field_changed",
            field: "description",
            from: before.description,
            to: after.description,
            message: describeDescription(before.description, after.description),
        });
    }
    if (before.assigneeId !== after.assigneeId) {
        changes.push({
            kind: "assignee_changed",
            field: "assignee",
            from: before.assigneeId,
            to: after.assigneeId,
            message: `Assignee changed from ${nameAssignee(before.assigneeId)} to ${nameAssignee(after.assigneeId)}.`,
        });
    }
    const beforeDay = dayOf(before.dueDate);
    const afterDay = dayOf(after.dueDate);
    if (beforeDay !== afterDay) {
        changes.push({
            kind: "field_changed",
            field: "dueDate",
            from: beforeDay,
            to: afterDay,
            message: `Due date changed from ${orNone(beforeDay)} to ${orNone(afterDay)}.`,
        });
    }
    if (before.status !== after.status) {
        changes.push({
            kind: "status_changed",
            field: "status",
            from: before.status,
            to: after.status,
            message: `Status moved from ${TASK_STATUS_LABELS[before.status]} to ${TASK_STATUS_LABELS[after.status]}.`,
        });
    }
    if (before.priority !== after.priority) {
        changes.push({
            kind: "priority_changed",
            field: "priority",
            from: before.priority,
            to: after.priority,
            message: `Priority changed from ${TASK_PRIORITY_LABELS[before.priority]} to ${TASK_PRIORITY_LABELS[after.priority]}.`,
        });
    }
    const beforeLabels = sortedLabelNames(before);
    const afterLabels = sortedLabelNames(after);
    if (!sameNames(beforeLabels, afterLabels)) {
        changes.push({
            kind: "labels_changed",
            field: "labels",
            from: labelList(beforeLabels),
            to: labelList(afterLabels),
            message: `Labels changed from ${orNone(labelList(beforeLabels))} to ${orNone(labelList(afterLabels))}.`,
        });
    }
    return changes;
}
/** Records task events as activity entries, and serves the reads. */
export class TaskActivityService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    /** One `task_created` entry for a task that has just been stored. */
    async logTaskCreated(task) {
        const entry = {
            taskId: task.id,
            kind: "task_created",
            field: null,
            fromValue: null,
            toValue: task.status,
            actor: await this.actorFor(task.assigneeId),
            message: `Created the task "${task.title}" in ${TASK_STATUS_LABELS[task.status]}.`,
        };
        return this.deps.activity.create(entry);
    }
    /**
     * One entry per field that changed between the two snapshots, in field order.
     * An edit that changed nothing records nothing and returns an empty list.
     */
    async logTaskUpdated(before, after) {
        const nameAssignee = await this.assigneeNamer(before.assigneeId, after.assigneeId);
        const changes = diffTaskFields(before, after, nameAssignee);
        if (changes.length === 0) {
            return [];
        }
        // The person the task belongs to after the edit; the one it moved away from
        // when it was handed to nobody.
        const actor = await this.actorFor(after.assigneeId, before.assigneeId);
        const recorded = [];
        for (const change of changes) {
            const entry = {
                taskId: after.id,
                kind: change.kind,
                field: change.field,
                fromValue: change.from,
                toValue: change.to,
                actor,
                message: change.message,
            };
            recorded.push(await this.deps.activity.create(entry));
        }
        return recorded;
    }
    /**
     * One `comment_added` entry carrying an extract of what was said.
     *
     * `assigneeId` is the team member the task belongs to, so the entry can be
     * attributed to a real name; without it the comment is attributed to the
     * board.
     */
    async logCommentAdded(taskId, body, assigneeId) {
        const extract = commentExtract(body);
        const entry = {
            taskId,
            kind: "comment_added",
            field: null,
            fromValue: null,
            toValue: extract,
            actor: await this.actorFor(assigneeId ?? null),
            message: `Comment added: "${extract}"`,
        };
        return this.deps.activity.create(entry);
    }
    /** One `task_deleted` entry for a task that has just been removed. */
    async logTaskDeleted(task) {
        const entry = {
            taskId: task.id,
            kind: "task_deleted",
            field: null,
            fromValue: task.status,
            toValue: null,
            actor: await this.actorFor(task.assigneeId),
            message: `Deleted the task "${task.title}".`,
        };
        return this.deps.activity.create(entry);
    }
    /**
     * One task's entries, NEWEST FIRST. `limit` caps how many come back and is
     * clamped to the shared maximum; without it the whole feed is returned.
     */
    async listActivity(taskId, limit) {
        const capped = limit === undefined ? undefined : clampActivityLimit(limit);
        const entries = await this.deps.activity.listByTask(taskId, capped);
        // A stable sort, so entries sharing a timestamp keep the store's order.
        const ordered = [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        return capped === undefined ? ordered : ordered.slice(0, capped);
    }
    /**
     * The stored name of one team member, or null when there is none to show.
     * A roster failure is never allowed to stop an entry being recorded.
     */
    async lookupName(assigneeId) {
        const members = this.deps.members;
        if (assigneeId === null || assigneeId.trim() === "" || members === undefined) {
            return null;
        }
        try {
            const member = await members.findById(assigneeId);
            return member === null ? null : member.name;
        }
        catch {
            // Naming a person is a nicety; the entry is recorded regardless.
            return null;
        }
    }
    /**
     * THE NAME AN ENTRY IS ATTRIBUTED TO: the first of these ids that belongs to
     * a team member the roster can name, or {@link BOARD_ACTOR} when the task
     * belongs to nobody.
     */
    async actorFor(...ids) {
        for (const id of ids) {
            const name = await this.lookupName(id);
            if (name !== null && name.trim() !== "") {
                return name;
            }
        }
        return BOARD_ACTOR;
    }
    /**
     * Resolves the names behind the assignee ids of one edit, so the message can
     * say who the task moved between.
     */
    async assigneeNamer(...ids) {
        const resolved = new Map();
        for (const id of ids) {
            if (id === null || resolved.has(id)) {
                continue;
            }
            const name = await this.lookupName(id);
            if (name !== null) {
                resolved.set(id, name);
            }
        }
        return (assigneeId) => {
            if (assigneeId === null) {
                return "Unassigned";
            }
            return resolved.get(assigneeId) ?? "a former team member";
        };
    }
}
