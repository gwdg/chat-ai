import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

// The markdown branch renders through the chat's MarkdownRenderer, which reads the HTML
// preferences from Redux.
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: {}, interface_settings: {} }),
}));

// The image header asks whether a vision model exists; here it must not touch the network.
vi.mock("../../../hooks/useVisionModelAvailable", () => ({
  useVisionModelAvailable: () => false,
}));

import FilePreviewPanel from "../FilePreviewPanel";

// Workspace, agent and chat previews all render this panel, so the shared renderer has
// to cover the shapes each of them produces.
const renderPanel = (preview, props = {}) =>
  render(
    <MemoryRouter>
      <FilePreviewPanel preview={preview} onClose={() => {}} {...props} />
    </MemoryRouter>
  );

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

  it("renders markdown with the chat's renderer", () => {
    renderPanel({
      entry: { name: "notes.md", mime: "text/markdown" },
      text: "# Notes\n\nSome **bold** text and a [link](https://example.org).",
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Notes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "link" })).toBeInTheDocument();
    // Not the raw fallback dump.
    expect(document.querySelector("pre")).toBeNull();
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
    // An image also offers Describe, next to its Download.
    expect(screen.getByTestId("describe-image")).toBeInTheDocument();
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
