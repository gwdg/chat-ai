import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WorkspaceRootBrowser from "../WorkspaceRootBrowser";

const entries = [
  { sourceId: "source", path: "/a.txt", name: "a.txt", kind: "file", size: 3 },
  { sourceId: "source", path: "/b.txt", name: "b.txt", kind: "file", size: 4 },
];

const renderBrowser = (props = {}) =>
  render(
    <WorkspaceRootBrowser
      path="/"
      rootPath="/"
      breadcrumbs={[]}
      entries={entries}
      onOpen={vi.fn()}
      selectable
      selectedPaths={[]}
      onToggleSelect={vi.fn()}
      onSelectAll={vi.fn()}
      selectionActions={<button type="button">Delete selected</button>}
      {...props}
    />,
  );

describe("WorkspaceRootBrowser multi-select", () => {
  it("toggles an entry without opening it", () => {
    const onOpen = vi.fn();
    const onToggleSelect = vi.fn();
    renderBrowser({ onOpen, onToggleSelect });

    fireEvent.click(screen.getByRole("checkbox", { name: "a.txt" }));

    expect(onToggleSelect).toHaveBeenCalledWith(entries[0], true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("shows the selected count and the selection actions", () => {
    renderBrowser({ selectedPaths: ["/a.txt"] });

    expect(screen.getByText("1 item selected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete selected" }),
    ).toBeInTheDocument();
  });

  it("selects and clears everything through the select-all checkbox", () => {
    const onSelectAll = vi.fn();
    const { rerender } = renderBrowser({ onSelectAll });

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(onSelectAll).toHaveBeenCalledWith(true);

    rerender(
      <WorkspaceRootBrowser
        path="/"
        rootPath="/"
        breadcrumbs={[]}
        entries={entries}
        onOpen={vi.fn()}
        selectable
        selectedPaths={["/a.txt", "/b.txt"]}
        onToggleSelect={vi.fn()}
        onSelectAll={onSelectAll}
        selectionActions={<button type="button">Delete selected</button>}
      />,
    );

    const selectAll = screen.getByRole("checkbox", { name: "Select all" });
    expect(selectAll).toBeChecked();
    fireEvent.click(selectAll);
    expect(onSelectAll).toHaveBeenCalledWith(false);
  });

  it("hides the checkboxes when the browser is not selectable", () => {
    renderBrowser({ selectable: false, selectionActions: undefined });

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });
});
