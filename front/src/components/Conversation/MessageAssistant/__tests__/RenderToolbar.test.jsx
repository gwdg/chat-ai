import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RenderToolbar from "../RenderToolbar";

describe("RenderToolbar", () => {
  it("shows download and render/code actions", () => {
    const onDownload = vi.fn();
    const onToggle = vi.fn();
    const { rerender } = render(
      <RenderToolbar
        showCode
        onToggle={onToggle}
        renderLabel="Render as Graphviz"
        showCodeLabel="Show code"
        onDownload={onDownload}
        downloadLabel="Download rendered document"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Download rendered document" }));
    fireEvent.click(screen.getByRole("button", { name: "Render as Graphviz" }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <RenderToolbar
        showCode={false}
        onToggle={onToggle}
        renderLabel="Render as Graphviz"
        showCodeLabel="Show code"
        downloadLabel="Download rendered document"
      />
    );
    expect(screen.getByRole("button", { name: "Show code" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download rendered document" })).not.toBeInTheDocument();
  });
});
