/**
 * THE ACTIVITY TIMELINE'S OWN VIEW OF A TASK ACTIVITY ENTRY.
 *
 * The activity HTTP endpoint belongs to another lane; this module is the shape
 * this screen reads its payload into, together with the pure presentation
 * helpers the timeline uses: the label and icon for each kind, the
 * `from -> to` change summary, the actor's name and a relative timestamp.
 *
 * THE BACKEND SPELLS ITS KINDS ITS OWN WAY (`task_created`, `field_changed`,
 * `labels_changed`, …). Those names are NORMALISED here — through an alias
 * table, and for an entry that only names the field it changed, through that
 * field — so a recorded creation reads as "Task created" rather than falling
 * through to the neutral "Task updated". An entry that carries the backend's
 * own sentence in `message` is shown with that sentence.
 *
 * Everything here is pure and has no React or DOM dependency, so it is unit
 * tested directly beside this file.
 */

/** The address of one task's activity screen, as the page list registers it. */
export const TASK_ACTIVITY_ROUTE = '/tasks/:id/activity';

/** The address of one task's activity screen. */
export function taskActivityRoutePath(taskId: string): string {
  return `/tasks/${encodeURIComponent(taskId)}/activity`;
}

/** The kinds of activity the board records, in the order they are documented. */
export const TASK_ACTIVITY_KINDS = [
  'created',
  'title_changed',
  'description_changed',
  'status_changed',
  'priority_changed',
  'assignee_changed',
  'due_date_changed',
  'labels_changed',
  'comment_added',
] as const;

export type TaskActivityKind = (typeof TASK_ACTIVITY_KINDS)[number];

/**
 * One entry of a task's activity, as the timeline renders it.
 *
 * `kind` is spelled as a plain string on purpose: an entry whose kind this
 * screen does not know yet is still shown, with a neutral label, rather than
 * silently dropped.
 */
export interface TaskActivity {
  id: string;
  taskId: string;
  kind: string;
  /** The field that changed, when the backend named one. */
  field: string | null;
  /** The value before the change, already formatted for display. */
  from: string | null;
  /** The value after the change, already formatted for display. */
  to: string | null;
  /** Who did it. Empty when the backend recorded nobody. */
  actor: string;
  /**
   * The sentence the backend recorded for this entry, when it sent one. It is
   * already written for a reader, so the timeline shows it as the change.
   */
  message?: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** What the timeline calls each kind of entry. */
export const TASK_ACTIVITY_LABELS: Record<TaskActivityKind, string> = {
  created: 'Task created',
  title_changed: 'Title changed',
  description_changed: 'Description changed',
  status_changed: 'Status changed',
  priority_changed: 'Priority changed',
  assignee_changed: 'Assignee changed',
  due_date_changed: 'Due date changed',
  labels_changed: 'Labels changed',
  comment_added: 'Comment added',
};

/**
 * The decorative mark beside each kind. Rendered `aria-hidden`, always beside
 * the written label — the icon never carries the meaning on its own.
 */
export const TASK_ACTIVITY_ICONS: Record<TaskActivityKind, string> = {
  created: '\u271a',
  title_changed: '\u270e',
  description_changed: '\u2261',
  status_changed: '\u21c4',
  priority_changed: '\u25b2',
  assignee_changed: '\u25cf',
  due_date_changed: '\u25f7',
  labels_changed: '\u25c6',
  comment_added: '\u275d',
};

/** The field name shown in the change summary for each kind. */
const KIND_FIELD_LABELS: Record<TaskActivityKind, string> = {
  created: 'Task',
  title_changed: 'Title',
  description_changed: 'Description',
  status_changed: 'Status',
  priority_changed: 'Priority',
  assignee_changed: 'Assignee',
  due_date_changed: 'Due date',
  labels_changed: 'Labels',
  comment_added: 'Comment',
};

/**
 * The other spellings the same thing is recorded under. The backend's activity
 * payload uses these, so they must read as the kinds above rather than as an
 * unrecognised entry.
 */
const KIND_ALIASES: Readonly<Partial<Record<string, TaskActivityKind>>> = {
  task_created: 'created',
  created_task: 'created',
  task_added: 'created',
  create: 'created',
  title_updated: 'title_changed',
  description_updated: 'description_changed',
  status_moved: 'status_changed',
  status_updated: 'status_changed',
  priority_updated: 'priority_changed',
  assignee_updated: 'assignee_changed',
  assigned: 'assignee_changed',
  due_date_updated: 'due_date_changed',
  label_changed: 'labels_changed',
  labels_updated: 'labels_changed',
  commented: 'comment_added',
  comment: 'comment_added',
  comment_created: 'comment_added',
};

/**
 * The kind an entry that only names a field belongs to — the backend records a
 * title, description or due-date edit as `field_changed` plus the field.
 */
const FIELD_KINDS: Readonly<Partial<Record<string, TaskActivityKind>>> = {
  title: 'title_changed',
  description: 'description_changed',
  status: 'status_changed',
  priority: 'priority_changed',
  assignee: 'assignee_changed',
  assigneeid: 'assignee_changed',
  duedate: 'due_date_changed',
  labels: 'labels_changed',
  label: 'labels_changed',
  comment: 'comment_added',
};

/** The label an entry of an unrecognised kind is given. */
export const UNKNOWN_ACTIVITY_LABEL = 'Task updated';

/** The mark an entry of an unrecognised kind is given. */
export const UNKNOWN_ACTIVITY_ICON = '\u2022';

/** Stands in for a value that was, or became, empty. */
export const NOT_SET_TEXT = 'Not set';

/** The character between the old and the new value of a change. */
export const CHANGE_ARROW = '\u2192';

/** Shown instead of a name when the backend recorded no actor. */
export const UNKNOWN_ACTOR_TEXT = 'Someone';

/** Narrowing guard for an untrusted kind. */
export function isTaskActivityKind(value: unknown): value is TaskActivityKind {
  return (
    typeof value === 'string' &&
    TASK_ACTIVITY_KINDS.some((kind: TaskActivityKind): boolean => kind === value)
  );
}

/** A field name reduced to a comparable key: "due_date" and "dueDate" are one field. */
function fieldKey(field: string | null): string {
  return (field ?? '').replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

/** The kind a recorded name stands for, or null when this screen knows none. */
export function normaliseActivityKind(kind: string): TaskActivityKind | null {
  if (isTaskActivityKind(kind)) {
    return kind;
  }
  return KIND_ALIASES[kind.trim().toLowerCase()] ?? null;
}

/**
 * The kind of one entry: its own name when that is known, otherwise the kind
 * the field it names belongs to.
 */
export function activityEntryKind(entry: TaskActivity): TaskActivityKind | null {
  const direct = normaliseActivityKind(entry.kind);
  if (direct !== null) {
    return direct;
  }
  return FIELD_KINDS[fieldKey(entry.field)] ?? null;
}

/** The written label for a kind, with a neutral fallback. */
export function activityKindLabel(kind: string): string {
  const resolved = normaliseActivityKind(kind);
  return resolved === null ? UNKNOWN_ACTIVITY_LABEL : TASK_ACTIVITY_LABELS[resolved];
}

/** The decorative mark for a kind, with a neutral fallback. */
export function activityKindIcon(kind: string): string {
  const resolved = normaliseActivityKind(kind);
  return resolved === null ? UNKNOWN_ACTIVITY_ICON : TASK_ACTIVITY_ICONS[resolved];
}

/** The written label for one entry, resolving its field when the kind is new. */
export function activityEntryLabel(entry: TaskActivity): string {
  const kind = activityEntryKind(entry);
  return kind === null ? UNKNOWN_ACTIVITY_LABEL : TASK_ACTIVITY_LABELS[kind];
}

/** The decorative mark for one entry, resolving its field when the kind is new. */
export function activityEntryIcon(entry: TaskActivity): string {
  const kind = activityEntryKind(entry);
  return kind === null ? UNKNOWN_ACTIVITY_ICON : TASK_ACTIVITY_ICONS[kind];
}

/** "status" -> "Status", "due_date" -> "Due date". */
function humanise(value: string): string {
  const words = value.replace(/[_-]+/g, ' ').trim();
  return words === '' ? '' : words.charAt(0).toUpperCase() + words.slice(1);
}

/** The field name an entry's change summary opens with. */
export function activityFieldLabel(entry: TaskActivity): string {
  const kind = activityEntryKind(entry);
  if (kind !== null) {
    return KIND_FIELD_LABELS[kind];
  }
  const named = humanise(entry.field ?? '');
  return named === '' ? 'Change' : named;
}

/**
 * The change this entry records, as one line.
 *
 * The backend's own sentence wins when it sent one ("Created the task …",
 * "Status moved from To do to Doing."). Otherwise the values are read as
 * `Status: To do \u2192 Doing`; a comment carries its text in `to` alone, so it
 * is shown as written rather than as a change from nothing, and an entry with
 * neither value (a bare "task created") has no summary at all.
 */
export function changeSummary(entry: TaskActivity): string | null {
  const message = (entry.message ?? '').trim();
  if (message !== '') {
    return message;
  }
  if (entry.from === null && entry.to === null) {
    return null;
  }
  const kind = activityEntryKind(entry);
  if (entry.from === null && kind === 'comment_added') {
    return entry.to;
  }
  const label = activityFieldLabel(entry);
  const from = entry.from ?? NOT_SET_TEXT;
  const to = entry.to ?? NOT_SET_TEXT;
  return `${label}: ${from} ${CHANGE_ARROW} ${to}`;
}

/** Who did it, with a fallback for an entry the backend left unattributed. */
export function activityActorName(entry: TaskActivity): string {
  return entry.actor.trim() === '' ? UNKNOWN_ACTOR_TEXT : entry.actor;
}

function ago(count: number, unit: string): string {
  return `${String(count)} ${unit}${count === 1 ? '' : 's'} ago`;
}

/**
 * A readable, relative stamp: "just now", "5 minutes ago", "3 days ago".
 * An unparseable value is returned as it was given, never as "Invalid Date".
 */
export function relativeTime(value: string, now: number = Date.now()): string {
  const at = Date.parse(value);
  if (Number.isNaN(at)) {
    return value;
  }
  const seconds = Math.floor((now - at) / 1000);
  if (seconds < 45) {
    return 'just now';
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return ago(Math.max(minutes, 1), 'minute');
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return ago(hours, 'hour');
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return ago(days, 'day');
  }
  if (days < 30) {
    return ago(Math.floor(days / 7), 'week');
  }
  if (days < 365) {
    return ago(Math.floor(days / 30), 'month');
  }
  return ago(Math.floor(days / 365), 'year');
}

/** The full stamp, for the title of a relative timestamp. */
export function absoluteTime(value: string): string {
  const at = Date.parse(value);
  return Number.isNaN(at) ? value : new Date(at).toLocaleString();
}

function timeOf(entry: TaskActivity): number {
  const at = Date.parse(entry.createdAt);
  return Number.isNaN(at) ? 0 : at;
}

/**
 * Newest first. The API already answers in this order; sorting here means the
 * timeline is reverse-chronological whatever order it is handed.
 */
export function sortNewestFirst(entries: readonly TaskActivity[]): TaskActivity[] {
  return [...entries].sort((left: TaskActivity, right: TaskActivity): number => timeOf(right) - timeOf(left));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/** The first of these keys holding a non-empty string (or a finite number). */
function readText(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value: unknown = record[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

/**
 * One entry read out of the API payload, or null when it carries no id and so
 * cannot be rendered or keyed. Alternative spellings are accepted so a small
 * change of wording on the server never blanks the screen.
 */
export function decodeTaskActivity(value: unknown): TaskActivity | null {
  const record = asRecord(value);
  if (record === null) {
    return null;
  }
  const id = readText(record, ['id', 'activityId']);
  if (id === null) {
    return null;
  }
  const entry: TaskActivity = {
    id,
    taskId: readText(record, ['taskId', 'task_id']) ?? '',
    kind: readText(record, ['kind', 'type', 'action']) ?? '',
    field: readText(record, ['field', 'fieldName', 'field_name']),
    from: readText(record, ['from', 'fromValue', 'from_value', 'previousValue', 'oldValue']),
    to: readText(record, ['to', 'toValue', 'to_value', 'newValue', 'value']),
    actor: readText(record, ['actor', 'actorName', 'actor_name', 'author', 'memberName', 'by']) ?? '',
    createdAt: readText(record, ['createdAt', 'created_at', 'at', 'timestamp']) ?? '',
  };
  // The sentence the backend wrote, when it wrote one. Left off entirely
  // otherwise, so an entry that carries none is unchanged by this.
  const message = readText(record, ['message', 'summary', 'text']);
  if (message !== null) {
    entry.message = message;
  }
  return entry;
}

/** The list inside a payload: a bare array, or an envelope carrying one. */
function readList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  const record = asRecord(value);
  if (record === null) {
    return [];
  }
  for (const key of ['activity', 'activities', 'entries', 'items', 'data']) {
    const held: unknown = record[key];
    if (Array.isArray(held)) {
      return held;
    }
  }
  return [];
}

/** Every readable entry of a payload; anything malformed is skipped. */
export function decodeTaskActivityList(value: unknown): TaskActivity[] {
  const decoded: TaskActivity[] = [];
  for (const item of readList(value)) {
    const entry = decodeTaskActivity(item);
    if (entry !== null) {
      decoded.push(entry);
    }
  }
  return decoded;
}
