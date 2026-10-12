import { describe, expect, it } from "vitest";

import {
  API_PREFIX,
  HEALTH_ENDPOINT,
  MEMBERS_ENDPOINT,
  TASKS_ENDPOINT,
  memberEndpoint,
  taskCommentsEndpoint,
  taskEndpoint,
} from "./api-paths";

describe("api paths", () => {
  it("mounts every endpoint under the api prefix", () => {
    expect(API_PREFIX).toBe("/api");
    expect(TASKS_ENDPOINT).toBe("/api/tasks");
    expect(MEMBERS_ENDPOINT).toBe("/api/members");
    expect(HEALTH_ENDPOINT).toBe("/api/health");
  });

  it("addresses a single task and its comment thread", () => {
    expect(taskEndpoint("task-abc")).toBe("/api/tasks/task-abc");
    expect(taskCommentsEndpoint("task-abc")).toBe("/api/tasks/task-abc/comments");
  });

  it("addresses a single team member", () => {
    expect(memberEndpoint("member-abc")).toBe("/api/members/member-abc");
  });
});
