// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TeamRoster } from "./TeamRoster.js";
import { ApiError, type BoardApi } from "../../lib/api/client.js";
import type {
  NewTeamMember,
  TeamMember,
  TeamMemberWithWorkload,
} from "../../models/member.js";
import type { NewTask, Task, TaskUpdate } from "../../models/task.js";
import type { TaskComment } from "../../models/comment.js";

interface Stub {
  api: BoardApi;
  added: NewTeamMember[];
  removed: string[];
}

/** A full stand-in for the board API, backed by an in-test roster array. */
function createStubApi(initial: readonly TeamMemberWithWorkload[]): Stub {
  let roster: TeamMemberWithWorkload[] = [...initial];
  const added: NewTeamMember[] = [];
  const removed: string[] = [];

  const api: BoardApi = {
    listTasks: (): Promise<Task[]> => Promise.resolve([]),
    getTask: (_id: string): Promise<Task> =>
      Promise.reject(new Error("getTask is not used by the roster screen")),
    createTask: (_input: NewTask): Promise<Task> =>
      Promise.reject(new Error("createTask is not used by the roster screen")),
    updateTask: (_id: string, _patch: TaskUpdate): Promise<Task> =>
      Promise.reject(new Error("updateTask is not used by the roster screen")),
    listComments: (_taskId: string): Promise<TaskComment[]> => Promise.resolve([]),
    addComment: (_taskId: string, _body: string): Promise<TaskComment> =>
      Promise.reject(new Error("addComment is not used by the roster screen")),
    listMembers: (): Promise<TeamMemberWithWorkload[]> => Promise.resolve([...roster]),
    addMember: (input: NewTeamMember): Promise<TeamMember> => {
      added.push(input);
      const created: TeamMember = {
        id: `m-new-${String(added.length)}`,
        name: input.name,
        role: input.role,
      };
      roster = [...roster, { ...created, openTaskCount: 0 }];
      return Promise.resolve(created);
    },
    removeMember: (id: string): Promise<void> => {
      removed.push(id);
      roster = roster.filter((member) => member.id !== id);
      return Promise.resolve();
    },
  };

  return { api, added, removed };
}

const ROSTER: readonly TeamMemberWithWorkload[] = [
  { id: "m-priya", name: "Priya Lunch", role: "Engineering Lead", openTaskCount: 3 },
  { id: "m-dan", name: "Dan Harbour", role: "Backend Engineer", openTaskCount: 1 },
];

afterEach(() => {
  cleanup();
});

describe("TeamRoster", () => {
  it("lists every member with their role and open-task count", async () => {
    const { api } = createStubApi(ROSTER);
    render(<TeamRoster api={api} />);

    expect(await screen.findByText("Priya Lunch")).toBeInTheDocument();
    expect(screen.getByText("Engineering Lead")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Dan Harbour")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Open tasks" })).toBeInTheDocument();
  });

  it("adds a member through the API and shows them in the list", async () => {
    const { api, added } = createStubApi(ROSTER);
    render(<TeamRoster api={api} />);
    await screen.findByText("Priya Lunch");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jordan Blake" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Product Designer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));

    expect(await screen.findByText("Jordan Blake")).toBeInTheDocument();
    expect(screen.getByText("Product Designer")).toBeInTheDocument();
    expect(added).toEqual([{ name: "Jordan Blake", role: "Product Designer" }]);
  });

  it("refuses a blank add and does not call the API", async () => {
    const { api, added } = createStubApi(ROSTER);
    render(<TeamRoster api={api} />);
    await screen.findByText("Priya Lunch");

    fireEvent.click(screen.getByRole("button", { name: "Add member" }));

    expect(await screen.findByText("Enter the member's name.")).toBeInTheDocument();
    expect(screen.getByText("Enter their role.")).toBeInTheDocument();
    expect(added).toHaveLength(0);
  });

  it("removes a member through the API and drops them from the list", async () => {
    const { api, removed } = createStubApi(ROSTER);
    render(<TeamRoster api={api} />);
    await screen.findByText("Dan Harbour");

    fireEvent.click(screen.getByRole("button", { name: "Remove Dan Harbour" }));

    await waitFor(() => {
      expect(screen.queryByText("Dan Harbour")).not.toBeInTheDocument();
    });
    expect(removed).toEqual(["m-dan"]);
    expect(screen.getByText("Priya Lunch")).toBeInTheDocument();
  });

  it("shows an empty-roster message while still offering the add form", async () => {
    const { api } = createStubApi([]);
    render(<TeamRoster api={api} />);

    expect(
      await screen.findByText("No team members yet. Add the first member with the form above."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Team" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
  });

  it("reports a failed roster read and keeps the heading and the add form", async () => {
    const { api } = createStubApi([]);
    const failing: BoardApi = {
      ...api,
      listMembers: (): Promise<TeamMemberWithWorkload[]> =>
        Promise.reject(new ApiError(503, "The roster is unavailable.")),
    };
    render(<TeamRoster api={failing} />);

    await waitFor(() => {
      expect(document.body.textContent ?? "").toContain("The roster is unavailable.");
    });
    expect(screen.getByRole("heading", { name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add member" })).toBeInTheDocument();
  });
});
