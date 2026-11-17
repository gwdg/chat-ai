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
  onOpenTarget: vi.fn(),
  onAddSource: vi.fn(),
  onAddDeviceFolder: vi.fn(),
}));

vi.mock("../../../workspace/useWorkspaceProviders", () => ({
  useWorkspaceProviders: () => ({ providers: mocks.providers, reconnect: vi.fn() }),
}));
vi.mock("../../../db", () => ({
  useConversationList: () => mocks.conversations,
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

const browserSource = {
  id: "browser-1",
  workspaceId: "ws-1",
  kind: "browser",
  label: "Browser",
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

const localProvider = {
  sourceId: "local-1",
  kind: "local",
  status: "connected",
  capabilities: {},
  quota: vi.fn(),
};

const browserProvider = {
  sourceId: "browser-1",
  kind: "browser",
  status: "connected",
  capabilities: {},
  quota: vi.fn(),
};

const mcpProvider = {
  sourceId: "mcp-1",
  kind: "mcp",
  status: "connected",
  capabilities: {},
  quota: vi.fn(),
};

const arcanaProvider = {
  sourceId: "arcana-1",
  kind: "arcana-filesystem",
  status: "connected",
  capabilities: {},
  quota: vi.fn(),
};

const renderPanel = (props = {}) =>
  render(
    <WorkspaceSourcesPanel
      sources={mocks.sources}
      onOpenTarget={mocks.onOpenTarget}
      onAddSource={mocks.onAddSource}
      onAddDeviceFolder={mocks.onAddDeviceFolder}
      {...props}
    />,
  );

const drive = (guide) => document.querySelector(`[data-guide="${guide}"]`);

beforeEach(() => {
  mocks.sources = [localSource, browserSource, arcanaSource];
  mocks.providers = new Map([
    ["local-1", localProvider],
    ["browser-1", browserProvider],
    ["arcana-1", arcanaProvider],
  ]);
  mocks.conversations = [{ id: "conv-uuid-1", title: "Planning chat" }];
  mocks.onOpenTarget.mockReset();
  mocks.onAddSource.mockReset();
  mocks.onAddDeviceFolder.mockReset();
  localProvider.quota.mockReset();
  localProvider.quota.mockResolvedValue({
    usage: 512 * 1024,
    quota: 2 * 1024 * 1024,
    scope: "origin",
  });
  browserProvider.quota.mockReset();
  browserProvider.quota.mockResolvedValue({
    usage: 10 * 1024 * 1024,
    quota: 100 * 1024 * 1024,
    scope: "origin",
  });
  arcanaProvider.quota.mockReset();
  arcanaProvider.quota.mockResolvedValue({
    usage: 1 * 1024 * 1024,
    quota: 5 * 1024 * 1024,
    scope: "account",
  });
  mcpProvider.quota.mockReset();
  mcpProvider.quota.mockResolvedValue(null);
});

describe("WorkspaceSourcesPanel", () => {
  it("renders the three drives with subtitles and opens the add-source modal", async () => {
    renderPanel();

    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Your Device")).toBeInTheDocument();
    expect(screen.getByText("Chats")).toBeInTheDocument();
    expect(screen.getByText("Arcanas")).toBeInTheDocument();
    expect(within(drive("workspace-source-device")).getByText("1 folder")).toBeInTheDocument();
    expect(within(drive("workspace-source-chats")).getByText("1 chat")).toBeInTheDocument();
    expect(within(drive("workspace-source-arcanas")).getByText("1 collection")).toBeInTheDocument();

    fireEvent.click(drive("workspace-sources-add"));
    expect(mocks.onAddSource).toHaveBeenCalledTimes(1);
    await act(async () => {});
  });

  it("shows provider quotas and bars on the drive cards", async () => {
    renderPanel();

    await waitFor(() =>
      expect(
        within(drive("workspace-source-device")).getByText(
          "512 KB of 2.0 MB used",
        ),
      ).toBeInTheDocument(),
    );
    expect(localProvider.quota).toHaveBeenCalledTimes(1);
    expect(
      within(drive("workspace-source-chats")).getByText(
        "10 MB of 100 MB used",
      ),
    ).toBeInTheDocument();
    expect(drive("workspace-source-chats")).toHaveAttribute(
      "title",
      "10 MB of 100 MB used — shared with this app",
    );
    expect(drive("workspace-source-device")).toHaveAttribute(
      "title",
      "512 KB of 2.0 MB used",
    );
    expect(drive("workspace-source-arcanas")).toHaveAttribute(
      "title",
      "1.0 MB of 5.0 MB used",
    );
    expect(
      within(drive("workspace-source-arcanas")).getByText("1.0 MB of 5.0 MB used"),
    ).toBeInTheDocument();

    expect(
      drive("workspace-source-device").querySelector("[data-quota-bar]"),
    ).toHaveStyle({ width: "25%" });
    expect(
      drive("workspace-source-chats").querySelector("[data-quota-bar]"),
    ).toHaveStyle({ width: "10%" });
    expect(
      drive("workspace-source-arcanas").querySelector("[data-quota-bar]"),
    ).toHaveStyle({ width: "20%" });
  });

  it("marks the active drive, including a local source", async () => {
    renderPanel({ activeTarget: { drive: "chats" } });

    expect(drive("workspace-source-chats")).toHaveAttribute("aria-pressed", "true");
    expect(drive("workspace-source-device")).toHaveAttribute("aria-pressed", "false");
    expect(drive("workspace-source-arcanas")).toHaveAttribute("aria-pressed", "false");
    await act(async () => {});
  });

  it("marks Your Device active when one of its sources is open", async () => {
    renderPanel({ activeTarget: { drive: "device", sourceId: "local-1" } });

    expect(drive("workspace-source-device")).toHaveAttribute("aria-pressed", "true");
    await act(async () => {});
  });

  it("opens each drive through onOpenTarget", async () => {
    renderPanel();

    fireEvent.click(drive("workspace-source-device"));
    fireEvent.click(drive("workspace-source-chats"));
    fireEvent.click(drive("workspace-source-arcanas"));

    expect(mocks.onOpenTarget.mock.calls).toEqual([
      [{ drive: "device" }],
      [{ drive: "chats" }],
      [{ drive: "arcanas" }],
    ]);
    await act(async () => {});
  });

  it("omits the MCP drive when the workspace has no MCP sources", async () => {
    renderPanel();

    expect(drive("workspace-source-mcp")).toBeNull();
    await act(async () => {});
  });

  it("opens the MCP drive when the workspace has an MCP source", async () => {
    mocks.sources = [...mocks.sources, mcpSource];
    mocks.providers = new Map([...mocks.providers, ["mcp-1", mcpProvider]]);
    renderPanel();

    expect(
      within(drive("workspace-source-mcp")).getByText("1 server"),
    ).toBeInTheDocument();
    expect(
      drive("workspace-source-mcp").querySelector("[data-quota-bar]"),
    ).toBeNull();
    expect(drive("workspace-source-mcp")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(drive("workspace-source-mcp"));
    expect(mocks.onOpenTarget).toHaveBeenCalledWith({ drive: "mcp" });

    await act(async () => {});
  });

  it("marks the MCP drive active", async () => {
    mocks.sources = [...mocks.sources, mcpSource];
    mocks.providers = new Map([...mocks.providers, ["mcp-1", mcpProvider]]);
    renderPanel({ activeTarget: { drive: "mcp" } });

    expect(drive("workspace-source-mcp")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await act(async () => {});
  });

  it("fires the add-folder row", async () => {
    renderPanel();
    fireEvent.click(drive("workspace-sources-add-device-folder"));
    expect(mocks.onAddDeviceFolder).toHaveBeenCalledTimes(1);
    await act(async () => {});
  });

  it("omits the add-folder row without a handler", async () => {
    renderPanel({ onAddDeviceFolder: undefined });
    expect(drive("workspace-sources-add-device-folder")).toBeNull();
    await act(async () => {});
  });
});
