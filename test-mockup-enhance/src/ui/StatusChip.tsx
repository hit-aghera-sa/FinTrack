import { statusAccent } from "./status.js";
import "./tokens.css";
import "./StatusChip.css";

export interface StatusChipProps {
  /** The status as stored on the record, e.g. "To do", "DOING", "done". */
  readonly status: string;
  readonly className?: string;
}

/** A compact status pill: shape glyph + label + the tone's accent tokens. */
export function StatusChip({ status, className }: StatusChipProps): JSX.Element {
  const accent = statusAccent(status);
  const classes = ["ui-status-chip", accent.className, className]
    .filter((value: string | undefined) => typeof value === "string" && value.length > 0)
    .join(" ");

  return (
    <span className={classes}>
      <span className="ui-status-chip__symbol" aria-hidden="true">
        {accent.symbol}
      </span>
      <span className="ui-status-chip__label">{accent.label}</span>
    </span>
  );
}
