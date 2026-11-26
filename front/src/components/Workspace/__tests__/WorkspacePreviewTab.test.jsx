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
});
