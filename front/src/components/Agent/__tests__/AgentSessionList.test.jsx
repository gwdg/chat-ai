import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn(), confirmAction: vi.fn() }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));

import AgentSessionList from "../AgentSessionList";
import {
  AGENT_SESSION_DRAG_MIME,
  AGENT_SESSION_SOURCE_WORKSPACE_MIME,
} from "../../Sidebar/sessionDrop";

const session = { id: "session-1", title: "Refactor the parser" };

const treeOf = (sessions) => ({
  roots: sessions,
  all: sessions,
  children: new Map(),
});

const workspaces = [
  { id: "ws-1", name: "Research" },
  { id: "ws-2", name: "Thesis" },
];

const openSessionMenu = () => {
  fireEvent.click(screen.getByLabelText("Session options"));
};

describe("AgentSessionList workspace view", () => {
  it("shows no robot icon beside a top-level session", () => {
    const child = { id: "session-2", title: "Child session" };
    render(
      <AgentSessionList
        agent={{ id: "agent-1", sessionId: "session-1" }}
        tree={{
          roots: [session],
          all: [session, child],
          children: new Map([[session.id, [child]]]),
        }}
        activeSessionId="session-1"
        onSelect={vi.fn()}
      />,
    );

    // Status dot and label only.
    expect(
      screen
        .getByText(session.title)
        .closest("button")
        .querySelectorAll("svg"),
    ).toHaveLength(0);
    // A subagent keeps the branch marker that shows the nesting.
    expect(
      screen.getByText(child.title).closest("button").querySelectorAll("svg"),
    ).toHaveLength(1);
  });

  it("offers removing a session from the workspace", () => {
    const onDetach = vi.fn();
    render(
      <AgentSessionList
        agent={{ id: "agent-1", sessionId: "session-1" }}
        tree={treeOf([session])}
        activeSessionId="session-1"
        onSelect={vi.fn()}
        onDetach={onDetach}
      />,
    );

    openSessionMenu();
    fireEvent.click(screen.getByText("Remove from workspace"));

    expect(onDetach).toHaveBeenCalledWith(session);
  });

  it("attaches a session to one of the agent's workspaces from its menu", () => {
    const onToggleWorkspace = vi.fn();
    render(
      <AgentSessionList
        agent={{ id: "agent-1", sessionId: "session-1" }}
        tree={treeOf([session])}
        activeSessionId="session-1"
        onSelect={vi.fn()}
        workspaces={workspaces}
        sessionWorkspaceIds={new Map()}
        onToggleWorkspace={onToggleWorkspace}
      />,
    );

    openSessionMenu();

    expect(screen.getByText("Attach to workspace")).toBeInTheDocument();
    const target = screen.getByRole("button", { name: "Research" });
    expect(target).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(target);

    expect(onToggleWorkspace).toHaveBeenCalledWith("ws-1", session, true);
  });

  it("removes a session from a workspace it is already in", () => {
    const onToggleWorkspace = vi.fn();
    render(
      <AgentSessionList
        agent={{ id: "agent-1", sessionId: "session-1" }}
        tree={treeOf([session])}
        activeSessionId="session-1"
        onSelect={vi.fn()}
        workspaces={workspaces}
        sessionWorkspaceIds={new Map([["session-1", new Set(["ws-1"])]])}
        onToggleWorkspace={onToggleWorkspace}
      />,
    );

    openSessionMenu();

    expect(screen.getByRole("button", { name: "Research" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Thesis" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Research" }));

    expect(onToggleWorkspace).toHaveBeenCalledWith("ws-1", session, false);
  });

  it("offers no workspace choice for an agent without workspaces", () => {
    render(
      <AgentSessionList
        agent={{ id: "agent-1", sessionId: "session-1" }}
        tree={treeOf([session])}
        activeSessionId="session-1"
        onSelect={vi.fn()}
        workspaces={[]}
        onToggleWorkspace={vi.fn()}
      />,
    );

    openSessionMenu();

    expect(screen.queryByText("Attach to workspace")).toBeNull();
  });

  it("marks a session list that came from the offline cache", () => {
    render(
      <AgentSessionList
        agent={{ id: "agent-1", sessionId: "session-1" }}
        tree={{ ...treeOf([session]), offline: true }}
        activeSessionId="session-1"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId("agent-sessions-cached")).toHaveTextContent(
      "cached",
    );
  });

  it("hides the heading and shows a workspace-specific empty message", () => {
    render(
      <AgentSessionList
        agent={{ id: "agent-1" }}
        tree={treeOf([])}
        showHeader={false}
        showCreate={false}
        emptyKey="agents.no_workspace_sessions"
      />,
    );

    expect(screen.queryByText("Sessions")).toBeNull();
    expect(
      screen.getByText("No sessions attached to this workspace yet."),
    ).toBeInTheDocument();
  });
});

describe("AgentSessionList drag & drop", () => {
  // jsdom has no working DataTransfer, so the rows get a small stand-in with
  // the three members the drag helpers use.
  const makeDataTransfer = (entries = {}) => {
    const data = new Map(Object.entries(entries));
    return {
      get types() {
        return [...data.keys()];
      },
      getData: (type) => data.get(type) ?? "",
      setData: (type, value) => {
        data.set(type, value);
      },
      effectAllowed: "none",
      dropEffect: "none",
    };
  };

  const renderList = (props = {}) =>
    render(
      <AgentSessionList
        agent={{ id: "agent-1", sessionId: "session-1" }}
        tree={treeOf([session])}
        activeSessionId="session-1"
        onSelect={vi.fn()}
        {...props}
      />,
    );

  it("carries the agent, session and source workspace on drag", () => {
    renderList({ dragSourceWorkspaceId: "ws-1" });

    const row = screen
      .getByText("Refactor the parser")
      .closest("[draggable]");
    expect(row).toHaveAttribute("draggable", "true");

    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(row, { dataTransfer });

    expect(JSON.parse(dataTransfer.getData(AGENT_SESSION_DRAG_MIME))).toEqual({
      agentId: "agent-1",
      sessionId: "session-1",
    });
    expect(dataTransfer.getData(AGENT_SESSION_SOURCE_WORKSPACE_MIME)).toBe(
      "ws-1",
    );
    expect(dataTransfer.effectAllowed).toBe("move");
  });

  it("marks an unassigned session with no source workspace", () => {
    renderList({ dragSourceWorkspaceId: null });

    const row = screen
      .getByText("Refactor the parser")
      .closest("[draggable]");
    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(row, { dataTransfer });

    expect(dataTransfer.getData(AGENT_SESSION_SOURCE_WORKSPACE_MIME)).toBe("");
    expect(dataTransfer.getData(AGENT_SESSION_DRAG_MIME)).toContain(
      '"sessionId":"session-1"',
    );
  });
});
