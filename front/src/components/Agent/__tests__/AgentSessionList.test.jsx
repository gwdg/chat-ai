import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn(), confirmAction: vi.fn() }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));

import AgentSessionList from "../AgentSessionList";

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
