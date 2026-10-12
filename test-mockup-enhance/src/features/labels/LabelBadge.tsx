/**
 * THE LABEL CHIP — a label's name drawn in its own colour token class, with an
 * optional remove action. Shared by every screen that shows labels; it holds no
 * state and makes no request of its own.
 */

import { labelColorClass, labelColorName, type Label } from "./labels.js";
import "./LabelBadge.css";

export interface LabelBadgeProps {
  /** The label to draw. */
  readonly label: Label;
  /**
   * When given, the chip carries a remove action that raises this. Omit it for a
   * chip that is only being displayed.
   */
  readonly onRemove?: () => void;
  /** Extra classes for the chip. */
  readonly className?: string;
}

export function LabelBadge({ label, onRemove, className }: LabelBadgeProps): JSX.Element {
  const classes = ["label-chip", labelColorClass(label.color), className]
    .filter((value: string | undefined): boolean => typeof value === "string" && value !== "")
    .join(" ");

  return (
    <span className={classes} data-label-color={label.color} title={labelColorName(label.color)}>
      <span className="label-chip-name">{label.name}</span>
      {onRemove !== undefined ? (
        <button
          type="button"
          className="label-chip-remove"
          aria-label={`Remove ${label.name}`}
          onClick={onRemove}
        >
          {/* The multiplication sign, as a string expression so the glyph itself
              is rendered rather than the text of its escape. */}
          <span aria-hidden="true">{"\u00d7"}</span>
        </button>
      ) : null}
    </span>
  );
}
