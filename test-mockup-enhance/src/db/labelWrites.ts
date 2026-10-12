/**
 * The nested writes that attach labels to a task.
 *
 * A CREATE connects the labels the new task starts with; an UPDATE replaces
 * the task's whole label set, so a label left out of the new set is
 * disconnected and one that is new is connected, in a single write. Both are
 * pure functions of the supplied ids, which is what makes them unit testable
 * on their own.
 */

/** A reference to one stored label. */
export interface LabelIdRef {
  id: string;
}

/** Connects labels to a task being created. */
export interface LabelConnectWrite {
  connect: LabelIdRef[];
}

/** Replaces a task's whole label set. */
export interface LabelReplaceWrite {
  set: LabelIdRef[];
}

/** The ids as label references: trimmed, blanks dropped, each one kept once. */
export function labelIdRefs(labelIds: readonly string[]): LabelIdRef[] {
  const seen = new Set<string>();
  const refs: LabelIdRef[] = [];
  for (const candidate of labelIds) {
    const id = candidate.trim();
    if (id === "" || seen.has(id)) {
      continue;
    }
    seen.add(id);
    refs.push({ id });
  }
  return refs;
}

/**
 * The labels a new task starts with, or `undefined` when none were supplied —
 * a task created without labels simply has no label write.
 */
export function labelConnectWrite(
  labelIds: readonly string[] | undefined,
): LabelConnectWrite | undefined {
  if (labelIds === undefined) {
    return undefined;
  }
  const refs = labelIdRefs(labelIds);
  return refs.length === 0 ? undefined : { connect: refs };
}

/**
 * The task's new label set, replacing whatever it carried before. An empty
 * list clears every label.
 */
export function labelReplaceWrite(labelIds: readonly string[]): LabelReplaceWrite {
  return { set: labelIdRefs(labelIds) };
}
