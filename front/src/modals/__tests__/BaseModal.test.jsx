import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BaseModal from "../BaseModal";

const renderModal = (onClose = vi.fn()) => {
  render(
    <BaseModal isOpen onClose={onClose} titleKey="common.close">
      <p>Dialog body</p>
    </BaseModal>,
  );
  return onClose;
};

// Headless UI decides "outside" from the pointerdown/pointerup pair, so a real
// click on the overlay is two events, not one. In this app the page root is one
// of the dialog's containers, so the overlay itself is what lies outside.
const clickOutside = () => {
  const overlay = document.querySelector(".backdrop-blur-sm");
  if (!overlay) throw new Error("Overlay not rendered");
  fireEvent.pointerDown(overlay);
  fireEvent.pointerUp(overlay);
};

const advance = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("BaseModal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // A double click opens the dialog with its first click; the second click lands
  // on the just-mounted overlay. It must not close the dialog the first one
  // opened, otherwise the window only flashes.
  it("ignores an outside click while a double click is still opening it", () => {
    vi.useFakeTimers();
    const onClose = renderModal();

    clickOutside();

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Dialog body")).toBeInTheDocument();
  });

  it("closes on an outside click once the opening window has passed", () => {
    vi.useFakeTimers();
    const onClose = renderModal();

    advance(400);
    clickOutside();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("still closes at once through the close button", () => {
    vi.useFakeTimers();
    const onClose = renderModal();

    fireEvent.click(screen.getByLabelText("Close dialog"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
