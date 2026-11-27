import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useModal } from "../ModalContext";

// A hot update can re-execute ModalContext.jsx, which replaces the context object
// while the mounted provider still uses the previous one. Consumers then read the
// context default, so it must be usable instead of `undefined` (see useModal).
describe("useModal without a provider", () => {
  it("returns callable modal actions", () => {
    const { result } = renderHook(() => useModal());

    expect(typeof result.current.openModal).toBe("function");
    expect(typeof result.current.closeModal).toBe("function");
    expect(typeof result.current.confirmAction).toBe("function");
    expect(() => result.current.openModal("settings")).not.toThrow();
    expect(() => result.current.closeModal()).not.toThrow();
  });

  it("never runs a confirmation callback on its own", () => {
    const { result } = renderHook(() => useModal());
    const onConfirm = vi.fn();

    result.current.confirmAction({ warningKey: "deleteChat" }, onConfirm);

    // The provider opens a dialog and calls the callback after the user agrees.
    // Without a provider nothing may be deleted silently.
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
