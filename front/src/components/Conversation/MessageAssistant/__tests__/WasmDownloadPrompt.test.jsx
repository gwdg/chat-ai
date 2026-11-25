import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WasmDownloadPrompt from "../WasmDownloadPrompt";

describe("WasmDownloadPrompt", () => {
  it("shows the download size and only continues on confirmation", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <WasmDownloadPrompt
        feature="Typst"
        sizeMb={38}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText(/Download Typst renderer/)).toBeInTheDocument();
    expect(screen.getByText(/About 38 MB/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Download and render" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep as code" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
