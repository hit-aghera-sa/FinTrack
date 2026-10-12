// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PrioritySelect } from "./PrioritySelect.js";
import { DEFAULT_PRIORITY } from "./priority.js";
import { TASK_PRIORITIES } from "../models/task.js";

afterEach(() => {
  cleanup();
});

function selectFor(label: string): HTMLSelectElement {
  return screen.getByLabelText(label) as HTMLSelectElement;
}

describe("PrioritySelect", () => {
  it("is labelled Priority and defaults to Medium", () => {
    render(<PrioritySelect onChange={vi.fn()} />);
    const select = selectFor("Priority");
    expect(select.value).toBe(DEFAULT_PRIORITY);
    expect(select.value).toBe("Medium");
  });

  it("offers exactly the shared priorities, in order", () => {
    render(<PrioritySelect onChange={vi.fn()} />);
    const options = Array.from(selectFor("Priority").options);
    expect(options.map((option: HTMLOptionElement): string => option.value)).toEqual([
      ...TASK_PRIORITIES,
    ]);
    expect(options.map((option: HTMLOptionElement): string => option.textContent ?? "")).toEqual([
      "Low",
      "Medium",
      "High",
    ]);
  });

  it("shows the value it is given", () => {
    render(<PrioritySelect value="High" onChange={vi.fn()} />);
    expect(selectFor("Priority").value).toBe("High");
  });

  it("raises the chosen level", () => {
    const onChange = vi.fn();
    render(<PrioritySelect value="Medium" onChange={onChange} />);

    fireEvent.change(selectFor("Priority"), { target: { value: "Low" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("Low");
  });

  it("ignores a value that is not a priority", () => {
    const onChange = vi.fn();
    render(<PrioritySelect value="Medium" onChange={onChange} />);

    fireEvent.change(selectFor("Priority"), { target: { value: "Urgent" } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts a custom label and renders an optional hint", () => {
    render(
      <PrioritySelect
        label="Task priority"
        hint="How urgent this task is."
        onChange={vi.fn()}
      />,
    );
    const select = selectFor("Task priority");
    expect(select.value).toBe("Medium");
    expect(screen.getByText("How urgent this task is.")).toBeTruthy();
    expect(select.getAttribute("aria-describedby")).toBe(`${select.id}-hint`);
  });

  it("can be disabled while a form is saving", () => {
    render(<PrioritySelect onChange={vi.fn()} disabled />);
    expect(selectFor("Priority").disabled).toBe(true);
  });
});
