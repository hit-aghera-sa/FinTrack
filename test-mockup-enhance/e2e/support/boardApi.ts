// e2e/support/boardApi.ts
//
// The app's own HTTP API, as the acceptance suite drives it. The domain shapes below are a COPY
// of the shared models on purpose: a spec (and every helper it loads) must never import from src/.
import { expect, type APIRequestContext } from '@playwright/test';

/** The three board columns, in order. */
export const TASK_STATUSES = ['todo', 'doing', 'done'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

/** The column headings the board shows for each status. */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
};

/** The three priority levels, least to most urgent. */
export const TASK_PRIORITIES = ['Low', 'Medium', 'High'] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** The level a task carries when none was chosen. */
export const DEFAULT_TASK_PRIORITY: TaskPriority = 'Medium';

/** The CSS slug the priority badge carries for each level. */
export const TASK_PRIORITY_SLUGS: Record<TaskPriority, string> = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
};

export interface TaskPayload {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
}

export interface MemberPayload {
  id: string;
  name: string;
  role: string;
  openTaskCount?: number;
}

export interface CommentPayload {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
}

export interface NewTaskInput {
  title: string;
  description?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export interface TaskPatchInput {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export interface NewMemberInput {
  name: string;
  role: string;
}

/** One member's workload, exactly as `GET /api/reports` serialises it. */
export interface MemberReportPayload {
  memberId: string;
  memberName: string;
  role: string;
  todo: number;
  doing: number;
  done: number;
  overdue: number;
  total: number;
}

/** The whole member-workload report. */
export interface WorkloadReportPayload {
  generatedAt: string;
  members: MemberReportPayload[];
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * A readable, unique fixture label — "Alex QA run-bqtz".
 *
 * Never a bare number: every value a spec types persists and is rendered during the capture, where
 * a bare-number string is indistinguishable from a leaked database id.
 */
export function uniqueLabel(base: string): string {
  let suffix = '';
  for (let index = 0; index < 4; index += 1) {
    suffix += LETTERS.charAt(Math.floor(Math.random() * LETTERS.length));
  }
  return `${base} run-${suffix}`;
}

/** Escapes a fixture label for use inside a regular expression. */
export function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A calendar day `offsetDays` from today, in the `YYYY-MM-DD` form the app stores — computed in UTC,
 * which is how the server decides what "before today" means.
 *
 *   isoDay(-6) -> a day safely in the past, isoDay(0) -> today, isoDay(21) -> the future.
 */
export function isoDay(offsetDays: number): string {
  const now = new Date();
  const shifted = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays),
  );
  return shifted.toISOString().slice(0, 10);
}

export async function listTasks(request: APIRequestContext): Promise<TaskPayload[]> {
  const response = await request.get('/api/tasks');
  expect(response.status(), 'GET /api/tasks must answer 200').toBe(200);
  return (await response.json()) as TaskPayload[];
}

export async function getTask(request: APIRequestContext, id: string): Promise<TaskPayload> {
  const response = await request.get(`/api/tasks/${id}`);
  expect(response.status(), 'GET /api/tasks/:id must answer 200 for a real task').toBe(200);
  return (await response.json()) as TaskPayload;
}

export async function createTask(request: APIRequestContext, input: NewTaskInput): Promise<TaskPayload> {
  const response = await request.post('/api/tasks', { data: input });
  expect([200, 201], 'POST /api/tasks must create the task').toContain(response.status());
  return (await response.json()) as TaskPayload;
}

export async function patchTask(
  request: APIRequestContext,
  id: string,
  patch: TaskPatchInput,
): Promise<TaskPayload> {
  const response = await request.patch(`/api/tasks/${id}`, { data: patch });
  expect(response.status(), 'PATCH /api/tasks/:id must answer 200').toBe(200);
  return (await response.json()) as TaskPayload;
}

export async function listComments(request: APIRequestContext, taskId: string): Promise<CommentPayload[]> {
  const response = await request.get(`/api/tasks/${taskId}/comments`);
  expect(response.status(), 'GET /api/tasks/:taskId/comments must answer 200').toBe(200);
  return (await response.json()) as CommentPayload[];
}

export async function addComment(
  request: APIRequestContext,
  taskId: string,
  body: string,
): Promise<CommentPayload> {
  const response = await request.post(`/api/tasks/${taskId}/comments`, { data: { body } });
  expect([200, 201], 'POST /api/tasks/:taskId/comments must create the comment').toContain(response.status());
  return (await response.json()) as CommentPayload;
}

export async function listMembers(request: APIRequestContext): Promise<MemberPayload[]> {
  const response = await request.get('/api/members');
  expect(response.status(), 'GET /api/members must answer 200').toBe(200);
  return (await response.json()) as MemberPayload[];
}

export async function createMember(
  request: APIRequestContext,
  input: NewMemberInput,
): Promise<MemberPayload> {
  const response = await request.post('/api/members', { data: input });
  expect([200, 201], 'POST /api/members must create the member').toContain(response.status());
  return (await response.json()) as MemberPayload;
}

export async function removeMember(request: APIRequestContext, id: string): Promise<void> {
  const response = await request.delete(`/api/members/${id}`);
  expect([200, 204], 'DELETE /api/members/:id must remove the member').toContain(response.status());
}

/** The open-task count the roster API reports for one member. */
export async function openTaskCount(request: APIRequestContext, memberId: string): Promise<number> {
  const members = await listMembers(request);
  const member = members.find((row: MemberPayload): boolean => row.id === memberId);
  expect(member, 'the member must be on the roster').toBeDefined();
  return member?.openTaskCount ?? -1;
}

/** The server-computed member-workload report. */
export async function fetchReport(request: APIRequestContext): Promise<WorkloadReportPayload> {
  const response = await request.get('/api/reports');
  expect(response.status(), 'GET /api/reports must answer 200').toBe(200);
  return (await response.json()) as WorkloadReportPayload;
}

/** The report row for one member. Every team member must have one. */
export async function memberReport(
  request: APIRequestContext,
  memberId: string,
): Promise<MemberReportPayload> {
  const report = await fetchReport(request);
  const row = report.members.find((entry: MemberReportPayload): boolean => entry.memberId === memberId);
  expect(row, 'every team member must appear in the workload report').toBeDefined();
  if (row === undefined) {
    throw new Error(`The workload report has no row for member ${memberId}.`);
  }
  return row;
}
