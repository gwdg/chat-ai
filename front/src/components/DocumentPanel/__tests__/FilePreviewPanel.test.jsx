import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FilePreviewPanel from "../FilePreviewPanel";

// Workspace, agent and chat previews all render this panel, so the shared renderer has
// to cover the shapes each of them produces.
const renderPanel = (preview, props = {}) =>
  render(<FilePreviewPanel preview={preview} onClose={() => {}} {...props} />);

describe("FilePreviewPanel", () => {
  it("renders CSV text as a table", () => {
    renderPanel({
      entry: { name: "data.csv", mime: "text/csv" },
      text: "name,size\nalpha,1\nbeta,2",
    });

    expect(
      screen.getByRole("columnheader", { name: "name" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "beta" })).toBeInTheDocument();
  });

  it("renders an image from the entry's url", () => {
    renderPanel({
      entry: { name: "chart.png", mime: "image/png", size: 12 },
      url: "blob:chart",
    });

    expect(screen.getByRole("img", { name: "chart.png" })).toHaveAttribute(
      "src",
      "blob:chart",
    );
    expect(screen.queryByText(/Failed to load image/)).not.toBeInTheDocument();
  });

  it("hands the entry to the caller's download action", () => {
    const onDownload = vi.fn();
    renderPanel(
      { entry: { name: "notes.md", mime: "text/markdown" }, url: "blob:notes" },
      { onDownload },
    );

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(onDownload).toHaveBeenCalledWith(
      expect.objectContaining({ name: "notes.md" }),
    );
  });

  it("makes git stat paths clickable when the caller can open them", () => {
    const onOpenPath = vi.fn();
    renderPanel(
      {
        entry: { name: "git log", mime: "text/plain" },
        text: "commit abc\n src/App.jsx | 4 ++--\n",
        onOpenPath,
      },
      { onDownload: vi.fn() },
    );

    fireEvent.click(screen.getByRole("button", { name: "src/App.jsx" }));

    expect(onOpenPath).toHaveBeenCalledWith("src/App.jsx");
  });

  it("reports a type it cannot preview", () => {
    renderPanel({
      entry: { name: "archive.zip", mime: "application/zip" },
      url: "blob:zip",
    });

    expect(screen.getByText("Unsupported file type")).toBeInTheDocument();
  });
});
