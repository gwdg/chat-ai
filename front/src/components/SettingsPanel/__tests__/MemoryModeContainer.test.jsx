import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MemoryModeContainer from "../MemoryModeContainer";

const openModal = vi.fn();
vi.mock("react-redux", () => ({
  useSelector: () => 1,
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal }),
}));

const localState = { settings: { memory_mode_override: "default" } };

describe("MemoryModeContainer", () => {
  it("updates the conversation memory override", () => {
    const setLocalState = vi.fn((updater) => updater(localState));
    render(
      <MemoryModeContainer localState={localState} setLocalState={setLocalState} />,
    );

    const recall = screen.getByRole("button", { name: /recall/i });
    fireEvent.click(recall);
    expect(setLocalState).toHaveBeenCalled();
    expect(setLocalState.mock.results[0].value.settings.memory_mode_override).toBe(1);
  });

  it("opens the memory help modal", () => {
    render(
      <MemoryModeContainer localState={localState} setLocalState={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /memory mode|conversation/i }));
    expect(openModal).toHaveBeenCalledWith("helpMemory");
  });
});
