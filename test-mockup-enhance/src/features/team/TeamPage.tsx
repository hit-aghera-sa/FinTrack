import { api } from "../../lib/api/client.js";
import { TeamRoster } from "./TeamRoster.js";

/** The route container's props, exactly as the approved contract declares them. */
export interface TeamPageProps {
  /** Optional "back to board" action the shell may pass in. */
  onBack?: () => void;
}

/**
 * The screen behind `/team`: binds the real same-origin API client to the
 * roster view, so every read and write hits the backend over `/api`.
 */
export function TeamPage({ onBack }: TeamPageProps): JSX.Element {
  return <TeamRoster api={api} onBack={onBack} />;
}

export default TeamPage;
