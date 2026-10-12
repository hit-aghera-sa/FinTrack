import { disconnect, prisma } from "../src/db/client.js";
import { parseDueDate } from "../src/db/mappers.js";
import {
  DEFAULT_TASK_PRIORITY,
  type TaskPriority,
  type TaskStatus,
} from "../src/models/task.js";

interface SeedMember {
  name: string;
  role: string;
}

interface SeedLabel {
  name: string;
  /** A colour TOKEN name — never a literal colour value. */
  color: string;
}

interface SeedTask {
  title: string;
  description: string;
  /** The seeded member who owns the task, or null for an unassigned one. */
  assigneeName: string | null;
  /** Calendar day in `YYYY-MM-DD` form, or null for no due date. */
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** The seeded labels attached to the task; empty for an unlabelled one. */
  labelNames: readonly string[];
}

const SEED_MEMBERS: readonly SeedMember[] = [
  { name: "Alex Rivera", role: "Engineer" },
  { name: "Priya Nair", role: "Designer" },
  { name: "Sam Okafor", role: "Product Manager" },
  { name: "Mei Chen", role: "QA Engineer" },
];

/**
 * A handful of labels every board starts with, each carrying one of the shared
 * colour token names so the label list shows the whole range at a glance.
 */
const SEED_LABELS: readonly SeedLabel[] = [
  { name: "Bug", color: "danger" },
  { name: "Design", color: "info" },
  { name: "Documentation", color: "neutral" },
  { name: "Improvement", color: "success" },
  { name: "Urgent", color: "warning" },
];

/**
 * The seeded board: tasks across all three columns carrying a deliberate MIX
 * of priorities, so the board, the add-task form and the workload report all
 * have real High / Medium / Low data to show on a fresh database. A couple of
 * them also start with labels attached; the rest start with none.
 */
const SEED_TASKS: readonly SeedTask[] = [
  {
    title: "Draft the onboarding email",
    description: "Write the welcome copy and lay out the banner.",
    assigneeName: "Priya Nair",
    dueDate: "2026-02-18",
    status: "todo",
    priority: "High",
    labelNames: ["Design", "Urgent"],
  },
  {
    title: "Tidy the board column labels",
    description: "Make the three column headings read consistently.",
    assigneeName: "Alex Rivera",
    dueDate: null,
    status: "todo",
    priority: "Low",
    labelNames: [],
  },
  {
    title: "Wire the workload report",
    description: "Per-member counts for each status, overdue and total.",
    assigneeName: "Alex Rivera",
    dueDate: "2026-03-02",
    status: "doing",
    priority: "High",
    labelNames: ["Improvement"],
  },
  {
    title: "Review the release checklist",
    description: "Walk the steps for release day with the team.",
    assigneeName: "Sam Okafor",
    dueDate: "2026-03-10",
    status: "doing",
    priority: DEFAULT_TASK_PRIORITY,
    labelNames: [],
  },
  {
    title: "Publish the sprint notes",
    description: "Summarise what shipped and share it with the team.",
    assigneeName: "Mei Chen",
    dueDate: "2026-01-09",
    status: "done",
    priority: "Low",
    labelNames: [],
  },
];

/** Creates any missing member and returns the id of every seeded member by name. */
async function seedMembers(): Promise<{ created: number; ids: Map<string, string> }> {
  const ids = new Map<string, string>();
  let created = 0;

  for (const member of SEED_MEMBERS) {
    const existing = await prisma.teamMember.findFirst({
      where: { name: member.name },
    });
    if (existing === null) {
      const row = await prisma.teamMember.create({
        data: { name: member.name, role: member.role },
      });
      ids.set(row.name, row.id);
      created += 1;
      continue;
    }
    ids.set(existing.name, existing.id);
  }

  return { created, ids };
}

/** Creates any missing label and returns the id of every seeded label by name. */
async function seedLabels(): Promise<{ created: number; ids: Map<string, string> }> {
  const ids = new Map<string, string>();
  let created = 0;

  for (const label of SEED_LABELS) {
    const existing = await prisma.label.findUnique({ where: { name: label.name } });
    if (existing === null) {
      const row = await prisma.label.create({
        data: { name: label.name, color: label.color },
      });
      ids.set(row.name, row.id);
      created += 1;
      continue;
    }
    ids.set(existing.name, existing.id);
  }

  return { created, ids };
}

/** The labels to connect to a seeded task, skipping any that is not seeded. */
function labelConnections(
  names: readonly string[],
  ids: ReadonlyMap<string, string>,
): { id: string }[] {
  const connections: { id: string }[] = [];
  for (const name of names) {
    const id = ids.get(name);
    if (id !== undefined) {
      connections.push({ id });
    }
  }
  return connections;
}

/** Creates any missing seeded task, each with its own priority and labels. */
async function seedTasks(
  memberIds: ReadonlyMap<string, string>,
  labelIds: ReadonlyMap<string, string>,
): Promise<number> {
  let created = 0;

  for (const task of SEED_TASKS) {
    const existing = await prisma.task.findFirst({ where: { title: task.title } });
    if (existing !== null) {
      continue;
    }
    const assigneeId =
      task.assigneeName === null ? null : (memberIds.get(task.assigneeName) ?? null);
    await prisma.task.create({
      data: {
        title: task.title,
        description: task.description,
        assigneeId,
        dueDate: parseDueDate(task.dueDate),
        status: task.status,
        priority: task.priority,
        labels: { connect: labelConnections(task.labelNames, labelIds) },
      },
    });
    created += 1;
  }

  return created;
}

async function main(): Promise<void> {
  try {
    const members = await seedMembers();
    const labels = await seedLabels();
    const tasks = await seedTasks(members.ids, labels.ids);
    process.stdout.write(
      `Seed complete: ${String(members.created)} team member(s), ${String(labels.created)} label(s) and ${String(tasks)} task(s) added.\n`,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Seed failed: ${message}\n`);
    process.exitCode = 1;
  } finally {
    await disconnect();
  }
}

await main();
