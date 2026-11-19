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

const arcanaSource = {
  id: "arcana-1",
  workspaceId: "ws-1",
  kind: "arcana-filesystem",
  label: "Arcana filesystem",
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

const arcanaProvider = {
  sourceId: "arcana-1",
  kind: "arcana-filesystem",
  status: "connected",
  capabilities: {},
  quota: vi.fn(),
  list: vi.fn(),
};

const mcpProvider = {
  sourceId: "mcp-1",
  kind: "mcp",
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
      onRemoveSource={mocks.onRemoveSource}
      onToggleSourceReadOnly={mocks.onToggleSourceReadOnly}
      onAddDeviceFolder={mocks.onAddDeviceFolder}
      {...props}
    />,
  );

const guide = (name) => document.querySelector(`[data-guide="${name}"]`);
const addButton = () => guide("workspace-add-to-workspace");

beforeEach(() => {
  mocks.sources = [localSource, arcanaSource];
  mocks.providers = new Map([
    ["local-1", localProvider],
    ["arcana-1", arcanaProvider],
  ]);
  mocks.conversations = [{ id: "conv-uuid-1", title: "Planning chat" }];
  mocks.chatStorageDir.mockReset();
  mocks.chatStorageDir.mockResolvedValue(chatRoot());
  mocks.onTargetChange.mockReset();
  mocks.onAddToWorkspace.mockReset();
  mocks.onAddToWorkspace.mockResolvedValue(undefined);
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
  arcanaProvider.list.mockReset();
  arcanaProvider.list.mockResolvedValue({
    entries: [
      { sourceId: "arcana-1", path: "/recipes", name: "recipes", kind: "dir" },
    ],
  });
  arcanaProvider.quota.mockReset();
  arcanaProvider.quota.mockResolvedValue({
    usage: 1 * 1024 * 1024,
    quota: 5 * 1024 * 1024,
    scope: "account",
  });
  mcpProvider.list.mockReset();
  mcpProvider.list.mockResolvedValue({
    entries: [
      { sourceId: "mcp-1", path: "/files", name: "files", kind: "dir" },
      { sourceId: "mcp-1", path: "/readme.md", name: "readme.md", kind: "file" },
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
    expect(within(row).getByText("Local folder")).toBeInTheDocument();
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

  it("keeps the toolbar Add button disabled until a row is selected", async () => {
    renderBrowser({ target: { drive: "device" } });

    await screen.findByText("Project");
    expect(addButton()).toBeDisabled();
  });

  it("drills into a source and adds the selected folder to the workspace", async () => {
    renderBrowser({ target: { drive: "device" } });

    fireEvent.click(await screen.findByText("Project"));
    await screen.findByText("docs");
    expect(addButton()).toBeDisabled();

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
    expect(addButton()).toBeDisabled();
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

    fireEvent.click(screen.getByLabelText("Select all"));

    expect(screen.getByLabelText("Planning chat")).toBeChecked();
    expect(screen.getByLabelText("Second chat")).toBeChecked();
    expect(addButton()).toHaveTextContent("Add to Workspace (2)");
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

  it("selects every visible row with Select all", async () => {
    renderBrowser({ target: { drive: "chats" } });

    await screen.findByText("Planning chat");
    fireEvent.click(screen.getByLabelText("Select all"));

    expect(screen.getByLabelText("Planning chat")).toBeChecked();
    expect(addButton()).toBeEnabled();
    expect(addButton()).toHaveTextContent("Add to Workspace (1)");
  });

  it("marks a row that is already in the workspace", async () => {
    renderBrowser({
      target: { drive: "chats" },
      isInWorkspace: (selection) => selection.conversationId === "conv-uuid-1",
    });

    const row = (await screen.findByText("Planning chat")).closest(".group");
    expect(within(row).getByText("In workspace")).toBeInTheDocument();

    const checkbox = screen.getByLabelText("Planning chat");
    expect(checkbox).toBeDisabled();
    expect(checkbox).toHaveAttribute("title", "In workspace");
  });

  it("does not select or add a row that is already in the workspace", async () => {
    renderBrowser({
      target: { drive: "chats" },
      isInWorkspace: () => true,
    });

    fireEvent.click(await screen.findByText("Planning chat"));

    expect(screen.getByLabelText("Planning chat")).not.toBeChecked();
    expect(addButton()).toBeDisabled();
    expect(mocks.onAddToWorkspace).not.toHaveBeenCalled();
  });

  it("selects only rows that are not already in the workspace with Select all", async () => {
    mocks.conversations = [
      { id: "conv-uuid-1", title: "Planning chat" },
      { id: "conv-uuid-2", title: "Second chat" },
    ];
    renderBrowser({
      target: { drive: "chats" },
      isInWorkspace: (selection) => selection.conversationId === "conv-uuid-1",
    });

    await screen.findByText("Planning chat");
    fireEvent.click(screen.getByLabelText("Select all"));

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
    expect(screen.getByLabelText("Project")).toBeDisabled();
  });

  it("marks a file inside a source that is already in the workspace", async () => {
    renderBrowser({
      target: { drive: "device", sourceId: "local-1" },
      isInWorkspace: (selection) => selection.kind === "file",
    });

    const row = (await screen.findByText("notes.txt")).closest(".group");
    expect(within(row).getByText("In workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("notes.txt")).toBeDisabled();
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

  it("browses the arcana collection", async () => {
    renderBrowser({ target: { drive: "arcanas" } });

    expect(await screen.findByText("recipes")).toBeInTheDocument();
    expect(arcanaProvider.list).toHaveBeenCalledWith("/");
  });

  it("lists MCP sources, drills in, and adds an MCP folder", async () => {
    mocks.sources = [localSource, arcanaSource, mcpSource];
    mocks.providers = new Map([
      ["local-1", localProvider],
      ["arcana-1", arcanaProvider],
      ["mcp-1", mcpProvider],
    ]);
    renderBrowser({ target: { drive: "mcp" } });

    expect(await screen.findByText("MCP")).toBeInTheDocument();
    expect(screen.getByText("Docs server")).toBeInTheDocument();
    expect(screen.queryByText("Project")).not.toBeInTheDocument();
    expect(mcpProvider.list).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Docs server"));

    expect(await screen.findByText("files")).toBeInTheDocument();
    expect(mcpProvider.list).toHaveBeenCalledWith("/");
    expect(addButton()).toBeDisabled();

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
