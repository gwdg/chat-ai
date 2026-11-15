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

    fireEvent.click(screen.getByLabelText("Session options"));
    fireEvent.click(screen.getByText("Remove from workspace"));

    expect(onDetach).toHaveBeenCalledWith(session);
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
