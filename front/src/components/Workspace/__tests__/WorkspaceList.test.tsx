import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";

const mocks = vi.hoisted(() => ({
  fetchSessions: vi.fn(),
  switchSession: vi.fn(),
  createSession: vi.fn(),
  attach: vi.fn(async () => {}),
  hasAgentLink: vi.fn(async () => true),
  sessionLinks: vi.fn(),
  chatLinks: vi.fn(),
  conversations: vi.fn(),
  notifyError: vi.fn(),
  workspaces: vi.fn(),
  setPinned: vi.fn(async () => {}),
}));

vi.mock("../../../db", () => ({
  useConversationList: () => mocks.conversations(),
}));
vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceList: () => mocks.workspaces(),
  setWorkspacePinned: (...args: any[]) => mocks.setPinned(...args),
  useWorkspaceChatLinks: () => mocks.chatLinks(),
  useWorkspaceAgentLinks: () => [{ workspaceId: "ws-1", agentId: "agent-1" }],
  useWorkspaceAgentSessionLinks: () => mocks.sessionLinks(),
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

import WorkspaceList, {
  workspaceAgentCollapseId,
  workspaceRowCollapseId,
} from "../WorkspaceList";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";

const session = (id: string, title: string) => ({ id, title });

const makeStore = () =>
  configureStore({ reducer: { interface_settings: interfaceSettingsReducer } });

const renderList = (
  store: ReturnType<typeof makeStore>,
  initialEntries: string[] = ["/"],
) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={initialEntries}>
        <WorkspaceList />
      </MemoryRouter>
    </Provider>,
  );

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
  mocks.sessionLinks.mockReset().mockReturnValue([
    { workspaceId: "ws-1", agentId: "agent-1", sessionId: "session-1" },
  ]);
  mocks.chatLinks.mockReset().mockReturnValue([]);
  mocks.conversations.mockReset().mockReturnValue([]);
  mocks.workspaces.mockReset().mockReturnValue([
    { id: "ws-1", name: "Teaching", icon: "default", color: "violet" },
  ]);
  mocks.setPinned.mockReset();
});

describe("WorkspaceList pinning", () => {
  it("pins a workspace from its options menu", async () => {
    renderList(makeStore());

    fireEvent.click(
      await screen.findByRole("button", { name: "Workspace options" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Pin workspace" }));

    await waitFor(() =>
      expect(mocks.setPinned).toHaveBeenCalledWith("ws-1", true),
    );
  });

  it("leaves pinned workspaces to the pinned section", async () => {
    mocks.workspaces.mockReturnValue([
      {
        id: "ws-1",
        name: "Teaching",
        icon: "default",
        color: "violet",
        pinned: true,
      },
    ]);
    renderList(makeStore());

    await waitFor(() =>
      expect(screen.queryByText("Teaching")).not.toBeInTheDocument(),
    );
  });
});

describe("WorkspaceList agent sessions", () => {
  it("shows only the sessions attached to the workspace", async () => {
    const store = makeStore();
    renderList(store);

    expect(await screen.findByText("Design session")).toBeInTheDocument();
    expect(
      screen.queryByText("Session of another workspace"),
    ).not.toBeInTheDocument();
  });

  it("collapses and expands the sessions of one agent", async () => {
    const store = makeStore();
    renderList(store);

    expect(await screen.findByText("Design session")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Sessions" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(screen.queryByText("Design session")).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(await screen.findByText("Design session")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("remembers a collapsed agent row after a remount", async () => {
    const store = makeStore();
    const first = renderList(store);

    expect(await screen.findByText("Design session")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));
    expect(
      store.getState().interface_settings.collapsed_topics,
    ).toContain(workspaceAgentCollapseId("ws-1", "agent-1"));

    first.unmount();
    renderList(store);

    await screen.findByText("HPC agent");
    expect(screen.queryByText("Design session")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sessions" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("remembers a collapsed workspace row after a remount", async () => {
    const store = makeStore();
    const first = renderList(store);

    await screen.findByText("HPC agent");
    fireEvent.click(
      screen.getByRole("button", { name: "Attached chats, agents and sessions" }),
    );
    expect(
      store.getState().interface_settings.collapsed_topics,
    ).toContain(workspaceRowCollapseId("ws-1"));
    expect(screen.queryByText("HPC agent")).not.toBeInTheDocument();

    first.unmount();
    renderList(store);

    expect(await screen.findByText("Teaching")).toBeInTheDocument();
    expect(screen.queryByText("HPC agent")).not.toBeInTheDocument();
  });

  it("keeps the toggle of an agent without sessions disabled", async () => {
    mocks.sessionLinks.mockReturnValue([]);
    const store = makeStore();
    renderList(store);

    await screen.findByText("HPC agent");
    expect(screen.getByRole("button", { name: "Sessions" })).toBeDisabled();
  });

  it("opens an attached session in the agent view", async () => {
    const store = makeStore();
    renderList(store);

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
    const store = makeStore();
    renderList(store);

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

  it("highlights the open chat and no agent session", async () => {
    mocks.conversations.mockReturnValue([
      { id: "chat-1", title: "Workspace chat" },
    ]);
    mocks.chatLinks.mockReturnValue([
      { workspaceId: "ws-1", conversationId: "chat-1" },
    ]);
    renderList(makeStore(), ["/chat/chat-1"]);

    const chat = await screen.findByRole("button", { name: "Workspace chat" });
    expect(chat).toHaveAttribute("aria-current", "page");
    const session = await screen.findByText("Design session");
    expect(session.closest("button")).not.toHaveAttribute("aria-current");
    expect(
      screen.getByText("HPC agent").closest("button"),
    ).not.toHaveAttribute("aria-current");
  });

  it("highlights the open agent and its session", async () => {
    renderList(makeStore(), ["/agent/agent-1"]);

    const session = await screen.findByText("Design session");
    expect(session.closest("button")).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("HPC agent").closest("button")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("WorkspaceList group colours", () => {
  const rowFor = () =>
    screen.getByText("Teaching").closest("[style]") as HTMLElement;
  const rulesFor = () =>
    screen.getByText("HPC agent").closest("[style]") as HTMLElement;

  it("washes the workspace name in its colour and brackets its chats on both sides", async () => {
    renderList(makeStore());

    await screen.findByText("Teaching");
    const row = rowFor();
    // #7C3AED: 8% behind the name in light mode.
    expect(row.style.getPropertyValue("--group-tint")).toBe(
      "rgba(124, 58, 237, 0.08)",
    );
    expect(row.style.getPropertyValue("--group-tint-hover")).toBe(
      "rgba(124, 58, 237, 0.12)",
    );
    // The name row carries no vertical rules; only the rows below are bracketed.
    expect(row.className).not.toContain("border-l-2");
    expect(row.className).not.toContain("border-r-2");

    const rules = rulesFor();
    expect(rules.className).toContain("border-x-2");
    expect(rules.style.borderLeftColor).toBe("rgba(124, 58, 237, 0.35)");
    expect(rules.style.borderRightColor).toBe("rgba(124, 58, 237, 0.35)");
  });

  it("marks the open workspace with a stronger wash and an accent name", async () => {
    renderList(makeStore(), ["/workspace/ws-1"]);

    await screen.findByText("Teaching");
    const row = rowFor();
    expect(row.style.getPropertyValue("--group-tint")).toBe(
      "rgba(124, 58, 237, 0.16)",
    );
    expect(row.className).toContain("text-accent");
  });
});
