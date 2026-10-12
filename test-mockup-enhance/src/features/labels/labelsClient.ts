/**
 * The browser client for the two label endpoints:
 *
 *   GET  /api/labels   the labels that already exist
 *   POST /api/labels   create a label { name, color }
 *
 * Same-origin `/api` only, like every other read and write in this app, and it
 * reports a failure with the shared `ApiError` so the screens can show the
 * server's own message (a duplicate name, a validation problem) inline.
 */

import { ApiError } from "../../lib/api/index.js";
import { DEFAULT_LABEL_COLOR, isLabelColor, type Label, type NewLabel } from "./labels.js";

/** The one address the label endpoints live at. */
export const LABELS_ENDPOINT = "/api/labels";

/** Exactly the calls the label UI makes. */
export interface LabelApi {
  listLabels(): Promise<Label[]>;
  createLabel(input: NewLabel): Promise<Label>;
}

/** The shape of `fetch` this client needs; a test may pass its own. */
export type LabelFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The body of a response, as JSON when it is JSON and null otherwise. */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** The server's own words for a failure, when it gave any. */
function messageOf(payload: unknown, fallback: string): string {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return fallback;
  }
  const record: Record<string, unknown> = { ...payload };
  const message: unknown = record.message ?? record.error;
  if (typeof message === "string" && message.trim() !== "") {
    return message;
  }
  return fallback;
}

/** One label out of an untrusted payload, or null when it is not one. */
function parseLabel(value: unknown): Label | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record: Record<string, unknown> = { ...value };
  const id: unknown = record.id;
  const name: unknown = record.name;
  const color: unknown = record.color ?? record.colour;
  if (typeof id !== "string" || id === "" || typeof name !== "string") {
    return null;
  }
  return { id, name, color: isLabelColor(color) ? color : DEFAULT_LABEL_COLOR };
}

/** Sends one request and returns its body, raising an `ApiError` on failure. */
async function send(
  doFetch: LabelFetch,
  init: RequestInit,
  fallback: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await doFetch(LABELS_ENDPOINT, init);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ApiError(0, `The server could not be reached (${reason}).`);
  }
  const payload = await readJson(response);
  if (!response.ok) {
    throw new ApiError(response.status, messageOf(payload, fallback));
  }
  return payload;
}

/** Builds a label client. `fetchImpl` defaults to the browser's own `fetch`. */
export function createLabelApi(fetchImpl?: LabelFetch): LabelApi {
  const doFetch: LabelFetch = (input: string, init?: RequestInit): Promise<Response> =>
    fetchImpl === undefined ? fetch(input, init) : fetchImpl(input, init);

  return {
    async listLabels(): Promise<Label[]> {
      const payload = await send(
        doFetch,
        { method: "GET", headers: { accept: "application/json" } },
        "The labels could not be loaded.",
      );
      if (!Array.isArray(payload)) {
        return [];
      }
      const entries: unknown[] = payload;
      const labels: Label[] = [];
      for (const entry of entries) {
        const parsed = parseLabel(entry);
        if (parsed !== null) {
          labels.push(parsed);
        }
      }
      return labels;
    },

    async createLabel(input: NewLabel): Promise<Label> {
      const payload = await send(
        doFetch,
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ name: input.name, color: input.color }),
        },
        "The label could not be created.",
      );
      const created = parseLabel(payload);
      if (created === null) {
        throw new ApiError(500, "The label was created but the server did not return it.");
      }
      return created;
    },
  };
}

/** The shared same-origin label client the screens use. */
export const labelApi: LabelApi = createLabelApi();
