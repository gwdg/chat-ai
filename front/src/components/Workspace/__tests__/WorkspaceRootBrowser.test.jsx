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

  it("keeps a non-selectable row aligned without showing a checkbox", () => {
    renderBrowser({
      canSelectEntry: (entry) => entry.path !== "/b.txt",
    });

    expect(screen.queryByRole("checkbox", { name: "b.txt" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "a.txt" })).toBeInTheDocument();

    const row = screen.getByText("b.txt").closest(".group");
    expect(row?.querySelector("input")).toBeNull();
    // The spacer occupies the checkbox column so the rows line up.
    expect(row?.firstElementChild?.tagName).toBe("SPAN");
  });
});

describe("WorkspaceRootBrowser parent row", () => {
  it("follows an explicit up path outside the provider root", () => {
    const onNavigate = vi.fn();
    renderBrowser({ onNavigate, upPath: "/chats" });

    fireEvent.click(screen.getByRole("button", { name: /\.\./ }));

    expect(onNavigate).toHaveBeenCalledWith("/chats");
  });

  it("hides the parent row when there is no parent", () => {
    renderBrowser({ upPath: null });

    expect(screen.queryByRole("button", { name: /\.\./ })).toBeNull();
  });

  it("shows the parent row in an empty folder", () => {
    const onNavigate = vi.fn();
    renderBrowser({ entries: [], upPath: "/chats", onNavigate });

    expect(screen.getByText("This folder is empty.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /\.\./ }));
    expect(onNavigate).toHaveBeenCalledWith("/chats");
  });
});
