import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  panels: [],
  agents: [],
  agentLinks: [],
  sessionLinks: [],
  chatLinks: [],
  workspaceChatLinks: [],
  workspaceList: [],
  fetchSessions: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useSelector: (selector) => selector({}),
}));
vi.mock("../../../Redux/reducers/userSettingsReducer", () => ({
  selectUserSettings: (state) => state,
}));
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/workspace/ws-1", search: "" }),
}));
vi.mock("../../../db/workspaceDb", () => ({
  useChatWorkspaces: () => mocks.chatLinks,
  useWorkspaceList: () => mocks.workspaceList,
  useWorkspaceAgentLinks: () => mocks.agentLinks,
  useWorkspaceAgentSessionLinks: () => mocks.sessionLinks,
  useWorkspaceChatLinks: () => mocks.workspaceChatLinks,
  seedWorkspaceAgentSessions: vi.fn(),
}));
vi.mock("../../../agents/agentStore", () => ({
  useAgents: () => mocks.agents,
}));
vi.mock("../../../agents/agentSessions", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchAgentSessions: (...args) => mocks.fetchSessions(...args),
    sessionSummariesFor: () => ({}),
  };
});
vi.mock("../../../apis/opencodeAgents", () => ({
  getOpencodeInfo: vi.fn(async () => ({})),
  getOpencodeSession: vi.fn(async () => null),
  getOpencodeSessionStatus: vi.fn(async () => ({})),
  listOpencodeFiles: vi.fn(async () => []),
  listOpencodeMessages: vi.fn(async () => []),
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn(), confirmAction: vi.fn() }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));
vi.mock("../../Meta/MetaChangesPanel", () => ({
  default: (props) => {
    mocks.panels.push(props);
    return null;
  },
}));
vi.mock("../WorkspaceAgentPanel", () => ({
  default: ({ workspaceId }) => (
    <div data-testid={`agent-panel-${workspaceId}`} />
  ),
}));

import ChatAgentSidebar from "../ChatAgentSidebar";

const lastPanel = () => mocks.panels[mocks.panels.length - 1];

beforeEach(() => {
  mocks.panels = [];
  mocks.agents = [
    { id: "agent-1", name: "HPC agent", sessionId: "session-1" },
  ];
  mocks.agentLinks = [{ workspaceId: "ws-1", agentId: "agent-1" }];
  mocks.sessionLinks = [
    { workspaceId: "ws-1", agentId: "agent-1", sessionId: "session-1" },
    { workspaceId: "ws-1", agentId: "agent-1", sessionId: "session-2" },
    // Another workspace of the same agent must not leak into this chat.
    { workspaceId: "ws-9", agentId: "agent-1", sessionId: "session-9" },
  ];
  mocks.chatLinks = [{ conversationId: "chat-1", workspaceId: "ws-1" }];
  mocks.workspaceList = [{ id: "ws-1", name: "Research" }];
  mocks.workspaceChatLinks = [
    { workspaceId: "ws-1", conversationId: "chat-1" },
    { workspaceId: "ws-1", conversationId: "chat-2" },
    { workspaceId: "ws-9", conversationId: "chat-9" },
  ];
  mocks.fetchSessions.mockReset().mockResolvedValue({
    roots: [],
    all: [],
    children: new Map(),
  });
});

describe("ChatAgentSidebar what's new scope", () => {
  it("adds an Agents tab that picks the agent of the chat's workspaces", () => {
    render(<ChatAgentSidebar conversationId="chat-1" />);

    const tabs = lastPanel().tabs;
    expect(tabs.map((tab) => tab.id)).toEqual(["files", "agents", "preview"]);
    const agentsTab = tabs.find((tab) => tab.id === "agents");
    expect(agentsTab.label).toBe("Agents");
    expect(render(agentsTab.content).getByTestId("agent-panel-ws-1")).toBeInTheDocument();
  });

  it("names every workspace when the chat is attached to several", () => {
    mocks.chatLinks = [
      { conversationId: "chat-1", workspaceId: "ws-1" },
      { conversationId: "chat-1", workspaceId: "ws-2" },
    ];
    mocks.workspaceList = [
      { id: "ws-1", name: "Research" },
      { id: "ws-2", name: "Notes" },
    ];
    render(<ChatAgentSidebar conversationId="chat-1" />);

    const tab = lastPanel().tabs.find((item) => item.id === "agents");
    const view = render(tab.content);
    expect(view.getByText("Research")).toBeInTheDocument();
    expect(view.getByText("Notes")).toBeInTheDocument();
    expect(view.getByTestId("agent-panel-ws-1")).toBeInTheDocument();
    expect(view.getByTestId("agent-panel-ws-2")).toBeInTheDocument();
  });

  it("reports only the chat's workspaces, agents and attached sessions", () => {
    render(<ChatAgentSidebar conversationId="chat-1" />);

    expect(lastPanel().scopeKey).toBe("ws-1");
    expect(lastPanel().scope).toEqual({
      agentIds: ["agent-1"],
      sessionIds: { "agent-1": ["session-1", "session-2"] },
      conversationIds: ["chat-1", "chat-2"],
    });
  });

  it("offers the same Files, Agents and Preview tabs as the workspace page", () => {
    render(<ChatAgentSidebar conversationId="chat-1" />);

    const tabs = lastPanel().tabs ?? [];
    expect(tabs.map((tab) => tab.id)).toEqual(["files", "agents", "preview"]);
    expect(tabs.map((tab) => tab.label)).toEqual([
      "Files",
      "Agents",
      "Preview",
    ]);
    expect(tabs.every((tab) => tab.content)).toBe(true);
  });

  it("does not repeat the connected agents below the report", () => {
    render(<ChatAgentSidebar conversationId="chat-1" />);

    expect(lastPanel().children).toBeUndefined();
  });

  it("shows the scoped report for a workspace chat without agents", () => {
    mocks.agents = [];
    mocks.agentLinks = [];

    render(<ChatAgentSidebar conversationId="chat-1" />);

    expect(lastPanel().scope).toEqual({
      agentIds: [],
      sessionIds: {},
      conversationIds: ["chat-1", "chat-2"],
    });
  });

  it("renders nothing when the chat is not attached to a workspace", () => {
    mocks.chatLinks = [];

    render(<ChatAgentSidebar conversationId="chat-1" />);

    expect(mocks.panels).toHaveLength(0);
  });

  it("keeps the full session list of an agent bridged to the workspace", () => {
    mocks.agents = [
      { id: "agent-2", name: "Bridged agent", bridgeWorkspaceId: "ws-1" },
    ];
    mocks.agentLinks = [];
    mocks.sessionLinks = [];

    render(<ChatAgentSidebar conversationId="chat-1" />);

    expect(lastPanel().scope).toEqual({
      agentIds: ["agent-2"],
      sessionIds: {},
      conversationIds: ["chat-1", "chat-2"],
    });
  });
});
