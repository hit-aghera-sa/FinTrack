/**
 * THE IN-MEMORY DATASTORE.
 *
 * The very same repository interfaces the database lane owns
 * (`src/db/taskRepository.ts`, `src/db/memberRepository.ts`,
 * `src/db/commentRepository.ts`), backed by plain arrays instead of Prisma, so
 * the assembled app boots and behaves identically when no PostgreSQL
 * connection string is configured (`APP_DB=memory`, or an empty
 * `DATABASE_URL`). No route, contract or payload differs.
 *
 * Nothing happens at import time: a store exists only once
 * {@link createMemoryRepositories} is called.
 */
import { formatDueDate, parseDueDate } from "../db/mappers.js";
import { DEFAULT_TASK_PRIORITY, DEFAULT_TASK_STATUS, } from "../models/task.js";
const SEED_MEMBERS = [
    { name: "Priya Natarajan", role: "Engineering Lead" },
    { name: "Dan Okafor", role: "Backend Engineer" },
    { name: "Mei Lin", role: "Product Designer" },
    { name: "Carlos Vega", role: "QA Engineer" },
];
/**
 * A starting board with work in all three columns and a deliberate MIX of
 * priorities, so the board, the add-task form and the workload report all have
 * real High / Medium / Low data to show.
 */
const SEED_TASKS = [
    {
        title: "Design the onboarding email",
        description: "Draft copy and layout for the welcome email.",
        assignee: "Priya Natarajan",
        dueDate: "2025-02-18",
        status: "todo",
        priority: "High",
    },
    {
        title: "Tidy the board column labels",
        description: "Make the three column headings read consistently.",
        assignee: "Dan Okafor",
        dueDate: null,
        status: "todo",
        priority: "Low",
    },
    {
        title: "Wire the workload report",
        description: "Per-member counts for each status, overdue and total.",
        assignee: "Dan Okafor",
        dueDate: "2026-03-02",
        status: "doing",
        priority: "High",
    },
    {
        title: "Review the release checklist",
        description: "Walk the steps for release day with the team.",
        assignee: "Mei Lin",
        dueDate: "2026-03-10",
        status: "doing",
        priority: DEFAULT_TASK_PRIORITY,
    },
    {
        title: "Publish the sprint notes",
        description: "Summarise what shipped and share it with the team.",
        assignee: "Carlos Vega",
        dueDate: "2025-01-09",
        status: "done",
        priority: "Low",
    },
];
/** Deterministic creation stamps for the seeded rows, one minute apart. */
const SEED_START = Date.UTC(2026, 0, 5, 9, 0, 0);
const MINUTE = 60_000;
function normaliseAssigneeId(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}
/** Stores the calendar day exactly as the Prisma-backed repository would. */
function normaliseDueDate(value) {
    return formatDueDate(parseDueDate(value));
}
function byNameThenId(left, right) {
    if (left.name === right.name) {
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    }
    return left.name < right.name ? -1 : 1;
}
/**
 * Builds a fresh store with the seeded roster and board. Each call is
 * completely independent, so a test can hold its own.
 */
export function createMemoryRepositories() {
    let sequence = 0;
    const nextId = (prefix) => {
        sequence += 1;
        return `${prefix}-${sequence.toString(36)}`;
    };
    const members = [];
    const tasks = [];
    const comments = [];
    const idByName = new Map();
    for (const seed of SEED_MEMBERS) {
        const member = { id: nextId("member"), name: seed.name, role: seed.role };
        members.push(member);
        idByName.set(member.name, member.id);
    }
    SEED_TASKS.forEach((seed, index) => {
        let assigneeId = null;
        if (seed.assignee !== null) {
            assigneeId = idByName.get(seed.assignee) ?? null;
        }
        tasks.push({
            id: nextId("task"),
            title: seed.title,
            description: seed.description,
            assigneeId,
            dueDate: normaliseDueDate(seed.dueDate),
            status: seed.status,
            priority: seed.priority,
            createdAt: new Date(SEED_START + index * MINUTE).toISOString(),
        });
    });
    const taskRepository = {
        list() {
            return Promise.resolve(tasks.map((task) => ({ ...task })));
        },
        findById(id) {
            const found = tasks.find((task) => task.id === id);
            return Promise.resolve(found === undefined ? null : { ...found });
        },
        create(input) {
            const created = {
                id: nextId("task"),
                title: input.title.trim(),
                description: input.description?.trim() ?? "",
                assigneeId: normaliseAssigneeId(input.assigneeId),
                dueDate: normaliseDueDate(input.dueDate),
                status: input.status ?? DEFAULT_TASK_STATUS,
                priority: input.priority ?? DEFAULT_TASK_PRIORITY,
                createdAt: new Date().toISOString(),
            };
            tasks.push(created);
            return Promise.resolve({ ...created });
        },
        update(id, patch) {
            const index = tasks.findIndex((task) => task.id === id);
            const current = index === -1 ? undefined : tasks[index];
            if (current === undefined) {
                return Promise.reject(new Error("That task does not exist."));
            }
            const next = {
                id: current.id,
                title: patch.title === undefined ? current.title : patch.title.trim(),
                description: patch.description === undefined ? current.description : patch.description.trim(),
                assigneeId: patch.assigneeId === undefined
                    ? current.assigneeId
                    : normaliseAssigneeId(patch.assigneeId),
                dueDate: patch.dueDate === undefined ? current.dueDate : normaliseDueDate(patch.dueDate),
                status: patch.status ?? current.status,
                priority: patch.priority ?? current.priority,
                createdAt: current.createdAt,
            };
            tasks[index] = next;
            return Promise.resolve({ ...next });
        },
    };
    const memberRepository = {
        list() {
            return Promise.resolve(members.map((member) => ({ ...member })).sort(byNameThenId));
        },
        listWithWorkload() {
            const roster = members
                .map((member) => ({ ...member }))
                .sort(byNameThenId);
            return Promise.resolve(roster.map((member) => ({
                id: member.id,
                name: member.name,
                role: member.role,
                openTaskCount: tasks.filter((task) => task.assigneeId === member.id && task.status !== "done").length,
            })));
        },
        findById(id) {
            const found = members.find((member) => member.id === id);
            return Promise.resolve(found === undefined ? null : { ...found });
        },
        create(input) {
            const created = {
                id: nextId("member"),
                name: input.name.trim(),
                role: input.role.trim(),
            };
            members.push(created);
            return Promise.resolve({ ...created });
        },
        remove(id) {
            // Tasks that pointed at the removed member stay on the board, unassigned.
            tasks.forEach((task, index) => {
                if (task.assigneeId === id) {
                    tasks[index] = { ...task, assigneeId: null };
                }
            });
            const at = members.findIndex((member) => member.id === id);
            if (at >= 0) {
                members.splice(at, 1);
            }
            return Promise.resolve();
        },
    };
    const commentRepository = {
        listByTask(taskId) {
            return Promise.resolve(comments
                .filter((comment) => comment.taskId === taskId)
                .map((comment) => ({ ...comment })));
        },
        create(taskId, input) {
            const created = {
                id: nextId("comment"),
                taskId,
                body: input.body.trim(),
                createdAt: new Date().toISOString(),
            };
            comments.push(created);
            return Promise.resolve({ ...created });
        },
    };
    return { tasks: taskRepository, members: memberRepository, comments: commentRepository };
}
