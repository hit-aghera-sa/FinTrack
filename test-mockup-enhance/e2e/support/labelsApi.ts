// e2e/support/labelsApi.ts
//
// The LABEL endpoints of the app's own HTTP API, as the acceptance suite drives them. The payload
// shapes below are a COPY of the shared models on purpose: a spec — and every helper it loads —
// must never import from src/, because Playwright loads these files with its own transform.
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

/** A label exactly as the API serialises it. */
export interface LabelPayload {
  id: string;
  name: string;
  color?: string;
}

/** A task as the API serialises it, carrying the labels attached to it. */
export interface LabelledTaskPayload {
  id: string;
  title: string;
  status: string;
  labels?: LabelPayload[];
}

/** What a create sends for a task that starts with labels attached. */
export interface NewLabelledTaskInput {
  title: string;
  status?: string;
  labelIds?: string[];
}

/** The colour token every fixture label is created with — a token name, never a colour value. */
export const FIXTURE_LABEL_COLOR = 'info';

/** Reads a list body that is either a bare array or an envelope carrying one. */
function readLabelList(body: unknown): LabelPayload[] {
  if (Array.isArray(body)) {
    return body as LabelPayload[];
  }
  if (typeof body === 'object' && body !== null) {
    const held: unknown = (body as { labels?: unknown }).labels;
    if (Array.isArray(held)) {
      return held as LabelPayload[];
    }
  }
  return [];
}

/** Every label the board knows about. */
export async function listLabels(request: APIRequestContext): Promise<LabelPayload[]> {
  const response = await request.get('/api/labels');
  expect(response.status(), 'GET /api/labels must answer 200').toBe(200);
  return readLabelList(await response.json());
}

/** The names of every label the board knows about. */
export async function labelNames(request: APIRequestContext): Promise<string[]> {
  const labels = await listLabels(request);
  return labels.map((label: LabelPayload): string => label.name);
}

/**
 * POSTs a label WITHOUT asserting anything about the answer — for the specs about a refusal, which
 * need the raw status and body.
 */
export function postLabel(
  request: APIRequestContext,
  data: Record<string, unknown>,
): Promise<APIResponse> {
  return request.post('/api/labels', { data });
}

/** Creates a label, failing the spec when the API refuses it. */
export async function createLabel(
  request: APIRequestContext,
  name: string,
  color: string = FIXTURE_LABEL_COLOR,
): Promise<LabelPayload> {
  const response = await postLabel(request, { name, color });
  expect([200, 201], 'POST /api/labels must create the label').toContain(response.status());
  return (await response.json()) as LabelPayload;
}

/** Creates a task, optionally with labels already attached. */
export async function createLabelledTask(
  request: APIRequestContext,
  input: NewLabelledTaskInput,
): Promise<LabelledTaskPayload> {
  const response = await request.post('/api/tasks', { data: input });
  expect([200, 201], 'POST /api/tasks must create the task').toContain(response.status());
  return (await response.json()) as LabelledTaskPayload;
}

/** One task, with the labels the API says it carries. */
export async function getLabelledTask(
  request: APIRequestContext,
  taskId: string,
): Promise<LabelledTaskPayload> {
  const response = await request.get(`/api/tasks/${taskId}`);
  expect(response.status(), 'GET /api/tasks/:id must answer 200 for a real task').toBe(200);
  return (await response.json()) as LabelledTaskPayload;
}

/** The task on the board with this exact title, or null when there is none. */
export async function findTaskByTitle(
  request: APIRequestContext,
  title: string,
): Promise<LabelledTaskPayload | null> {
  const response = await request.get('/api/tasks');
  expect(response.status(), 'GET /api/tasks must answer 200').toBe(200);
  const tasks = (await response.json()) as LabelledTaskPayload[];
  const found = tasks.find((task: LabelledTaskPayload): boolean => task.title === title);
  return found === undefined ? null : found;
}

/** The names of the labels attached to one task. */
export async function labelNamesOfTask(
  request: APIRequestContext,
  taskId: string,
): Promise<string[]> {
  const task = await getLabelledTask(request, taskId);
  return (task.labels ?? []).map((label: LabelPayload): string => label.name);
}
