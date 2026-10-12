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

import type { CommentRepository } from "../db/commentRepository.js";
import type { TeamMemberRepository } from "../db/memberRepository.js";
import type { TaskRepository } from "../db/taskRepository.js";
import { formatDueDate, parseDueDate } from "../db/mappers.js";
import type { NewComment, TaskComment } from "../models/comment.js";
import type {
  NewTeamMember,
  TeamMember,
  TeamMemberWithWorkload,
} from "../models/member.js";
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  type NewTask,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskUpdate,
} from "../models/task.js";

/** The repository set the composition root hands to every feature router. */
export interface Repositories {
  tasks: TaskRepository;
  members: TeamMemberRepository;
  comments: CommentRepository;
}

interface SeedMember {
  name: string;
  role: string;
}

interface SeedTask {
  title: string;
  description: string;
  /** The seeded member who owns it, or null for unassigned. */
  assignee: string | null;
  /** Calendar day in `YYYY-MM-DD` form, or null. */
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
}

const SEED_MEMBERS: readonly SeedMember[] = [
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
const SEED_TASKS: readonly SeedTask[] = [
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

function normaliseAssigneeId(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Stores the calendar day exactly as the Prisma-backed repository would. */
function normaliseDueDate(value: string | null | undefined): string | null {
  return formatDueDate(parseDueDate(value));
}

function byNameThenId(left: TeamMember, right: TeamMember): number {
  if (left.name === right.name) {
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  }
  return left.name < right.name ? -1 : 1;
}

/**
 * Builds a fresh store with the seeded roster and board. Each call is
 * completely independent, so a test can hold its own.
 */
export function createMemoryRepositories(): Repositories {
  let sequence = 0;
  const nextId = (prefix: string): string => {
    sequence += 1;
    return `${prefix}-${sequence.toString(36)}`;
  };

  const members: TeamMember[] = [];
  const tasks: Task[] = [];
  const comments: TaskComment[] = [];

  const idByName = new Map<string, string>();
  for (const seed of SEED_MEMBERS) {
    const member: TeamMember = { id: nextId("member"), name: seed.name, role: seed.role };
    members.push(member);
    idByName.set(member.name, member.id);
  }

  SEED_TASKS.forEach((seed: SeedTask, index: number): void => {
    let assigneeId: string | null = null;
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

  const taskRepository: TaskRepository = {
    list(): Promise<Task[]> {
      return Promise.resolve(tasks.map((task: Task): Task => ({ ...task })));
    },

    findById(id: string): Promise<Task | null> {
      const found = tasks.find((task: Task): boolean => task.id === id);
      return Promise.resolve(found === undefined ? null : { ...found });
    },

    create(input: NewTask): Promise<Task> {
      const created: Task = {
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

    update(id: string, patch: TaskUpdate): Promise<Task> {
      const index = tasks.findIndex((task: Task): boolean => task.id === id);
      const current = index === -1 ? undefined : tasks[index];
      if (current === undefined) {
        return Promise.reject(new Error("That task does not exist."));
      }
      const next: Task = {
        id: current.id,
        title: patch.title === undefined ? current.title : patch.title.trim(),
        description:
          patch.description === undefined ? current.description : patch.description.trim(),
        assigneeId:
          patch.assigneeId === undefined
            ? current.assigneeId
            : normaliseAssigneeId(patch.assigneeId),
        dueDate:
          patch.dueDate === undefined ? current.dueDate : normaliseDueDate(patch.dueDate),
        status: patch.status ?? current.status,
        priority: patch.priority ?? current.priority,
        createdAt: current.createdAt,
      };
      tasks[index] = next;
      return Promise.resolve({ ...next });
    },
  };

  const memberRepository: TeamMemberRepository = {
    list(): Promise<TeamMember[]> {
      return Promise.resolve(
        members.map((member: TeamMember): TeamMember => ({ ...member })).sort(byNameThenId),
      );
    },

    listWithWorkload(): Promise<TeamMemberWithWorkload[]> {
      const roster = members
        .map((member: TeamMember): TeamMember => ({ ...member }))
        .sort(byNameThenId);
      return Promise.resolve(
        roster.map((member: TeamMember): TeamMemberWithWorkload => ({
          id: member.id,
          name: member.name,
          role: member.role,
          openTaskCount: tasks.filter(
            (task: Task): boolean => task.assigneeId === member.id && task.status !== "done",
          ).length,
        })),
      );
    },

    findById(id: string): Promise<TeamMember | null> {
      const found = members.find((member: TeamMember): boolean => member.id === id);
      return Promise.resolve(found === undefined ? null : { ...found });
    },

    create(input: NewTeamMember): Promise<TeamMember> {
      const created: TeamMember = {
        id: nextId("member"),
        name: input.name.trim(),
        role: input.role.trim(),
      };
      members.push(created);
      return Promise.resolve({ ...created });
    },

    remove(id: string): Promise<void> {
      // Tasks that pointed at the removed member stay on the board, unassigned.
      tasks.forEach((task: Task, index: number): void => {
        if (task.assigneeId === id) {
          tasks[index] = { ...task, assigneeId: null };
        }
      });
      const at = members.findIndex((member: TeamMember): boolean => member.id === id);
      if (at >= 0) {
        members.splice(at, 1);
      }
      return Promise.resolve();
    },
  };

  const commentRepository: CommentRepository = {
    listByTask(taskId: string): Promise<TaskComment[]> {
      return Promise.resolve(
        comments
          .filter((comment: TaskComment): boolean => comment.taskId === taskId)
          .map((comment: TaskComment): TaskComment => ({ ...comment })),
      );
    },

    create(taskId: string, input: NewComment): Promise<TaskComment> {
      const created: TaskComment = {
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
