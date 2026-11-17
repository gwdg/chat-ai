import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
});
