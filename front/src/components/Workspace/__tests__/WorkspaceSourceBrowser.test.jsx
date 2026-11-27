import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  providers: new Map(),
  sources: [],
  conversations: [],
  chatStorageDir: vi.fn(),
  onTargetChange: vi.fn(),
  onAddToWorkspace: vi.fn(),
  onUnmountSelection: vi.fn(),
  onRemoveSource: vi.fn(),
  onToggleSourceReadOnly: vi.fn(),
  onAddDeviceFolder: vi.fn(),
}));

vi.mock("../../../workspace/useWorkspaceProviders", () => ({
  useWorkspaceProviders: () => ({ providers: mocks.providers, reconnect: vi.fn() }),
}));
vi.mock("../../../db", () => ({
  useConversationList: () => mocks.conversations,
}));
vi.mock("../../../workspace/chatStorage", () => ({
  chatStorageDir: (...args) => mocks.chatStorageDir(...args),
}));

import WorkspaceSourceBrowser from "../WorkspaceSourceBrowser";

const localSource = {
  id: "local-1",
  workspaceId: "ws-1",
  kind: "local",
  label: "Project",
  config: {},
  capabilities: {},
  status: "connected",
  createdAt: 1,
  lastModified: 1,
};

const ragSource = {
  id: "rag-1",
  workspaceId: "ws-1",
  kind: "saia-rag",
  label: "SAIA RAG",
  config: {},
  capabilities: {},
  status: "connected",
  createdAt: 1,
  lastModified: 1,
};

const localProvider = {
  sourceId: "local-1",
  kind: "local",
  status: "connected",
  capabilities: {},
  quota: vi.fn(),
  list: vi.fn(),
};

const mcpSource = {
  id: "mcp-1",
  workspaceId: "ws-1",
  kind: "mcp",
  label: "Docs server",
  config: {},
  capabilities: {},
  status: "connected",
  createdAt: 1,
  lastModified: 1,
};

const ragProvider = {
  sourceId: "rag-1",
  kind: "saia-rag",
  status: "connected",
  capabilities: {},
  quota: vi.fn(),
  list: vi.fn(),
  listCollections: vi.fn(),
};

const mcpProvider = {
  sourceId: "mcp-1",
  kind: "mcp",
  status: "connected",
  capabilities: {},
  quota: vi.fn(),
  list: vi.fn(),
};

const saiaSource = {
  id: "saia-1",
  workspaceId: "ws-1",
  kind: "saia-fs",
  label: "SAIA Files",
  config: {},
  capabilities: {},
  status: "connected",
  createdAt: 1,
  lastModified: 1,
};

const saiaProvider = {
  sourceId: "saia-1",
  kind: "saia-fs",
  status: "connected",
  capabilities: {},
  quota: vi.fn(),
  list: vi.fn(),
};

const chatRoot = () => {
  const file = {
    kind: "file",
    getFile: async () => ({ size: 10, lastModified: 1, type: "text/plain" }),
  };
  return {
    kind: "directory",
    entries: async function* entries() {
      yield ["draft.md", file];
    },
  };
};

const renderBrowser = (props = {}) =>
  render(
    <WorkspaceSourceBrowser
      sources={mocks.sources}
      target={null}
      onTargetChange={mocks.onTargetChange}
      onAddToWorkspace={mocks.onAddToWorkspace}
      onUnmountSelection={mocks.onUnmountSelection}
      onRemoveSource={mocks.onRemoveSource}
      onToggleSourceReadOnly={mocks.onToggleSourceReadOnly}
      onAddDeviceFolder={mocks.onAddDeviceFolder}
      {...props}
    />,
  );

const guide = (name) => document.querySelector(`[data-guide="${name}"]`);
const addButton = () => guide("workspace-add-to-workspace");
const unmountButton = () => guide("workspace-unmount");

beforeEach(() => {
  mocks.sources = [localSource, ragSource];
  mocks.providers = new Map([
    ["local-1", localProvider],
    ["rag-1", ragProvider],
  ]);
  mocks.conversations = [{ id: "conv-uuid-1", title: "Planning chat" }];
  mocks.chatStorageDir.mockReset();
  mocks.chatStorageDir.mockResolvedValue(chatRoot());
  mocks.onTargetChange.mockReset();
  mocks.onAddToWorkspace.mockReset();
  mocks.onAddToWorkspace.mockResolvedValue(undefined);
  mocks.onUnmountSelection.mockReset();
  mocks.onUnmountSelection.mockResolvedValue(undefined);
  mocks.onRemoveSource.mockReset();
  mocks.onToggleSourceReadOnly.mockReset();
  mocks.onAddDeviceFolder.mockReset();
  localProvider.list.mockReset();
  localProvider.list.mockImplementation(async (path) => ({
    entries:
      path === "/"
        ? [
            { sourceId: "local-1", path: "/docs", name: "docs", kind: "dir" },
            {
              sourceId: "local-1",
              path: "/notes.txt",
              name: "notes.txt",
              kind: "file",
              size: 12,
            },
          ]
        : [],
  }));
  localProvider.quota.mockReset();
  localProvider.quota.mockResolvedValue({
    usage: 512 * 1024,
    quota: 2 * 1024 * 1024,
    scope: "origin",
  });
  ragProvider.list.mockReset();
  ragProvider.list.mockResolvedValue({
    entries: [
      { sourceId: "rag-1", path: "/recipes", name: "recipes", kind: "dir" },
    ],
  });
  ragProvider.quota.mockReset();
  ragProvider.quota.mockResolvedValue({
    usage: 1 * 1024 * 1024,
    quota: 5 * 1024 * 1024,
    scope: "account",
  });
  ragProvider.listCollections.mockReset();
  ragProvider.listCollections.mockResolvedValue([
    {
      name: "recipes",
      collection: "alice__recipes",
      owner: "alice",
      role: "owner",
      can_write: true,
      can_manage: true,
      shared: false,
    },
  ]);
  mcpProvider.list.mockReset();
  mcpProvider.list.mockResolvedValue({
    entries: [
      { sourceId: "mcp-1", path: "/files", name: "files", kind: "dir" },
      { sourceId: "mcp-1", path: "/readme.md", name: "readme.md", kind: "file" },
    ],
  });
  saiaProvider.list.mockReset();
  saiaProvider.list.mockResolvedValue({
    entries: [
      { sourceId: "saia-1", path: "/notes", name: "notes", kind: "dir" },
      {
        sourceId: "saia-1",
        path: "/readme.md",
        name: "readme.md",
        kind: "file",
        size: 9,
      },
    ],
  });
});

describe("WorkspaceSourceBrowser", () => {
  it("shows a pick-a-source hint when no target is selected", async () => {
    renderBrowser();

    const hint = guide("workspace-source-browser-hint");
    expect(hint).toBeInTheDocument();
    expect(hint).not.toBeEmptyDOMElement();
    expect(guide("workspace-source-browser-list")).toBeNull();
    await act(async () => {});
  });

  it("shows a disabled toolbar Add button when no drive is open", async () => {
    renderBrowser();

    expect(addButton()).toBeInTheDocument();
    expect(addButton()).toBeDisabled();
    expect(addButton()).toHaveTextContent("Add to Workspace");
    expect(screen.getByText("Storage locations")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Back" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Select all")).not.toBeInTheDocument();
    await act(async () => {});
  });

  it("lists mounted local folders with badge, quota and source actions", async () => {
    renderBrowser({ target: { drive: "device" } });

    const project = await screen.findByText("Project");
    const row = project.closest(".group");
    expect(row).toHaveClass(/gap-1\.5/);
    expect(within(row).getByText("device")).toBeInTheDocument();
    await waitFor(() =>
      expect(row.querySelector("[data-quota-bar]")).toHaveStyle({
        width: "25%",
      }),
    );
    expect(within(row).getByText("512 KB of 2.0 MB used")).toBeInTheDocument();

    fireEvent.click(within(row).getByRole("button", { name: "Remove source" }));
    expect(mocks.onRemoveSource).toHaveBeenCalledWith(localSource);

    fireEvent.click(
      within(row).getByRole("button", { name: "Make source read-only" }),
    );
    expect(mocks.onToggleSourceReadOnly).toHaveBeenCalledWith(localSource);
    expect(localProvider.list).not.toHaveBeenCalled();
  });

  it("marks a mounted folder that cannot be opened with a red exclamation", async () => {
    mocks.sources = [
      { ...localSource, status: "error", error: "Folder handle is missing" },
      ragSource,
    ];
    renderBrowser({ target: { drive: "device" } });

    const row = (await screen.findByText("Project")).closest(".group");
    const badge = within(row).getByRole("img", {
      name: /project could not be opened/i,
    });
    expect(badge).toHaveAttribute(
      "title",
      "Project could not be opened: Folder handle is missing",
    );
    expect(within(row).getByText("device")).toBeInTheDocument();

    fireEvent.click(badge);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Project could not be opened: Folder handle is missing",
    );
    expect(localProvider.list).not.toHaveBeenCalled();
  });

  it("names the lock and the Unmount button in German", async () => {
    const { default: i18n } = await import("../../../i18n");
    await act(async () => {
      await i18n.changeLanguage("de");
    });
    mocks.sources = [{ ...localSource, readOnly: true }, ragSource];
    renderBrowser({ target: { drive: "device" } });

    const row = (await screen.findByText("Project")).closest(".group");
    expect(within(row).getByLabelText("Nur lesen")).toBeInTheDocument();
    expect(unmountButton()).toHaveTextContent("Aushängen");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  it("shows the read-only lock on a mounted folder card", async () => {
    mocks.sources = [{ ...localSource, readOnly: true }, ragSource];
    renderBrowser({ target: { drive: "device" } });

    const row = (await screen.findByText("Project")).closest(".group");
    const lock = within(row).getByLabelText("Read-only");
    expect(lock).toHaveAttribute("data-guide", "workspace-source-lock");
    expect(within(row).getByText("device")).toBeInTheDocument();
  });

  it("keeps the toolbar Add button disabled until a row is selected", async () => {
    renderBrowser({ target: { drive: "device" } });

    await screen.findByText("Project");
    expect(addButton()).toBeDisabled();
  });

  it("adds the open folder from the toolbar when nothing is ticked", async () => {
    renderBrowser({ target: { drive: "device" } });

    fireEvent.click(await screen.findByText("Project"));
    await screen.findByText("docs");

    expect(addButton()).toHaveTextContent("Add current dir to workspace");
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.onAddToWorkspace).toHaveBeenCalledWith([
        expect.objectContaining({
          sourceId: "local-1",
          sourceKind: "local",
          path: "/",
          name: "Project",
          kind: "dir",
        }),
      ]),
    );
  });

  it("locks the rows inside a read-only source", async () => {
    mocks.sources = [{ ...localSource, readOnly: true }, ragSource];
    mocks.providers = new Map([
      ["local-1", localProvider],
      ["rag-1", ragProvider],
    ]);
    renderBrowser({ target: { drive: "device" } });

    fireEvent.click(await screen.findByText("Project"));
    await screen.findByText("docs");

    const docsRow = screen.getByText("docs").closest(".group");
    expect(within(docsRow).getByLabelText("Read-only")).toBeInTheDocument();
    const notesRow = screen.getByText("notes.txt").closest(".group");
    expect(within(notesRow).getByLabelText("Read-only")).toBeInTheDocument();
  });

  it("drills into a source and adds the selected folder to the workspace", async () => {
    renderBrowser({ target: { drive: "device" } });

    fireEvent.click(await screen.findByText("Project"));
    await screen.findByText("docs");
    // Nothing is ticked yet, so the toolbar offers the open folder itself.
    expect(addButton()).toBeEnabled();
    expect(addButton()).toHaveTextContent("Add current dir to workspace");

    fireEvent.click(screen.getByLabelText("docs"));
    expect(addButton()).toBeEnabled();
    expect(addButton()).toHaveTextContent("Add to Workspace (1)");
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.onAddToWorkspace).toHaveBeenCalledWith([
        expect.objectContaining({
          sourceId: "local-1",
          sourceKind: "local",
          path: "/docs",
          name: "docs",
          kind: "dir",
        }),
      ]),
    );
    await waitFor(() => expect(addButton()).not.toHaveTextContent("(1)"));
    expect(addButton()).toBeEnabled();
    expect(addButton()).toHaveTextContent("Add current dir to workspace");
  });

  it("selects a chat by clicking its row and adds exactly that chat", async () => {
    mocks.conversations = [
      { id: "conv-uuid-1", title: "Planning chat" },
      { id: "conv-uuid-2", title: "Second chat" },
    ];
    renderBrowser({ target: { drive: "chats" } });

    expect(await screen.findByText("Planning chat")).toBeInTheDocument();
    expect(screen.queryByText("conv-uuid-1")).not.toBeInTheDocument();
    expect(addButton()).toBeDisabled();

    fireEvent.click(screen.getByText("Planning chat"));

    const chatRow = screen.getByText("Planning chat").closest(".group");
    expect(chatRow).toHaveClass(/bg-accent/);
    expect(screen.getByLabelText("Planning chat")).toBeChecked();
    expect(addButton()).toBeEnabled();
    expect(addButton()).toHaveTextContent("Add to Workspace (1)");

    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.onAddToWorkspace).toHaveBeenCalledTimes(1),
    );
    const added = mocks.onAddToWorkspace.mock.calls[0][0];
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      sourceId: "chat:conv-uuid-1",
      sourceKind: "chat",
      path: "/",
      name: "Planning chat",
      kind: "dir",
      conversationId: "conv-uuid-1",
      title: "Planning chat",
    });
    await waitFor(() => expect(addButton()).not.toHaveTextContent("(1)"));
    expect(addButton()).toBeDisabled();
    expect(screen.getByLabelText("Planning chat")).not.toBeChecked();

    fireEvent.click(screen.getByText("Second chat"));

    expect(screen.getByLabelText("Planning chat")).not.toBeChecked();
    expect(screen.getByLabelText("Second chat")).toBeChecked();
    expect(addButton()).toHaveTextContent("Add to Workspace (1)");
  });

  it("does not open a chat as a folder when its row is clicked", async () => {
    renderBrowser({ target: { drive: "chats" } });

    fireEvent.click(await screen.findByText("Planning chat"));

    expect(mocks.chatStorageDir).not.toHaveBeenCalled();
    expect(screen.queryByText("draft.md")).not.toBeInTheDocument();
    expect(screen.getByText("Planning chat")).toBeInTheDocument();
    expect(addButton()).toBeEnabled();
    expect(mocks.onTargetChange).not.toHaveBeenCalled();
  });

  it("keeps the select-all circle out of the toolbar", async () => {
    mocks.conversations = [
      { id: "conv-uuid-1", title: "Planning chat" },
      { id: "conv-uuid-2", title: "Second chat" },
    ];
    renderBrowser({ target: { drive: "chats" } });

    await screen.findByText("Planning chat");
    expect(screen.queryByLabelText("Select all")).not.toBeInTheDocument();
    expect(addButton()).toBeDisabled();
    await act(async () => {});
  });

  it("marks a row that is already in the workspace", async () => {
    renderBrowser({
      target: { drive: "chats" },
      isInWorkspace: (selection) => selection.conversationId === "conv-uuid-1",
    });

    const row = (await screen.findByText("Planning chat")).closest(".group");
    expect(within(row).getByText("In workspace")).toBeInTheDocument();

    const checkbox = screen.getByLabelText("Planning chat");
    expect(checkbox).toBeEnabled();
    expect(checkbox).toHaveAttribute(
      "title",
      "Remove this folder from Chat AI entirely — every workspace stops using it and it leaves this list. You can add it again at any time.",
    );
  });

  it("selecting a mounted row arms Unmount, not Add", async () => {
    renderBrowser({
      target: { drive: "chats" },
      isInWorkspace: () => true,
    });

    fireEvent.click(await screen.findByText("Planning chat"));

    expect(screen.getByLabelText("Planning chat")).toBeChecked();
    expect(addButton()).toBeDisabled();
    expect(unmountButton()).toBeEnabled();
    expect(unmountButton()).toHaveTextContent("Unmount (1)");
    expect(unmountButton()).toHaveClass("btn-secondary");
    expect(unmountButton()).not.toHaveClass("text-error");
    expect(mocks.onAddToWorkspace).not.toHaveBeenCalled();

    fireEvent.click(unmountButton());
    await waitFor(() =>
      expect(mocks.onUnmountSelection).toHaveBeenCalledWith([
        expect.objectContaining({
          sourceId: "chat:conv-uuid-1",
          sourceKind: "chat",
          conversationId: "conv-uuid-1",
        }),
      ]),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Planning chat")).not.toBeChecked(),
    );
  });

  it("arms Unmount for a folder mounted by another workspace", async () => {
    renderBrowser({
      target: { drive: "device" },
      isInWorkspace: () => false,
      isMounted: () => true,
    });

    fireEvent.click(await screen.findByLabelText("Project"));

    // Still addable to this workspace, but the folder is mounted elsewhere.
    expect(addButton()).toHaveTextContent("Add to Workspace (1)");
    expect(unmountButton()).toBeEnabled();
    expect(unmountButton()).toHaveTextContent("Unmount (1)");

    fireEvent.click(unmountButton());
    await waitFor(() =>
      expect(mocks.onUnmountSelection).toHaveBeenCalledWith([
        expect.objectContaining({ sourceId: "local-1", path: "/" }),
      ]),
    );
  });

  it("keeps Unmount quiet when nothing mounted is selected", async () => {
    renderBrowser({
      target: { drive: "chats" },
      isInWorkspace: () => false,
    });

    fireEvent.click(await screen.findByText("Planning chat"));

    expect(addButton()).toHaveTextContent("Add to Workspace (1)");
    expect(unmountButton()).toBeDisabled();
    expect(unmountButton()).toHaveTextContent("Unmount");
    expect(mocks.onUnmountSelection).not.toHaveBeenCalled();
  });

  it("selects only rows that are not already in the workspace", async () => {
    mocks.conversations = [
      { id: "conv-uuid-1", title: "Planning chat" },
      { id: "conv-uuid-2", title: "Second chat" },
    ];
    renderBrowser({
      target: { drive: "chats" },
      isInWorkspace: (selection) => selection.conversationId === "conv-uuid-1",
    });

    fireEvent.click(await screen.findByText("Second chat"));

    expect(screen.getByLabelText("Planning chat")).not.toBeChecked();
    expect(screen.getByLabelText("Second chat")).toBeChecked();
    expect(addButton()).toHaveTextContent("Add to Workspace (1)");
  });

  it("still selects and adds rows that are not in the workspace", async () => {
    renderBrowser({
      target: { drive: "chats" },
      isInWorkspace: () => false,
    });

    fireEvent.click(await screen.findByText("Planning chat"));
    expect(addButton()).toBeEnabled();

    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.onAddToWorkspace).toHaveBeenCalledWith([
        expect.objectContaining({
          sourceId: "chat:conv-uuid-1",
          sourceKind: "chat",
          conversationId: "conv-uuid-1",
        }),
      ]),
    );
  });

  it("marks a device drive source folder that is already in the workspace", async () => {
    renderBrowser({
      target: { drive: "device" },
      isInWorkspace: () => true,
    });

    const row = (await screen.findByText("Project")).closest(".group");
    expect(within(row).getByText("In workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Project")).toBeEnabled();
  });

  it("marks a file inside a source that is already in the workspace", async () => {
    renderBrowser({
      target: { drive: "device", sourceId: "local-1" },
      isInWorkspace: (selection) => selection.kind === "file",
    });

    const row = (await screen.findByText("notes.txt")).closest(".group");
    expect(within(row).getByText("In workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("notes.txt")).toBeEnabled();
  });

  it("drops the card chrome when embedded", () => {
    const { unmount } = renderBrowser();
    const section = guide("workspace-source-browser");
    expect(section).toHaveClass(
      "rounded-xl",
      "border",
      "border-base-300",
      "bg-base-100",
      "h-full",
    );
    unmount();

    renderBrowser({ embedded: true });
    const embeddedSection = guide("workspace-source-browser");
    expect(embeddedSection).toHaveClass(
      "flex",
      "min-h-0",
      "min-w-0",
      "flex-1",
      "flex-col",
      "overflow-hidden",
    );
    expect(embeddedSection).not.toHaveClass("rounded-xl");
    expect(embeddedSection).not.toHaveClass("border");
    expect(embeddedSection).not.toHaveClass("border-base-300");
    expect(embeddedSection).not.toHaveClass("bg-base-100");
    expect(embeddedSection).not.toHaveClass("h-full");
  });

  it("lists the RAG collections", async () => {
    renderBrowser({ target: { drive: "rag" } });

    expect(await screen.findByText("recipes")).toBeInTheDocument();
    expect(ragProvider.listCollections).toHaveBeenCalled();
  });

  it("does not re-list the collections when a source only reports its status", async () => {
    const { rerender } = renderBrowser({ target: { drive: "rag" } });

    expect(await screen.findByText("recipes")).toBeInTheDocument();
    const calls = ragProvider.listCollections.mock.calls.length;

    // `useWorkspaceProviders` publishes a new source array and provider map
    // twice per connect, and each carries the status the handshake just wrote.
    // Re-listing on that would repeat the most expensive call saia-rag has.
    await act(async () => {
      mocks.sources = [
        { ...localSource, status: "connected" },
        { ...ragSource, status: "connecting" },
      ];
      mocks.providers = new Map([
        ["local-1", localProvider],
        ["rag-1", ragProvider],
      ]);
      rerender(
        <WorkspaceSourceBrowser
          sources={mocks.sources}
          target={{ drive: "rag" }}
          onTargetChange={mocks.onTargetChange}
          onAddToWorkspace={mocks.onAddToWorkspace}
          onUnmountSelection={mocks.onUnmountSelection}
          onRemoveSource={mocks.onRemoveSource}
          onToggleSourceReadOnly={mocks.onToggleSourceReadOnly}
          onAddDeviceFolder={mocks.onAddDeviceFolder}
        />,
      );
    });

    expect(screen.getByText("recipes")).toBeInTheDocument();
    expect(ragProvider.listCollections.mock.calls.length).toBe(calls);
  });

  it("browses the SAIA account folder and mounts one of its folders", async () => {
    mocks.sources = [localSource, ragSource, saiaSource];
    mocks.providers = new Map([
      ["local-1", localProvider],
      ["rag-1", ragProvider],
      ["saia-1", saiaProvider],
    ]);
    renderBrowser({ target: { drive: "saia-fs" } });

    // It is one account folder, not a source list: the drive opens inside it.
    expect(await screen.findByText("notes")).toBeInTheDocument();
    expect(saiaProvider.list).toHaveBeenCalledWith("/");
    expect(screen.queryByText("Project")).not.toBeInTheDocument();

    const file = screen.getByText("readme.md").closest(".group");
    expect(within(file).getByText("SAIA")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("notes"));
    expect(addButton()).toHaveTextContent("Add to Workspace (1)");
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.onAddToWorkspace).toHaveBeenCalledWith([
        expect.objectContaining({
          sourceId: "saia-1",
          sourceKind: "saia-fs",
          path: "/notes",
          name: "notes",
          kind: "dir",
        }),
      ]),
    );

    // Drilling into the folder lists its own path, and one Back returns to the root.
    fireEvent.click(screen.getByText("notes"));
    await waitFor(() => expect(saiaProvider.list).toHaveBeenCalledWith("/notes"));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("readme.md")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(mocks.onTargetChange).toHaveBeenCalledWith(null);
  });

  it("mounts an empty SAIA account folder from the empty state", async () => {
    mocks.sources = [{ ...saiaSource }];
    mocks.providers = new Map([["saia-1", saiaProvider]]);
    saiaProvider.list.mockResolvedValue({ entries: [] });
    renderBrowser({ target: { drive: "saia-fs" } });

    // A fresh account is an empty folder: there is no row to tick, so the
    // toolbar and the empty state both have to offer the folder itself.
    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
    expect(addButton()).toBeEnabled();
    expect(addButton()).toHaveTextContent("Add current dir to workspace");

    const mount = guide("workspace-add-current-folder");
    expect(mount).toHaveTextContent("Add this folder to the workspace");
    fireEvent.click(mount);

    await waitFor(() =>
      expect(mocks.onAddToWorkspace).toHaveBeenCalledWith([
        expect.objectContaining({
          sourceId: "saia-1",
          sourceKind: "saia-fs",
          path: "/",
          name: "SAIA-FS",
          kind: "dir",
        }),
      ]),
    );
  });

  it("marks an empty SAIA folder that is already mounted", async () => {
    mocks.sources = [{ ...saiaSource }];
    mocks.providers = new Map([["saia-1", saiaProvider]]);
    saiaProvider.list.mockResolvedValue({ entries: [] });
    renderBrowser({
      target: { drive: "saia-fs" },
      isInWorkspace: () => true,
    });

    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
    expect(guide("workspace-add-current-folder")).toBeNull();
    expect(screen.getByText("In workspace")).toBeInTheDocument();
  });

  it("locks the SAIA rows when the account folder is read-only", async () => {
    mocks.sources = [{ ...saiaSource, readOnly: true }];
    mocks.providers = new Map([["saia-1", saiaProvider]]);
    renderBrowser({ target: { drive: "saia-fs" } });

    const notes = (await screen.findByText("notes")).closest(".group");
    expect(within(notes).getByLabelText("Read-only")).toBeInTheDocument();
    // Read-only forbids writing through the row, not mounting it: the workspace
    // gets a read-only mount of the folder.
    fireEvent.click(screen.getByLabelText("notes"));
    expect(addButton()).toHaveTextContent("Add to Workspace (1)");
  });

  it("lists MCP sources, drills in, and adds an MCP folder", async () => {
    mocks.sources = [localSource, ragSource, mcpSource];
    mocks.providers = new Map([
      ["local-1", localProvider],
      ["rag-1", ragProvider],
      ["mcp-1", mcpProvider],
    ]);
    renderBrowser({ target: { drive: "mcp" } });

    const mcpRow = (await screen.findByText("Docs server")).closest(".group");
    expect(within(mcpRow).getByText("MCP")).toBeInTheDocument();
    expect(screen.queryByText("Project")).not.toBeInTheDocument();
    expect(mcpProvider.list).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Docs server"));

    expect(await screen.findByText("files")).toBeInTheDocument();
    expect(mcpProvider.list).toHaveBeenCalledWith("/");
    expect(addButton()).toBeEnabled();
    expect(addButton()).toHaveTextContent("Add current dir to workspace");

    fireEvent.click(screen.getByLabelText("files"));
    expect(addButton()).toHaveTextContent("Add to Workspace (1)");
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.onAddToWorkspace).toHaveBeenCalledWith([
        expect.objectContaining({
          sourceId: "mcp-1",
          sourceKind: "mcp",
          path: "/files",
          name: "files",
          kind: "dir",
        }),
      ]),
    );
    await waitFor(() => expect(addButton()).not.toHaveTextContent("(1)"));

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Docs server")).toBeInTheDocument();
    expect(mocks.onTargetChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(mocks.onTargetChange).toHaveBeenCalledWith(null);
  });

  it("returns from a source to the drive root without leaving the drive", async () => {
    renderBrowser({ target: { drive: "device" } });

    fireEvent.click(await screen.findByText("Project"));
    await screen.findByText("docs");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText("Project")).toBeInTheDocument();
    expect(mocks.onTargetChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(mocks.onTargetChange).toHaveBeenCalledWith(null);
  });

  it("shows the loading state while a source is listed", async () => {
    let resolveList;
    localProvider.list.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    renderBrowser({ target: { drive: "device", sourceId: "local-1" } });

    expect(await screen.findByText("Loading...")).toBeInTheDocument();
    resolveList({ entries: [] });
    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
  });

  it("shows a listing error", async () => {
    localProvider.list.mockRejectedValueOnce(new Error("Provider offline"));
    renderBrowser({ target: { drive: "device", sourceId: "local-1" } });

    expect(await screen.findByText("Provider offline")).toBeInTheDocument();
  });

  it("shows the empty state for an empty source", async () => {
    localProvider.list.mockResolvedValueOnce({ entries: [] });
    renderBrowser({ target: { drive: "device", sourceId: "local-1" } });

    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
  });
});

describe("device empty state", () => {
  const emptyDevice = async () => {
    mocks.sources = [];
    mocks.providers = new Map();
    renderBrowser({ target: { drive: "device" } });
    return waitFor(() => {
      const zone = guide("workspace-device-empty");
      expect(zone).toBeTruthy();
      return zone;
    });
  };

  it("invites a drop or a click instead of the small add button", async () => {
    const zone = await emptyDevice();

    expect(zone).toHaveTextContent("There's nothing here yet.");
    expect(zone).toHaveTextContent("Drag and drop a folder here");
    expect(guide("workspace-sources-add-device-folder")).toBeNull();

    fireEvent.click(zone);
    expect(mocks.onAddDeviceFolder).toHaveBeenCalledTimes(1);
    await act(async () => {});
  });

  it("mounts a dropped folder and says when the drop was not one", async () => {
    mocks.sources = [];
    mocks.providers = new Map();
    const mount = vi.fn();
    renderBrowser({
      target: { drive: "device" },
      onMountDeviceFolder: mount,
    });
    const zone = await waitFor(() => guide("workspace-device-empty"));

    const folder = { kind: "directory", name: "Thesis" };
    fireEvent.drop(zone, {
      dataTransfer: {
        items: [{ kind: "file", getAsFileSystemHandle: async () => folder }],
      },
    });
    await waitFor(() => expect(mount).toHaveBeenCalledWith(folder));

    fireEvent.drop(zone, {
      dataTransfer: {
        items: [
          {
            kind: "file",
            getAsFileSystemHandle: async () => ({ kind: "file", name: "a" }),
          },
        ],
      },
    });
    expect(
      await screen.findByText(/did not carry a folder/),
    ).toBeInTheDocument();
    await act(async () => {});
  });

  it("keeps the small add button once a folder is mounted", async () => {
    renderBrowser({ target: { drive: "device" } });

    await screen.findByText("Project");
    expect(guide("workspace-sources-add-device-folder")).toBeTruthy();
    await act(async () => {});
  });

  it("pills device files and browser chats like the workspace tree", async () => {
    renderBrowser({ target: { drive: "device", sourceId: "local-1" } });

    const folder = (await screen.findByText("docs")).closest(".group");
    expect(within(folder).getByText("device")).toBeInTheDocument();
    const file = screen.getByText("notes.txt").closest(".group");
    expect(within(file).getByText("device")).toBeInTheDocument();
  });

  it("pills chat rows and their files as browser storage", async () => {
    renderBrowser({ target: { drive: "chats" } });

    const chat = (await screen.findByText("Planning chat")).closest(".group");
    expect(within(chat).getByText("browser")).toBeInTheDocument();
    await act(async () => {});
  });

  it("opens the folder picker from the empty state and shows why it failed", async () => {
    mocks.sources = [];
    mocks.providers = new Map();
    const pick = vi.fn().mockResolvedValue("Folder picking is not supported");
    renderBrowser({ target: { drive: "device" }, onPickDeviceFolder: pick });
    const zone = await waitFor(() => guide("workspace-device-empty"));

    fireEvent.click(zone);
    expect(pick).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Folder picking is not supported"),
    ).toBeInTheDocument();
    await act(async () => {});
  });
});
