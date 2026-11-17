import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  providers: new Map(),
  sources: [],
  conversations: [],
  chatStorageDir: vi.fn(),
  onAddSource: vi.fn(),
  onAddToWorkspace: vi.fn(async () => {}),
  onAddDeviceFolder: vi.fn(),
  onRemoveSource: vi.fn(),
  onToggleSourceReadOnly: vi.fn(),
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

import WorkspaceSourcesPanel from "../WorkspaceSourcesPanel";

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
  list: vi.fn(async (path) => ({
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
  })),
};

const arcanaProvider = {
  sourceId: "arcana-1",
  kind: "arcana-filesystem",
  status: "connected",
  capabilities: {},
  list: vi.fn(async () => ({
    entries: [
      { sourceId: "arcana-1", path: "/recipes", name: "recipes", kind: "dir" },
    ],
  })),
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

const renderPanel = (props = {}) =>
  render(
    <WorkspaceSourcesPanel
      workspaceId="ws-1"
      sources={mocks.sources}
      onAddSource={mocks.onAddSource}
      onAddToWorkspace={mocks.onAddToWorkspace}
      onAddDeviceFolder={mocks.onAddDeviceFolder}
      onRemoveSource={mocks.onRemoveSource}
      onToggleSourceReadOnly={mocks.onToggleSourceReadOnly}
      {...props}
    />,
  );

const drive = (guide) =>
  document.querySelector(`[data-guide="${guide}"]`);

const addButton = () =>
  document.querySelector('[data-guide="workspace-add-to-workspace"]');

beforeEach(() => {
  mocks.sources = [localSource, arcanaSource];
  mocks.providers = new Map([
    ["local-1", localProvider],
    ["arcana-1", arcanaProvider],
  ]);
  mocks.conversations = [{ id: "conv-uuid-1", title: "Planning chat" }];
  mocks.chatStorageDir.mockReset();
  mocks.chatStorageDir.mockResolvedValue(chatRoot());
  mocks.onAddSource.mockReset();
  mocks.onAddToWorkspace.mockReset();
  mocks.onAddDeviceFolder.mockReset();
  mocks.onRemoveSource.mockReset();
  mocks.onToggleSourceReadOnly.mockReset();
  localProvider.list.mockClear();
  arcanaProvider.list.mockClear();
});

describe("WorkspaceSourcesPanel", () => {
  it("renders the three drives and opens the add-source modal", () => {
    renderPanel();

    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Your Device")).toBeInTheDocument();
    expect(screen.getByText("Chats")).toBeInTheDocument();
    expect(screen.getByText("Arcanas")).toBeInTheDocument();
    expect(drive("workspace-source-device")).toBeInTheDocument();
    expect(drive("workspace-source-chats")).toBeInTheDocument();
    expect(drive("workspace-source-arcanas")).toBeInTheDocument();

    fireEvent.click(drive("workspace-sources-add"));
    expect(mocks.onAddSource).toHaveBeenCalledTimes(1);
  });

  it("opens Your Device and lists a local source's contents", async () => {
    renderPanel();

    fireEvent.click(drive("workspace-source-device"));
    fireEvent.click(await screen.findByText("Project"));

    expect(await screen.findByText("docs")).toBeInTheDocument();
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(localProvider.list).toHaveBeenCalledWith("/");

    fireEvent.click(screen.getByText("docs"));
    await waitFor(() => expect(localProvider.list).toHaveBeenCalledWith("/docs"));
    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
  });

  it("shows the device add-folder entry point only on the drive root", async () => {
    renderPanel();

    fireEvent.click(drive("workspace-source-device"));
    const addFolder = await screen.findByText("Add folder from this device");
    fireEvent.click(addFolder);
    expect(mocks.onAddDeviceFolder).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Project"));
    await screen.findByText("docs");
    expect(
      screen.queryByText("Add folder from this device"),
    ).not.toBeInTheDocument();
  });

  it("lists conversation titles instead of ids and opens a chat's OPFS tree", async () => {
    renderPanel();

    fireEvent.click(drive("workspace-source-chats"));
    expect(await screen.findByText("Planning chat")).toBeInTheDocument();
    expect(screen.queryByText("conv-uuid-1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Planning chat"));

    expect(await screen.findByText("draft.md")).toBeInTheDocument();
    expect(mocks.chatStorageDir).toHaveBeenCalledWith("conv-uuid-1");
    expect(screen.queryByText("conv-uuid-1")).not.toBeInTheDocument();
  });

  it("adds a selected local folder to the workspace", async () => {
    renderPanel();

    fireEvent.click(drive("workspace-source-device"));
    fireEvent.click(await screen.findByText("Project"));
    await screen.findByText("docs");
    expect(addButton()).toBeNull();

    fireEvent.click(screen.getByLabelText("docs"));
    expect(addButton()).toBeInTheDocument();
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
  });

  it("carries the conversation id when a chat row is added", async () => {
    renderPanel();

    fireEvent.click(drive("workspace-source-chats"));
    await screen.findByText("Planning chat");
    fireEvent.click(screen.getByLabelText("Planning chat"));
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(mocks.onAddToWorkspace).toHaveBeenCalledWith([
        expect.objectContaining({
          sourceId: "chat:conv-uuid-1",
          sourceKind: "chat",
          path: "/",
          name: "Planning chat",
          kind: "dir",
          conversationId: "conv-uuid-1",
        }),
      ]),
    );
  });

  it("hides Add to Workspace while nothing is selected", async () => {
    renderPanel();

    fireEvent.click(drive("workspace-source-chats"));
    await screen.findByText("Planning chat");

    expect(addButton()).toBeNull();
  });

  it("removes a local source without opening it", async () => {
    renderPanel();

    fireEvent.click(drive("workspace-source-device"));
    await screen.findByText("Project");

    fireEvent.click(screen.getByRole("button", { name: "Remove source" }));

    expect(mocks.onRemoveSource).toHaveBeenCalledWith(localSource);
    expect(localProvider.list).not.toHaveBeenCalled();
    expect(screen.getByText("Add folder from this device")).toBeInTheDocument();
  });

  it("toggles read-only on a local source without opening it", async () => {
    renderPanel();

    fireEvent.click(drive("workspace-source-device"));
    await screen.findByText("Project");

    fireEvent.click(
      screen.getByRole("button", { name: "Make source read-only" }),
    );

    expect(mocks.onToggleSourceReadOnly).toHaveBeenCalledWith(localSource);
    expect(localProvider.list).not.toHaveBeenCalled();
    expect(screen.getByText("Add folder from this device")).toBeInTheDocument();
  });
});
