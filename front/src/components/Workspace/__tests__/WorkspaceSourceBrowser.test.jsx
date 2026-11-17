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

const arcanaProvider = {
  sourceId: "arcana-1",
  kind: "arcana-filesystem",
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

  it("drills into a source and adds the selected folder to the workspace", async () => {
    renderBrowser({ target: { drive: "device" } });

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
    await waitFor(() => expect(addButton()).toBeNull());
  });

  it("lists chats by title and opens a chat's files", async () => {
    renderBrowser({ target: { drive: "chats" } });

    expect(await screen.findByText("Planning chat")).toBeInTheDocument();
    expect(screen.queryByText("conv-uuid-1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Planning chat"));
    expect(await screen.findByText("draft.md")).toBeInTheDocument();
    expect(mocks.chatStorageDir).toHaveBeenCalledWith("conv-uuid-1");
  });

  it("selects every visible row with Select all", async () => {
    renderBrowser({ target: { drive: "chats" } });

    await screen.findByText("Planning chat");
    fireEvent.click(screen.getByLabelText("Select all"));

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(addButton()).toBeInTheDocument();
  });

  it("browses the arcana collection", async () => {
    renderBrowser({ target: { drive: "arcanas" } });

    expect(await screen.findByText("recipes")).toBeInTheDocument();
    expect(arcanaProvider.list).toHaveBeenCalledWith("/");
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
