import { describe, expect, it } from "vitest";

import { MAX_COMMENT_BODY_LENGTH, readCommentBody } from "./service.js";

describe("readCommentBody", () => {
  it("accepts a comment and trims surrounding whitespace", () => {
    const result = readCommentBody({ body: "  Priya reviewed the draft  " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("Priya reviewed the draft");
    }
  });

  it("rejects an empty body with a 400 problem", () => {
    const result = readCommentBody({ body: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.status).toBe(400);
      expect(result.problem.body.error).toBe("invalid_body");
    }
  });

  it("rejects a whitespace-only body", () => {
    const result = readCommentBody({ body: "   \n\t " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.status).toBe(400);
    }
  });

  it("rejects a payload with no body field", () => {
    const result = readCommentBody({ note: "Priya reviewed the draft" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.status).toBe(400);
    }
  });

  it("rejects a body that is not a string", () => {
    const result = readCommentBody({ body: { text: "Priya reviewed the draft" } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.status).toBe(400);
    }
  });

  it("rejects a payload that is not an object", () => {
    for (const payload of [null, undefined, "Priya reviewed the draft"]) {
      const result = readCommentBody(payload);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects a body longer than the maximum length", () => {
    const result = readCommentBody({ body: "a".repeat(MAX_COMMENT_BODY_LENGTH + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.status).toBe(400);
      expect(result.problem.body.message).toContain(String(MAX_COMMENT_BODY_LENGTH));
    }
  });

  it("accepts a body exactly at the maximum length", () => {
    const result = readCommentBody({ body: "a".repeat(MAX_COMMENT_BODY_LENGTH) });
    expect(result.ok).toBe(true);
  });
});
