import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateAgent: vi.fn(),
  attach: vi.fn(async () => {}),
  detach: vi.fn(async () => {}),
  links: [],
  workspaces: [
    { id: "ws-1", name: "First project" },
    { id: "ws-2", name: "Second project" },
  ],
}));

vi.mock("../../../agents/agentStore", () => ({
  updateAgent: (...args) => mocks.updateAgent(...args),
}));
vi.mock("../../../db/workspaceDb", () => ({
  attachWorkspaceAgent: (...args) => mocks.attach(...args),
  detachWorkspaceAgent: (...args) => mocks.detach(...args),
  useAgentWorkspaceLinks: () => mocks.links,
  useWorkspaceList: () => mocks.workspaces,
}));

import AgentWorkspaceButton from "../AgentWorkspaceButton";

const agent = {
  id: "agent-1",
  name: "Example agent",
  bridgeEnabled: true,
  bridgeWorkspaceId: "ws-1",
};

const openPanel = async (overrides = {}) => {
  render(<AgentWorkspaceButton agent={{ ...agent, ...overrides }} />);
  fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
  return screen.findByRole("switch", { name: "Agent workspace access" });
};

beforeEach(() => {
  mocks.updateAgent.mockReset();
  mocks.attach.mockClear();
  mocks.detach.mockClear();
  mocks.links = [];
});

describe("AgentWorkspaceButton", () => {
  it("owns the workspace access switch", async () => {
    const toggle = await openPanel({ bridgeEnabled: false });

    expect(toggle).not.toBeChecked();
    expect(
      screen.getByText(/The agent cannot see workspace files/),
    ).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(mocks.updateAgent).toHaveBeenCalledWith("agent-1", {
      bridgeEnabled: true,
    });
  });

  it("offers the write and MCP options the file panel used to hold", async () => {
    mocks.links = [{ workspaceId: "ws-1" }];
    await openPanel({ bridgeWritable: false, bridgeMcp: false });

    fireEvent.click(screen.getByLabelText("Allow writes"));
    expect(mocks.updateAgent).toHaveBeenCalledWith("agent-1", {
      bridgeWritable: true,
    });

    fireEvent.click(screen.getByLabelText("Local MCP tools"));
    expect(mocks.updateAgent).toHaveBeenCalledWith("agent-1", {
      bridgeMcp: true,
    });
  });

  it("hides the access options while access is off", async () => {
    mocks.links = [{ workspaceId: "ws-1" }];
    await openPanel({ bridgeEnabled: false });

    expect(screen.queryByLabelText("Allow writes")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Local MCP tools")).not.toBeInTheDocument();
  });

  it("marks the active bridge workspace and switches to another attached one", async () => {
    mocks.links = [{ workspaceId: "ws-1" }, { workspaceId: "ws-2" }];
    await openPanel();

    expect(screen.getByText("Active")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use for the bridge" }));

    await waitFor(() =>
      expect(mocks.updateAgent).toHaveBeenCalledWith("agent-1", {
        bridgeWorkspaceId: "ws-2",
      }),
    );
  });

  it("attaches a workspace and makes it the bridge workspace when none is set", async () => {
    await openPanel({ bridgeWorkspaceId: null });

    fireEvent.click(screen.getByRole("button", { name: "First project" }));

    await waitFor(() =>
      expect(mocks.attach).toHaveBeenCalledWith("ws-1", "agent-1"),
    );
    expect(mocks.updateAgent).toHaveBeenCalledWith("agent-1", {
      bridgeWorkspaceId: "ws-1",
    });
  });

  it("detaches an attached workspace", async () => {
    mocks.links = [{ workspaceId: "ws-1" }];
    await openPanel();

    fireEvent.click(screen.getByRole("button", { name: "Second project" }));
    await waitFor(() =>
      expect(mocks.attach).toHaveBeenCalledWith("ws-2", "agent-1"),
    );

    fireEvent.click(screen.getByRole("button", { name: "First project" }));
    await waitFor(() =>
      expect(mocks.detach).toHaveBeenCalledWith("ws-1", "agent-1"),
    );
  });
});
