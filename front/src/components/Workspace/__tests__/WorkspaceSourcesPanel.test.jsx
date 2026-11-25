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
};

const renderPanel = (props = {}) =>
  render(
    <WorkspaceSourcesPanel
      sources={mocks.sources}
      onOpenTarget={mocks.onOpenTarget}
      onAddSource={mocks.onAddSource}
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

    expect(screen.getByText("Storage locations")).toBeInTheDocument();
    expect(screen.getByText("Your Device")).toBeInTheDocument();
    expect(screen.getByText("Browser")).toBeInTheDocument();
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

  it("marks a broken source with a red circled exclamation", () => {
    mocks.sources = [
      localSource,
      browserSource,
      {
        ...arcanaSource,
        status: "error",
        error: "Arcana Tools is unreachable",
      },
    ];
    renderPanel();

    const badge = within(
      drive("workspace-source-arcanas"),
    ).getByRole("img", { name: /arcana filesystem could not be opened/i });
    expect(badge).toHaveAttribute(
      "title",
      "Arcana filesystem could not be opened: Arcana Tools is unreachable",
    );
    expect(badge).toHaveAttribute(
      "data-guide",
      "workspace-source-broken",
    );
    expect(
      within(drive("workspace-source-device")).queryByRole("img"),
    ).toBeNull();
    expect(
      within(drive("workspace-source-chats")).queryByRole("img"),
    ).toBeNull();
  });

  it("turns a bare network failure into a plain explanation", () => {
    mocks.sources = [
      localSource,
      browserSource,
      { ...arcanaSource, status: "error", error: "Failed to fetch" },
    ];
    renderPanel();

    const badge = within(
      drive("workspace-source-arcanas"),
    ).getByRole("img", { name: /could not be reached/i });
    expect(badge).toHaveAttribute(
      "title",
      "Arcana filesystem could not be reached — the service is not answering right now.",
    );
    expect(badge.getAttribute("title")).not.toMatch(/fetch/i);
  });

  it("explains the error in German too", async () => {
    const { default: i18n } = await import("../../../i18n");
    await act(async () => {
      await i18n.changeLanguage("de");
    });
    mocks.sources = [
      localSource,
      browserSource,
      { ...arcanaSource, status: "error", error: "Failed to fetch" },
    ];
    renderPanel();

    const badge = within(
      drive("workspace-source-arcanas"),
    ).getByRole("img", { name: /nicht erreichbar/i });
    expect(badge).toHaveAttribute(
      "title",
      "„Arcana filesystem“ ist nicht erreichbar — der Dienst antwortet gerade nicht.",
    );
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  it("treats a source that lost its permission as broken too", () => {
    mocks.sources = [
      { ...localSource, status: "needs-permission", error: "Permission denied" },
      browserSource,
      arcanaSource,
    ];
    renderPanel();

    const badge = within(drive("workspace-source-device")).getByRole("img", {
      name: /project has lost access permission/i,
    });
    expect(badge.getAttribute("title")).toContain("Permission denied");
  });

  it("explains an error on hover and pins it on click without opening the drive", () => {
    mocks.sources = [
      localSource,
      browserSource,
      {
        ...arcanaSource,
        status: "error",
        error: "Arcana Tools is unreachable",
      },
    ];
    renderPanel();

    const badge = within(
      drive("workspace-source-arcanas"),
    ).getByRole("img", { name: /could not be opened/i });
    const trigger = badge.closest(".cursor-help");
    expect(trigger).not.toBeNull();

    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Arcana filesystem could not be opened: Arcana Tools is unreachable",
    );
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.click(badge);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Arcana Tools is unreachable",
    );
    expect(mocks.onOpenTarget).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("tooltip")).toBeNull();
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

  it("routes the device card through onOpenDevice when a host provides one", async () => {
    const onOpenDevice = vi.fn();
    renderPanel({ onOpenDevice });

    fireEvent.click(drive("workspace-source-device"));
    fireEvent.click(drive("workspace-source-chats"));

    expect(onOpenDevice).toHaveBeenCalledTimes(1);
    expect(mocks.onOpenTarget.mock.calls).toEqual([[{ drive: "chats" }]]);
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

  it("omits the SAIA drive while the service is not available", async () => {
    renderPanel();

    expect(drive("workspace-source-saia-fs")).toBeNull();
    await act(async () => {});
  });

  it("opens the SAIA drive once the workspace has its account folder", async () => {
    mocks.sources = [...mocks.sources, saiaSource];
    mocks.providers = new Map([...mocks.providers, ["saia-1", saiaProvider]]);
    renderPanel();

    expect(
      within(drive("workspace-source-saia-fs")).getByText("Your SAIA account folder"),
    ).toBeInTheDocument();
    // The account folder's size is not exposed, so there is no meter and no usage line.
    expect(
      drive("workspace-source-saia-fs").querySelector("[data-quota-bar]"),
    ).toBeNull();

    fireEvent.click(drive("workspace-source-saia-fs"));
    expect(mocks.onOpenTarget).toHaveBeenCalledWith({ drive: "saia-fs" });

    await act(async () => {});
  });

  it("marks the SAIA drive active", async () => {
    mocks.sources = [...mocks.sources, saiaSource];
    mocks.providers = new Map([...mocks.providers, ["saia-1", saiaProvider]]);
    renderPanel({ activeTarget: { drive: "saia-fs" } });

    expect(drive("workspace-source-saia-fs")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await act(async () => {});
  });

  it("offers no add-folder row under the drives", async () => {
    renderPanel();
    expect(drive("workspace-sources-add-device-folder")).toBeNull();
    await act(async () => {});
  });
});
