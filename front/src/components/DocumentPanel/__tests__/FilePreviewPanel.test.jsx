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

  it("names the file's type in the header", () => {
    const { container, unmount } = renderPanel({
      entry: { name: "notes.md", mime: "text/markdown" },
      text: "# Notes",
    });

    expect(container.querySelector('[data-file-type="markdown"]')).toBeTruthy();
    unmount();

    // A provider that reports no MIME type still gets the type from the name.
    const second = renderPanel({
      entry: { name: "report.pdf" },
      url: "blob:pdf",
    });
    expect(
      second.container.querySelector('[data-file-type="pdf"]'),
    ).toBeTruthy();
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

  it("explains a file that is too large and waits for a download click", () => {
    const onDownload = vi.fn();
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderPanel(
      {
        entry: { name: "big.pdf", mime: "application/pdf", size: 30 * 1024 * 1024 },
        tooLarge: true,
        limitBytes: 25 * 1024 * 1024,
      },
      { onDownload },
    );

    expect(
      screen.getByText("This file is too large to preview."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Preview is limited to 25 MB. Download the file to open it."),
    ).toBeInTheDocument();
    // Opening the preview never downloads anything by itself.
    expect(clicked).not.toHaveBeenCalled();
    expect(onDownload).not.toHaveBeenCalled();

    const notice = document.querySelector('[data-guide="preview-download"]');
    fireEvent.click(notice);

    expect(onDownload).toHaveBeenCalledWith(
      expect.objectContaining({ name: "big.pdf" }),
    );
    clicked.mockRestore();
  });

  it("opens a cited PDF at the cited page", () => {
    renderPanel({
      entry: { name: "paper.pdf", mime: "application/pdf" },
      url: "blob:paper",
      page: 7,
    });

    expect(screen.getByTitle("paper.pdf")).toHaveAttribute(
      "src",
      "blob:paper#page=7",
    );
    expect(screen.getByText("Opened at page 7")).toBeInTheDocument();
  });

  it("keeps a fragment the caller set and appends the page", () => {
    renderPanel({
      entry: { name: "paper.pdf", mime: "application/pdf" },
      url: "blob:paper#zoom=page-fit",
      page: 3,
    });

    expect(screen.getByTitle("paper.pdf")).toHaveAttribute(
      "src",
      "blob:paper#zoom=page-fit&page=3",
    );
  });

  it("zooms a PDF preview and resets it", () => {
    renderPanel({
      entry: { name: "paper.pdf", mime: "application/pdf" },
      url: "blob:paper",
    });

    expect(screen.getByTitle("paper.pdf").tagName).toBe("IFRAME");
    const scaled = screen.getByTestId("pdf-zoom-content");
    // The frame grows instead of being transformed, so the pane can scroll to
    // the whole page and the viewer re-lays it out at the larger size.
    expect(scaled.style.width).toBe("100%");
    expect(scaled.style.height).toBe("100%");

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(scaled.style.width).toBe("125%");
    expect(scaled.style.height).toBe("125%");
    expect(
      screen.getByRole("button", { name: "Reset zoom to 100%" }),
    ).toHaveTextContent("125%");

    fireEvent.click(screen.getByRole("button", { name: "Reset zoom to 100%" }));

    expect(scaled.style.width).toBe("100%");
  });
});
