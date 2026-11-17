import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WorkspaceRootTree from "../WorkspaceRootTree";

const entry = (name, kind, path = name) => ({
  sourceId: "root",
  path,
  name,
  kind,
  local: true,
});

const baseProps = (entries) => ({
  entries,
  loadChildren: vi.fn(async () => []),
  onOpen: vi.fn(),
  onRemoveLocal: vi.fn(),
  onRemoveMount: vi.fn(),
  onToggleMountReadOnly: vi.fn(),
  isReadOnly: () => false,
  isSourceReadOnly: () => false,
});

describe("WorkspaceRootTree flat mode", () => {
  it("renders only the top level and opens a folder in the centre browser", () => {
    const props = baseProps([
      entry("Docs", "dir"),
      entry("readme.md", "file"),
    ]);

    render(<WorkspaceRootTree {...props} flat />);

    expect(screen.getByText("Docs")).toBeInTheDocument();
    expect(screen.getByText("readme.md")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Docs"));

    expect(props.onOpen).toHaveBeenCalledWith(props.entries[0]);
    expect(props.loadChildren).not.toHaveBeenCalled();
  });

  it("opens a top-level file", () => {
    const props = baseProps([entry("readme.md", "file")]);

    render(<WorkspaceRootTree {...props} flat />);
    fireEvent.click(screen.getByText("readme.md"));

    expect(props.onOpen).toHaveBeenCalledWith(props.entries[0]);
  });

  it("shows an attached chat's folder by its id, without unmount controls", () => {
    const chatEntry = {
      ...entry("chat-1", "dir", "chats/chat-1"),
      local: false,
      mount: {
        id: "mount-1",
        workspaceId: "ws-1",
        sourceId: "chat-storage:ws-1:chat-1",
        sourcePath: "/",
        path: "/chats/chat-1",
        createdAt: 1,
        lastModified: 1,
      },
    };
    const props = baseProps([chatEntry]);

    render(<WorkspaceRootTree {...props} flat canRemoveMount={() => false} />);

    const row = screen.getByText("chat-1");
    expect(screen.queryByText("Trip planning")).toBeNull();
    expect(screen.queryByLabelText("Remove folder")).toBeNull();

    fireEvent.click(row);
    expect(props.onOpen).toHaveBeenCalledWith(chatEntry);
  });

  it("renders a display name while navigating by the real path", () => {
    const chatEntry = {
      ...entry("chat-1", "dir", "chats/chat-1"),
      local: false,
      mount: {
        id: "mount-1",
        workspaceId: "ws-1",
        sourceId: "chat-storage:ws-1:chat-1",
        sourcePath: "/",
        path: "/chats/chat-1",
        createdAt: 1,
        lastModified: 1,
      },
    };
    const props = baseProps([chatEntry]);

    render(
      <WorkspaceRootTree
        {...props}
        flat
        displayName={() => "Trip planning"}
      />,
    );

    const row = screen.getByText("Trip planning");
    expect(screen.queryByText("chat-1")).toBeNull();
    expect(row.closest("button")?.getAttribute("title")).toBe("chats/chat-1");

    fireEvent.click(row);
    expect(props.onOpen).toHaveBeenCalledWith(chatEntry);
  });
});

describe("WorkspaceRootTree failures", () => {
  it("keeps a failed folder listing on the expanded row", async () => {
    const props = baseProps([entry("Docs", "dir")]);
    props.loadChildren.mockRejectedValue(new Error("listing failed"));

    render(<WorkspaceRootTree {...props} />);
    fireEvent.click(screen.getByText("Docs"));

    expect(await screen.findByText("listing failed")).toBeInTheDocument();
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it("reports a failed git check on the mount row", async () => {
    const props = baseProps([
      {
        ...entry("chat-1", "dir", "chats/chat-1"),
        local: false,
        mount: {
          id: "mount-1",
          workspaceId: "ws-1",
          sourceId: "chat-storage:ws-1:chat-1",
          sourcePath: "/",
          path: "/chats/chat-1",
          createdAt: 1,
          lastModified: 1,
        },
      },
    ]);
    props.checkGit = vi.fn(async () => {
      throw new Error("git check failed");
    });

    render(<WorkspaceRootTree {...props} />);

    expect(await screen.findByText("git check failed")).toBeInTheDocument();
  });
});
