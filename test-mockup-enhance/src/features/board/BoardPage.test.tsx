// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { BoardPageWithApi } from "./BoardPage.js";
import type { ChecklistSummaryClient } from "./checklistSummaryClient.js";
import { ApiError, type BoardApi } from "../../lib/api/client.js";
import { DEFAULT_TASK_PRIORITY, type Task, type TaskUpdate } from "../../models/task.js";
import type { TaskComment } from "../../models/comment.js";
import type { TeamMember, TeamMemberWithWorkload } from "../../models/member.js";
import type { ChecklistProgress } from "../../models/checklist/index.js";

afterEach(() => {
  cleanup();
});

const MEMBERS: TeamMemberWithWorkload[] = [
  { id: "m-priya", name: "Priya Natarajan", role: "Engineering Lead", openTaskCount: 2 },
  { id: "m-dan", name: "Dan Okafor", role: "Backend Engineer", openTaskCount: 1 },
];

const TASKS: Task[] = [
  {
    id: "t-onboarding",
    title: "Design the onboarding email",
    description: "Draft copy and layout.",
    assigneeId: "m-priya",
    dueDate: "2026-02-18",
    status: "todo",
    priority: "High",
    createdAt: "2026-01-05T09:00:00.000Z",
  },
  {
    id: "t-api",
    title: "Wire the board API",
    description: "",
    assigneeId: "m-dan",
    dueDate: null,
    status: "doing",
    priority: DEFAULT_TASK_PRIORITY,
    createdAt: "2026-01-06T09:00:00.000Z",
  },
  {
    id: "t-release",
    title: "Publish release notes",
    description: "",
    assigneeId: null,
    dueDate: "2026-01-09",
    status: "done",
    priority: "Low",
    createdAt: "2026-01-07T09:00:00.000Z",
  },
];

/** A stub that implements the whole client surface the board might touch. */
function stubApi(overrides: Partial<BoardApi>): BoardApi {
  const base: BoardApi = {
    listTasks: (): Promise<Task[]> => Promise.resolve([]),
    getTask: (id: string): Promise<Task> =>
      Promise.reject(new ApiError(404, `No task ${id}.`)),
    createTask: (): Promise<Task> =>
      Promise.reject(new ApiError(500, "createTask is not stubbed.")),
    updateTask: (): Promise<Task> =>
      Promise.reject(new ApiError(500, "updateTask is not stubbed.")),
    listComments: (): Promise<TaskComment[]> => Promise.resolve([]),
    addComment: (): Promise<TaskComment> =>
      Promise.reject(new ApiError(500, "addComment is not stubbed.")),
    listMembers: (): Promise<TeamMemberWithWorkload[]> => Promise.resolve([]),
    addMember: (): Promise<TeamMember> =>
      Promise.reject(new ApiError(500, "addMember is not stubbed.")),
    removeMember: (): Promise<void> => Promise.resolve(),
  };
  return { ...base, ...overrides };
}

/** A checklist summary stub: no task has any checklist items. */
const NO_CHECKLISTS: ChecklistSummaryClient = {
  listProgress: (): Promise<ChecklistProgress[]> => Promise.resolve([]),
};

/** A checklist summary stub answering with the given counts. */
function checklistStub(rows: readonly ChecklistProgress[]): ChecklistSummaryClient {
  return {
    listProgress: (): Promise<ChecklistProgress[]> => Promise.resolve([...rows]),
  };
}

const noop = (): void => undefined;

function loadedApi(overrides: Partial<BoardApi> = {}): BoardApi {
  return stubApi({
    listTasks: (): Promise<Task[]> => Promise.resolve(TASKS.map((task) => ({ ...task }))),
    listMembers: (): Promise<TeamMemberWithWorkload[]> => Promise.resolve(MEMBERS),
    ...overrides,
  });
}

describe("BoardPage", () => {
  it("draws the three column headings while the board is still loading", () => {
    const api = stubApi({
      listTasks: (): Promise<Task[]> => new Promise<Task[]>(() => undefined),
      listMembers: (): Promise<TeamMemberWithWorkload[]> =>
        new Promise<TeamMemberWithWorkload[]>(() => undefined),
    });

    render(
      <BoardPageWithApi
        api={api}
        checklist={NO_CHECKLISTS}
        onOpenTask={noop}
        onAddTask={noop}
      />,
    );

    expect(screen.getByRole("heading", { name: "To do" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Doing" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Done" })).toBeTruthy();
    expect(screen.getByText("Loading the board…")).toBeTruthy();
  });

  it("renders each task in the column matching its status, with assignee and due date", async () => {
    render(
      <BoardPageWithApi
        api={loadedApi()}
        checklist={NO_CHECKLISTS}
        onOpenTask={noop}
        onAddTask={noop}
      />,
    );

    // The columns are drawn from the first render, so the cards themselves are
    // what tells us the board has finished loading.
    expect(await screen.findByText("Design the onboarding email")).toBeTruthy();

    const todo = screen.getByRole("region", { name: "To do" });
    const doing = screen.getByRole("region", { name: "Doing" });
    const done = screen.getByRole("region", { name: "Done" });

    expect(within(todo).getByText("Design the onboarding email")).toBeTruthy();
    expect(within(todo).getByText("Priya Natarajan")).toBeTruthy();
    expect(within(todo).getByText("18 Feb 2026")).toBeTruthy();
    expect(within(todo).queryByText("Wire the board API")).toBeNull();

    expect(within(doing).getByText("Wire the board API")).toBeTruthy();
    expect(within(doing).getByText("Dan Okafor")).toBeTruthy();
    expect(within(doing).getByText("No due date")).toBeTruthy();

    expect(within(done).getByText("Publish release notes")).toBeTruthy();
    expect(within(done).getByText("Unassigned")).toBeTruthy();
  });

  it("labels every card with its own priority, in that level's colour class", async () => {
    render(
      <BoardPageWithApi
        api={loadedApi()}
        checklist={NO_CHECKLISTS}
        onOpenTask={noop}
        onAddTask={noop}
      />,
    );

    const expected: readonly { title: string; label: string; slug: string }[] = [
      { title: "Design the onboarding email", label: "High", slug: "high" },
      { title: "Wire the board API", label: "Medium", slug: "medium" },
      { title: "Publish release notes", label: "Low", slug: "low" },
    ];

    for (const entry of expected) {
      const card = await screen.findByRole("article", { name: entry.title });
      // The level is spelled out in words on the card…
      const text = within(card).getByText(entry.label);
      // …and the badge around it carries that level's own colour class.
      const badge = text.parentElement;
      expect(badge).not.toBeNull();
      expect(badge?.className).toBe(`ui-priority-badge ui-priority-badge--${entry.slug}`);
      expect(badge?.getAttribute("data-priority")).toBe(entry.slug);
      expect(badge?.getAttribute("title")).toBe(`Priority: ${entry.label}`);
    }

    // Each card shows exactly one priority label, beside its title.
    const medium = await screen.findByRole("article", { name: "Wire the board API" });
    expect(within(medium).queryByText("High")).toBeNull();
    expect(within(medium).queryByText("Low")).toBeNull();
  });

  it("shows a card's checklist progress only when that task has checklist items", async () => {
    const checklist = checklistStub([
      { taskId: "t-onboarding", done: 2, total: 5 },
      { taskId: "t-api", done: 3, total: 3 },
      // A task the summary mentions but which has no items at all.
      { taskId: "t-release", done: 0, total: 0 },
    ]);

    render(
      <BoardPageWithApi
        api={loadedApi()}
        checklist={checklist}
        onOpenTask={noop}
        onAddTask={noop}
      />,
    );

    const onboarding = await screen.findByRole("article", {
      name: "Design the onboarding email",
    });
    await waitFor(() => {
      expect(within(onboarding).getByTestId("checklist-progress").textContent).toBe("2/5");
    });
    expect(
      within(onboarding).getByTestId("checklist-progress").getAttribute("aria-label"),
    ).toBe("2 of 5 checklist items done");

    const wiring = await screen.findByRole("article", { name: "Wire the board API" });
    expect(within(wiring).getByTestId("checklist-progress").textContent).toBe("3/3");
    expect(within(wiring).getByTestId("checklist-progress").getAttribute("aria-label")).toBe(
      "3 of 3 checklist items done",
    );

    // A task with no checklist items carries NO progress badge — never "0/0".
    const release = await screen.findByRole("article", { name: "Publish release notes" });
    expect(within(release).queryByTestId("checklist-progress")).toBeNull();
  });

  it("shows no progress badge for a task the checklist summary does not mention", async () => {
    const checklist = checklistStub([{ taskId: "t-onboarding", done: 1, total: 4 }]);

    render(
      <BoardPageWithApi
        api={loadedApi()}
        checklist={checklist}
        onOpenTask={noop}
        onAddTask={noop}
      />,
    );

    const onboarding = await screen.findByRole("article", {
      name: "Design the onboarding email",
    });
    await waitFor(() => {
      expect(within(onboarding).getByTestId("checklist-progress").textContent).toBe("1/4");
    });

    for (const title of ["Wire the board API", "Publish release notes"]) {
      const card = await screen.findByRole("article", { name: title });
      expect(within(card).queryByTestId("checklist-progress")).toBeNull();
    }
  });

  it("keeps the board when the checklist summary cannot be read, with no progress badges", async () => {
    const failing: ChecklistSummaryClient = {
      listProgress: (): Promise<ChecklistProgress[]> =>
        Promise.reject(new ApiError(500, "The checklist store is unavailable.")),
    };

    render(
      <BoardPageWithApi
        api={loadedApi()}
        checklist={failing}
        onOpenTask={noop}
        onAddTask={noop}
      />,
    );

    const card = await screen.findByRole("article", { name: "Design the onboarding email" });
    expect(within(card).queryByTestId("checklist-progress")).toBeNull();
    expect(screen.queryAllByTestId("checklist-progress")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "To do" })).toBeTruthy();
  });

  it("moves a task by patching its status and re-renders it in the new column", async () => {
    const updateTask = vi.fn((id: string, patch: TaskUpdate): Promise<Task> => {
      const found = TASKS.find((task: Task): boolean => task.id === id);
      if (found === undefined) {
        return Promise.reject(new ApiError(404, "That task could not be found."));
      }
      return Promise.resolve({ ...found, status: patch.status ?? found.status });
    });

    render(
      <BoardPageWithApi
        api={loadedApi({ updateTask })}
        checklist={NO_CHECKLISTS}
        onOpenTask={noop}
        onAddTask={noop}
      />,
    );

    const card = await screen.findByRole("article", { name: "Design the onboarding email" });
    fireEvent.click(within(card).getByRole("button", { name: "Move to Doing" }));

    await waitFor(() => {
      expect(updateTask).toHaveBeenCalledWith("t-onboarding", { status: "doing" });
    });

    const doing = screen.getByRole("region", { name: "Doing" });
    const todo = screen.getByRole("region", { name: "To do" });
    await waitFor(() => {
      expect(within(doing).getByText("Design the onboarding email")).toBeTruthy();
    });
    expect(within(todo).queryByText("Design the onboarding email")).toBeNull();
  });

  it("shows the server's message when the board cannot be loaded", async () => {
    const api = stubApi({
      listTasks: (): Promise<Task[]> =>
        Promise.reject(new ApiError(500, "The board is unavailable right now.")),
      listMembers: (): Promise<TeamMemberWithWorkload[]> => Promise.resolve(MEMBERS),
    });

    render(
      <BoardPageWithApi
        api={api}
        checklist={NO_CHECKLISTS}
        onOpenTask={noop}
        onAddTask={noop}
      />,
    );

    expect(await screen.findByText(/The board is unavailable right now\./)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "To do" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Doing" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Done" })).toBeTruthy();
  });

  it("reports a failed move without losing the board", async () => {
    const api = loadedApi({
      updateTask: (): Promise<Task> =>
        Promise.reject(new ApiError(400, "That move was rejected.")),
    });

    render(
      <BoardPageWithApi
        api={api}
        checklist={NO_CHECKLISTS}
        onOpenTask={noop}
        onAddTask={noop}
      />,
    );

    const card = await screen.findByRole("article", { name: "Wire the board API" });
    fireEvent.click(within(card).getByRole("button", { name: "Move to Done" }));

    expect(await screen.findByText(/That move was rejected\./)).toBeTruthy();
    const doing = screen.getByRole("region", { name: "Doing" });
    expect(within(doing).getByText("Wire the board API")).toBeTruthy();
  });

  it("renders an empty board state with the columns still present", async () => {
    render(
      <BoardPageWithApi
        api={stubApi({
          listTasks: (): Promise<Task[]> => Promise.resolve([]),
          listMembers: (): Promise<TeamMemberWithWorkload[]> => Promise.resolve(MEMBERS),
        })}
        checklist={NO_CHECKLISTS}
        onOpenTask={noop}
        onAddTask={noop}
      />,
    );

    expect(await screen.findByText("No tasks on the board yet")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "To do" })).toBeTruthy();
    expect(screen.getByText("Nothing in Doing at the moment.")).toBeTruthy();
  });

  it("raises opening a card and adding a task to the host", async () => {
    const onOpenTask = vi.fn();
    const onAddTask = vi.fn();

    render(
      <BoardPageWithApi
        api={loadedApi()}
        checklist={NO_CHECKLISTS}
        onOpenTask={onOpenTask}
        onAddTask={onAddTask}
      />,
    );

    const card = await screen.findByRole("article", { name: "Publish release notes" });
    fireEvent.click(within(card).getByRole("button", { name: "Open" }));
    expect(onOpenTask).toHaveBeenCalledWith("t-release");

    fireEvent.click(screen.getAllByRole("button", { name: /Add task/ })[0] as HTMLElement);
    expect(onAddTask).toHaveBeenCalledTimes(1);
  });
});
