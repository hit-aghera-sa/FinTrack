/**
 * Presentation-only status accents for the board's To do / Doing / Done lanes.
 *
 * This module deliberately does NOT declare the application's status domain
 * type (that belongs to the data-model lane). It accepts whatever string a
 * record carries and resolves it to a visual tone, a human label and a shape
 * glyph, so state is never communicated by colour alone.
 */

export type StatusTone = "todo" | "doing" | "done" | "neutral";

export interface StatusAccent {
  /** The resolved visual tone. */
  readonly tone: StatusTone;
  /** Human-readable label, e.g. "To do". */
  readonly label: string;
  /** A decorative shape that repeats the state without relying on colour. */
  readonly symbol: string;
  /** The CSS class that carries the tone's surface / ink / border tokens. */
  readonly className: string;
}

export const STATUS_TONES: readonly StatusTone[] = ["todo", "doing", "done", "neutral"];

export const STATUS_TONE_LABELS: Record<StatusTone, string> = {
  todo: "To do",
  doing: "Doing",
  done: "Done",
  neutral: "Unknown",
};

const STATUS_TONE_SYMBOLS: Record<StatusTone, string> = {
  todo: "\u25CB",
  doing: "\u25D0",
  done: "\u25CF",
  neutral: "\u2022",
};

function normalise(status: string): string {
  return status.toLowerCase().replace(/[^a-z]/g, "");
}

/** Resolve any status string to a visual tone; unknown values map to "neutral". */
export function resolveStatusTone(status: string): StatusTone {
  switch (normalise(status)) {
    case "todo":
    case "backlog":
    case "open":
    case "new":
      return "todo";
    case "doing":
    case "inprogress":
    case "progress":
    case "active":
      return "doing";
    case "done":
    case "complete":
    case "completed":
    case "closed":
      return "done";
    default:
      return "neutral";
  }
}

/** The label to print for a status; unknown values are printed as supplied. */
export function statusLabel(status: string): string {
  const tone = resolveStatusTone(status);
  return tone === "neutral" ? status : STATUS_TONE_LABELS[tone];
}

/** The CSS class carrying a tone's tokens, e.g. "ui-status--doing". */
export function statusToneClassName(tone: StatusTone): string {
  return `ui-status--${tone}`;
}

/** Everything a screen needs to render a status without inventing a colour. */
export function statusAccent(status: string): StatusAccent {
  const tone = resolveStatusTone(status);
  return {
    tone,
    label: statusLabel(status),
    symbol: STATUS_TONE_SYMBOLS[tone],
    className: statusToneClassName(tone),
  };
}
