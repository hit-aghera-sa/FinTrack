import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from "react";

import { Button } from "../../components/Button.js";
import { Card } from "../../components/Card.js";
import { DataTable, type DataTableColumn } from "../../components/DataTable.js";
import { TextField } from "../../components/Field.js";
import { ErrorBanner } from "../../ui/ErrorBanner.js";
import type { BoardApi } from "../../lib/api/client.js";
import type { TeamMemberWithWorkload } from "../../models/member.js";

/**
 * The behavioural team-roster screen.
 *
 * The API client is a prop so the unit tests can supply a stub; the route
 * container (`TeamPage`) binds the real same-origin client. Every read and
 * write goes over `/api` through that client — there is no local store, so the
 * roster and the open-task counts always come from the backend.
 */
export interface TeamRosterProps {
  /** The typed board API client. */
  api: BoardApi;
  /** Optional "back to board" action, rendered beside the heading when given. */
  onBack?: () => void;
}

/** How the roster read is going. The heading and the add form render in all three. */
type LoadState = "loading" | "ready" | "error";

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
}

export function TeamRoster({ api, onBack }: TeamRosterProps): ReactElement {
  const [members, setMembers] = useState<readonly TeamMemberWithWorkload[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string>("");

  const [name, setName] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [nameError, setNameError] = useState<string>("");
  const [roleError, setRoleError] = useState<string>("");
  const [actionError, setActionError] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  /** Re-reads the roster, so the open-task counts reflect the current board. */
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const roster = await api.listMembers();
      setMembers(roster);
      setLoadError("");
      setState("ready");
    } catch (error: unknown) {
      setLoadError(messageOf(error, "The team roster could not be loaded."));
      setState("error");
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    setNameError(trimmedName === "" ? "Enter the member's name." : "");
    setRoleError(trimmedRole === "" ? "Enter their role." : "");
    if (trimmedName === "" || trimmedRole === "") {
      return;
    }

    setSaving(true);
    setActionError("");
    void api
      .addMember({ name: trimmedName, role: trimmedRole })
      .then(async (): Promise<void> => {
        setName("");
        setRole("");
        await refresh();
      })
      .catch((error: unknown): void => {
        setActionError(messageOf(error, "That member could not be added."));
      })
      .finally((): void => {
        setSaving(false);
      });
  };

  const handleRemove = (id: string): void => {
    setRemovingId(id);
    setActionError("");
    void api
      .removeMember(id)
      .then(async (): Promise<void> => {
        await refresh();
      })
      .catch((error: unknown): void => {
        setActionError(messageOf(error, "That member could not be removed."));
      })
      .finally((): void => {
        setRemovingId(null);
      });
  };

  const columns: readonly DataTableColumn<TeamMemberWithWorkload>[] = [
    { key: "name", header: "Name", cell: (member) => member.name },
    { key: "role", header: "Role", cell: (member) => member.role },
    {
      key: "openTasks",
      header: "Open tasks",
      align: "right",
      cell: (member) => member.openTaskCount,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (member) => (
        <Button
          variant="ghost"
          small
          aria-label={`Remove ${member.name}`}
          disabled={removingId === member.id}
          onClick={() => {
            handleRemove(member.id);
          }}
        >
          {removingId === member.id ? "Removing…" : "Remove"}
        </Button>
      ),
    },
  ];

  const emptyMessage =
    state === "error"
      ? "The roster could not be loaded, so no members can be shown."
      : "No team members yet. Add the first member with the form above.";

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-description">
            Everyone on the team, their role, and how much open work they currently carry.
          </p>
        </div>
        {onBack !== undefined ? (
          <div className="page-actions">
            <Button onClick={onBack}>&larr; Back to board</Button>
          </div>
        ) : null}
      </header>

      {state === "error" ? (
        <ErrorBanner
          message={loadError}
          onRetry={() => {
            void refresh();
          }}
        />
      ) : null}

      {actionError !== "" ? (
        <p className="notice notice-danger" role="alert">
          {actionError}
        </p>
      ) : null}

      <Card title="Add a member">
        <form className="form" aria-label="Add a team member" noValidate onSubmit={handleSubmit}>
          <div className="form-row">
            <TextField
              label="Name"
              value={name}
              placeholder="e.g. Jordan Blake"
              error={nameError === "" ? undefined : nameError}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
            <TextField
              label="Role"
              value={role}
              placeholder="e.g. Product Designer"
              hint="A descriptive job title; roles carry no permissions."
              error={roleError === "" ? undefined : roleError}
              onChange={(event) => {
                setRole(event.target.value);
              }}
            />
          </div>
          <div className="form-actions">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Adding…" : "Add member"}
            </Button>
          </div>
        </form>
      </Card>

      {state === "loading" ? (
        <p className="notice" role="status">
          Loading the team roster…
        </p>
      ) : (
        <DataTable
          caption="Team roster"
          columns={columns}
          rows={members}
          rowKey={(member) => member.id}
          emptyMessage={emptyMessage}
        />
      )}
    </>
  );
}
