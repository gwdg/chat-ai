import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

const mocks = vi.hoisted(() => ({
  fetchSessions: vi.fn(),
  switchSession: vi.fn(),
  createSession: vi.fn(),
  attach: vi.fn(async () => {}),
  hasAgentLink: vi.fn(async () => true),
  notifyError: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useSelector: (selector: any) => selector({}),
  useDispatch: () => vi.fn(),
}));
vi.mock("../../../Redux/reducers/interfaceSettingsSlice", () => ({
  selectCollapsedTopics: () => [],
  toggleTopic: (id: string) => ({ type: "toggleTopic", payload: id }),
}));
vi.mock("../../../db", () => ({
  useConversationList: () => [],
}));
vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceList: () => [
    { id: "ws-1", name: "Teaching", icon: "default", color: "default" },
  ],
  useWorkspaceChatLinks: () => [],
  useWorkspaceAgentLinks: () => [{ workspaceId: "ws-1", agentId: "agent-1" }],
  useWorkspaceAgentSessionLinks: () => [
    { workspaceId: "ws-1", agentId: "agent-1", sessionId: "session-1" },
  ],
  deleteWorkspace: vi.fn(),
  detachWorkspaceAgent: vi.fn(),
  detachWorkspaceChat: vi.fn(),
  attachWorkspaceAgentSession: (...args: any[]) => mocks.attach(...args),
  detachWorkspaceAgentSession: vi.fn(),
  hasWorkspaceAgentLink: (...args: any[]) => mocks.hasAgentLink(...args),
}));
vi.mock("../../../agents/agentStore", () => ({
  useAgents: () => [
    { id: "agent-1", name: "HPC agent", sessionId: "session-1" },
  ],
}));
vi.mock("../../../agents/agentSessions", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    fetchAgentSessions: (...args: any[]) => mocks.fetchSessions(...args),
    createAgentSession: (...args: any[]) => mocks.createSession(...args),
    switchAgentSession: (...args: any[]) => mocks.switchSession(...args),
    sessionSummariesFor: () => ({}),
  };
});
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn(), confirmAction: vi.fn() }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: mocks.notifyError }),
}));

import WorkspaceList from "../WorkspaceList";

const session = (id: string, title: string) => ({ id, title });

beforeEach(() => {
  mocks.fetchSessions.mockReset().mockResolvedValue({
    roots: [session("session-1", "Design session")],
    all: [
      session("session-1", "Design session"),
      session("session-2", "Session of another workspace"),
    ],
    children: new Map(),
  });
  mocks.switchSession.mockReset();
  mocks.createSession.mockReset();
  mocks.attach.mockReset();
  mocks.hasAgentLink.mockReset().mockResolvedValue(true);
});

describe("WorkspaceList agent sessions", () => {
  it("shows only the sessions attached to the workspace", async () => {
    render(
      <MemoryRouter>
        <WorkspaceList />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Design session")).toBeInTheDocument();
    expect(
      screen.queryByText("Session of another workspace"),
    ).not.toBeInTheDocument();
  });

  it("opens an attached session in the agent view", async () => {
    render(
      <MemoryRouter>
        <WorkspaceList />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("Design session"));

    await waitFor(() =>
      expect(mocks.switchSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: "agent-1" }),
        "session-1",
      ),
    );
  });

  it("creates a new session inside the workspace", async () => {
    mocks.createSession.mockResolvedValue({ id: "session-3" });
    render(
      <MemoryRouter>
        <WorkspaceList />
      </MemoryRouter>,
    );

    await screen.findByText("Design session");
    const addButtons = screen.getAllByTitle("New session");
    // The agent's own plus button, not the workspace-level one.
    fireEvent.click(addButtons[addButtons.length - 1]);

    await waitFor(() =>
      expect(mocks.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: "agent-1" }),
      ),
    );
    await waitFor(() =>
      expect(mocks.attach).toHaveBeenCalledWith(
        "ws-1",
        "agent-1",
        "session-3",
      ),
    );
  });
});
