import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchSessions: vi.fn(),
  attachAgent: vi.fn(async () => {}),
  attachSession: vi.fn(async () => {}),
  detachSession: vi.fn(async () => {}),
}));

vi.mock("../../../db/workspaceDb", () => ({
  attachWorkspaceAgent: (...args) => mocks.attachAgent(...args),
  attachWorkspaceAgentSession: (...args) => mocks.attachSession(...args),
  detachWorkspaceAgentSession: (...args) => mocks.detachSession(...args),
}));

vi.mock("../../../agents/agentSessions", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchAgentSessions: (...args) => mocks.fetchSessions(...args),
  };
});

import AttachAgentSessionModal from "../AttachAgentSessionModal";

const tree = (roots, children = []) => ({
  roots,
  all: roots,
  children: new Map(children.map(([parent, kids]) => [parent.id, kids])),
});

const agents = [
  { id: "agent-1", name: "HPC agent" },
  { id: "agent-2", name: "Coder" },
];

const alpha = { id: "sess-1", title: "Alpha" };
const beta = { id: "sess-2", title: "Beta" };
const alphaChild = { id: "sess-1a", title: "Alpha sub", parentID: "sess-1" };
const gamma = { id: "sess-3", title: "Gamma" };

beforeEach(() => {
  mocks.fetchSessions.mockReset();
  mocks.attachAgent.mockClear();
  mocks.attachSession.mockClear();
  mocks.detachSession.mockClear();
  mocks.fetchSessions.mockImplementation(async (agent) =>
    agent.id === "agent-1"
      ? tree([alpha, beta], [[alpha, [alphaChild]]])
      : tree([gamma]),
  );
});

describe("AttachAgentSessionModal picker", () => {
  it("groups the unattached sessions by agent", async () => {
    render(
      <AttachAgentSessionModal
        isOpen
        workspaceId="ws-1"
        agents={agents}
        sessionLinks={[
          { workspaceId: "ws-1", agentId: "agent-1", sessionId: "sess-2" },
        ]}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText("HPC agent")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Alpha sub")).toBeInTheDocument();
    // Beta is already attached to this workspace.
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    expect(screen.getByText("Coder")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("attaches the picked session and links its agent", async () => {
    render(
      <AttachAgentSessionModal
        isOpen
        workspaceId="ws-1"
        agents={agents}
        sessionLinks={[]}
        onClose={() => {}}
      />,
    );

    fireEvent.click(await screen.findByText("Gamma"));

    await waitFor(() =>
      expect(mocks.attachSession).toHaveBeenCalledWith(
        "ws-1",
        "agent-2",
        "sess-3",
      ),
    );
    expect(mocks.attachAgent).toHaveBeenCalledWith("ws-1", "agent-2");
    expect(
      await screen.findByText("Gamma attached to this workspace."),
    ).toBeInTheDocument();
    // The agent has no unattached session left, so its group disappears.
    await waitFor(() =>
      expect(screen.queryByText("Coder")).not.toBeInTheDocument(),
    );
  });

  it("reports when every session is already attached", async () => {
    render(
      <AttachAgentSessionModal
        isOpen
        workspaceId="ws-1"
        agents={agents}
        sessionLinks={[
          { workspaceId: "ws-1", agentId: "agent-1", sessionId: "sess-1" },
          { workspaceId: "ws-1", agentId: "agent-1", sessionId: "sess-1a" },
          { workspaceId: "ws-1", agentId: "agent-1", sessionId: "sess-2" },
          { workspaceId: "ws-1", agentId: "agent-2", sessionId: "sess-3" },
        ]}
        onClose={() => {}}
      />,
    );

    expect(
      await screen.findByText("Every session is already attached to this workspace."),
    ).toBeInTheDocument();
  });

  it("keeps listing the other agents when one cannot be reached", async () => {
    mocks.fetchSessions.mockImplementation(async (agent) => {
      if (agent.id === "agent-2") throw new Error("server down");
      return tree([alpha]);
    });

    render(
      <AttachAgentSessionModal
        isOpen
        workspaceId="ws-1"
        agents={agents}
        sessionLinks={[]}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(await screen.findByText("Coder: server down")).toBeInTheDocument();
  });
});

describe("AttachAgentSessionModal single agent", () => {
  it("toggles a session of the given agent", async () => {
    render(
      <AttachAgentSessionModal
        isOpen
        workspaceId="ws-1"
        agent={agents[0]}
        attachedIds={["sess-2"]}
        onClose={() => {}}
      />,
    );

    fireEvent.click(await screen.findByText("Alpha"));

    await waitFor(() =>
      expect(mocks.attachSession).toHaveBeenCalledWith(
        "ws-1",
        "agent-1",
        "sess-1",
      ),
    );
  });
});
