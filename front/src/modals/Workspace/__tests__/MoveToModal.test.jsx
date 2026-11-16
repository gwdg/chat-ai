import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MoveToModal from "../MoveToModal";

const entries = [{ name: "a.txt" }, { name: "b.txt" }];
const sources = [{ id: "second", label: "Second browser" }];

describe("MoveToModal", () => {
  it("describes a multi-item move", () => {
    render(
      <MoveToModal
        isOpen
        onClose={vi.fn()}
        entries={entries}
        sources={sources}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 selected items/)).toBeInTheDocument();
  });

  it("closes before selecting so the confirmation modal can open", () => {
    const calls = [];
    const onClose = vi.fn(() => calls.push("close"));
    const onSelect = vi.fn(() => calls.push("select"));

    render(
      <MoveToModal
        isOpen
        onClose={onClose}
        entries={entries}
        sources={sources}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    expect(onSelect).toHaveBeenCalledWith("second");
    expect(calls).toEqual(["close", "select"]);
  });
});
