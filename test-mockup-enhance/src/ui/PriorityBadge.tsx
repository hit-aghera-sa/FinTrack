import {
  priorityBadgeClass,
  priorityLabel,
  prioritySlug,
  type PriorityLevel,
} from "./priority.js";
import "./priority.css";

export interface PriorityBadgeProps {
  /** The level to show — a stored task's `priority`. */
  readonly priority: PriorityLevel;
  /**
   * Optional prefix rendered before the level, e.g. `label="Priority"` gives
   * "Priority: High". Omit it for the compact label used on a board card.
   */
  readonly label?: string;
}

/**
 * A compact coloured label for a task's priority.
 *
 * Purely presentational: value in, nothing out. The colours come only from the
 * priority tokens in `./priority.css`, and the level is ALWAYS spelled out in
 * words beside a per-level shape, so the meaning never rests on colour alone.
 */
export function PriorityBadge({ priority, label }: PriorityBadgeProps): JSX.Element {
  const name = priorityLabel(priority);
  const text = label === undefined ? name : `${label}: ${name}`;
  return (
    <span
      className={priorityBadgeClass(priority)}
      data-priority={prioritySlug(priority)}
      title={`Priority: ${name}`}
    >
      <span className="ui-priority-badge__mark" aria-hidden="true" />
      <span className="ui-priority-badge__text">{text}</span>
    </span>
  );
}

export default PriorityBadge;
