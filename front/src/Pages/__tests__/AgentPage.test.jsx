import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  agent: null,
  updateAgent: vi.fn(),
  workspaces: [],
  links: [],
  bridge: { status: "off", error: "", unavailable: false },
  bridgeCalls: [],
}));

vi.mock("react-router", () => ({
  useParams: () => ({ agentId: "agent-1" }),
  useSearchParams: () => [new URLSearchParams(""), () => {}],
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

// The page is a shell around the bridge wiring, so only the pieces that decide whether the
// bridge runs are real here.
vi.mock("../../components/Header/AnnouncementBar", () => ({ default: () => null }));
vi.mock("../../components/Header/Header", () => ({ default: () => null }));
vi.mock("../../components/Sidebar/SidebarWrapper", () => ({ default: () => null }));
vi.mock("../../components/Footer/CollapsibleFooter", () => ({ default: () => null }));
vi.mock("../../components/Agent/AgentConversation", () => ({ default: () => null }));
vi.mock("../../components/Agent/AgentFilesPanel", () => ({ default: () => null }));
vi.mock("../../components/DocumentPanel/FilePreviewPanel", () => ({
  default: () => null,
}));

vi.mock("../../agents/agentStore", () => ({
  useAgent: () => mocks.agent,
  updateAgent: (...args) => mocks.updateAgent(...args),
}));
vi.mock("../../agents/agentSessions", () => ({
  fetchAgentSessions: vi.fn(async () => ({ all: [] })),
  switchAgentSession: vi.fn(),
}));
vi.mock("../../hooks/useUpdateModelsData", () => ({ useUpdateModelsData: () => [] }));
vi.mock("../../hooks/useUpdateUserData", () => ({ useUpdateUserData: () => null }));
vi.mock("../../hooks/useOpencodeFilePreview", () => ({
  useOpencodeFilePreview: () => ({
    preview: null,
    openFile: vi.fn(),
    toggleFile: vi.fn(),
    openText: vi.fn(),
    closePreview: vi.fn(),
    download: vi.fn(),
  }),
}));
vi.mock("../../hooks/useAgentBridge", () => ({
  useAgentBridge: (input) => {
    mocks.bridgeCalls.push(input);
    return mocks.bridge;
  },
}));
vi.mock("../../db/workspaceDb", () => ({
  useWorkspaceList: () => mocks.workspaces,
  useAgentWorkspaceLinksState: () => mocks.links,
  useWorkspaceSources: () => [],
  useWorkspaceMounts: () => [],
}));
vi.mock("../../workspace/useWorkspaceProviders", () => ({
  useWorkspaceProviders: () => ({ providers: new Map() }),
}));
vi.mock("../../workspace/workspaceRoot", () => ({
  createWorkspaceRootProvider: () => null,
}));

import AgentPage from "../AgentPage";

const workspace = { id: "ws-1", name: "Workspace 1" };
const agent = {
  id: "agent-1",
  name: "Example agent",
  sessionId: "session-1",
  bridgeEnabled: true,
  bridgeWritable: true,
  bridgeMcp: true,
};

beforeEach(() => {
  mocks.agent = agent;
  mocks.updateAgent.mockReset();
  mocks.workspaces = [workspace];
  mocks.links = [];
  mocks.bridge = { status: "off", error: "", unavailable: false };
  mocks.bridgeCalls = [];
});

describe("AgentPage bridge settings", () => {
  it("does not clear bridge access while the workspace links are still loading", () => {
    // Dexie answers after the first render; acting on the empty placeholder switched a
    // running bridge off on every mount, and the user had to re-enable it after returning.
    mocks.links = undefined;

    render(<AgentPage />);

    expect(mocks.updateAgent).not.toHaveBeenCalled();
    expect(mocks.bridgeCalls.at(-1).workspaceId).toBeNull();
  });

  it("clears an access flag once the links show no attached workspace", () => {
    mocks.links = [];

    render(<AgentPage />);

    expect(mocks.updateAgent).toHaveBeenCalledWith("agent-1", {
      bridgeEnabled: false,
    });
  });

  it("keeps the bridge and its write/MCP settings for an attached workspace", () => {
    mocks.links = [{ workspaceId: "ws-1", agentId: "agent-1" }];

    render(<AgentPage />);

    expect(mocks.updateAgent).not.toHaveBeenCalled();
    expect(mocks.bridgeCalls.at(-1)).toMatchObject({
      workspaceId: "ws-1",
      writable: true,
      mcp: true,
    });
  });

  it("restores the same settings when switching back to a session", () => {
    mocks.links = [{ workspaceId: "ws-1", agentId: "agent-1" }];

    const { rerender } = render(<AgentPage />);
    mocks.agent = { ...agent, sessionId: "session-2", bridgeWritable: false };
    rerender(<AgentPage />);
    mocks.agent = agent;
    rerender(<AgentPage />);

    const args = mocks.bridgeCalls.at(-1);
    expect(args).toMatchObject({ workspaceId: "ws-1", writable: true, mcp: true });
    expect(mocks.updateAgent).not.toHaveBeenCalled();
  });
});
