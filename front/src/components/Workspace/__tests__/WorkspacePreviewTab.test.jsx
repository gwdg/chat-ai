import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The Describe button only depends on this hook; its own behaviour is covered by
// DescribeImageButton.test.jsx. Here it answers "no vision model", so the button
// must be present (greyed out) rather than asking the network.
vi.mock("../../../hooks/useVisionModelAvailable", () => ({
  useVisionModelAvailable: () => false,
}));

// The shared Describe button reads the toast helper from Redux; only its disabled
// state matters here, so the toast is stubbed out.
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));

import WorkspacePreviewTab from "../WorkspacePreviewTab";

const preview = {
  entry: { name: "notes.txt", mime: "text/plain", size: 5 },
  text: "hello",
  loading: false,
};

const renderTab = (props = {}) =>
  render(
    <WorkspacePreviewTab
      preview={preview}
      onClose={vi.fn()}
      {...props}
    />
  );

describe("WorkspacePreviewTab", () => {
  it("renders the file name and the mime and size subtitle", () => {
    renderTab();

    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByText("text/plain · 5 B")).toBeInTheDocument();
  });

  it("shows the file's own content, not just its name", () => {
    renderTab();

    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("calls onClose from the close button", () => {
    const onClose = vi.fn();
    renderTab({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hands the entry to onDownload", () => {
    const onDownload = vi.fn();
    renderTab({ onDownload });

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(onDownload).toHaveBeenCalledWith(preview.entry);
  });

  it("omits the download button when no onDownload is given", () => {
    renderTab();

    expect(
      screen.queryByRole("button", { name: "Download" }),
    ).not.toBeInTheDocument();
  });

  it("offers Describe left of Download for an image", () => {
    renderTab({
      preview: {
        entry: { name: "chart.png", mime: "image/png", size: 12 },
        url: "blob:chart",
      },
      onDownload: vi.fn(),
    });

    const describe = screen.getByTestId("describe-image");
    const download = screen.getByRole("button", { name: "Download" });
    expect(
      describe.compareDocumentPosition(download) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // No vision model in this deployment, so the action stays greyed out.
    expect(describe).toBeDisabled();
  });

  it("offers no Describe action for a text file", () => {
    renderTab();

    expect(screen.queryByTestId("describe-image")).not.toBeInTheDocument();
  });

  // The Preview tab marks each open with a `key` on the request. It must become
  // React's own key, not ride along inside spread props, which React rejects.
  it("passes the request key as the content key instead of a spread prop", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      renderTab({ preview: { ...preview, key: 7 } });

      const keyWarnings = errorSpy.mock.calls
        .map((call) => String(call[0] ?? ""))
        .filter((message) => message.includes("prop is being spread"));
      expect(keyWarnings).toEqual([]);
      expect(screen.getByText("hello")).toBeInTheDocument();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("explains a file that is too large and downloads only on request", () => {
    const onDownload = vi.fn();
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderTab({
      preview: {
        entry: { name: "scan.pdf", mime: "application/pdf", size: 30 * 1024 * 1024 },
        tooLarge: true,
        limitBytes: 25 * 1024 * 1024,
      },
      onDownload,
    });

    expect(
      screen.getByText("This file is too large to preview."),
    ).toBeInTheDocument();
    expect(clicked).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector('[data-guide="preview-download"]'));
    expect(onDownload).toHaveBeenCalledWith(
      expect.objectContaining({ name: "scan.pdf" }),
    );
    clicked.mockRestore();
  });

  it("offers the download when a PDF cannot be framed on a mobile browser", () => {
    const onDownload = vi.fn();
    const original = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36",
    });
    try {
      renderTab({
        preview: {
          entry: { name: "scan.pdf", mime: "application/pdf", size: 1024 },
          url: "blob:scan",
        },
        onDownload,
      });

      expect(
        screen.getByText("PDF preview is not available on mobile devices"),
      ).toBeInTheDocument();
      fireEvent.click(document.querySelector('[data-guide="preview-download"]'));
      expect(onDownload).toHaveBeenCalledWith(
        expect.objectContaining({ name: "scan.pdf" }),
      );
    } finally {
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        value: original,
      });
    }
  });
});
