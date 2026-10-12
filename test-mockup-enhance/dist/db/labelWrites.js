/**
 * The nested writes that attach labels to a task.
 *
 * A CREATE connects the labels the new task starts with; an UPDATE replaces
 * the task's whole label set, so a label left out of the new set is
 * disconnected and one that is new is connected, in a single write. Both are
 * pure functions of the supplied ids, which is what makes them unit testable
 * on their own.
 */
/** The ids as label references: trimmed, blanks dropped, each one kept once. */
export function labelIdRefs(labelIds) {
    const seen = new Set();
    const refs = [];
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
export function labelConnectWrite(labelIds) {
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
export function labelReplaceWrite(labelIds) {
    return { set: labelIdRefs(labelIds) };
}
