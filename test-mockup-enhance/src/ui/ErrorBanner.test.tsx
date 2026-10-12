// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ErrorBanner } from "./ErrorBanner.js";

afterEach(() => {
  cleanup();
});

describe("ErrorBanner", () => {
  it("announces the failure and shows the message", () => {
    render(<ErrorBanner message="Could not load the board." />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveTextContent("Could not load the board.");
  });

  it("omits the retry control when no handler is supplied", () => {
    render(<ErrorBanner message="The board is offline." />);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("calls onRetry when the retry control is pressed", () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="The board is offline." onRetry={onRetry} />);
    screen.getByRole("button", { name: "Retry" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
