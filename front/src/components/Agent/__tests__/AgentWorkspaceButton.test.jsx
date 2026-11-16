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

const openPanel = async (agentOverrides = {}, props = {}) => {
  render(
    <AgentWorkspaceButton
      agent={{ ...agent, ...agentOverrides }}
      {...props}
    />,
  );
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
    mocks.links = [{ workspaceId: "ws-1" }];
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

  it("cannot switch access on while no workspace is attached", async () => {
    // Only an attachment connects a workspace; a remembered choice must not borrow another
    // workspace of the account for the agent.
    const toggle = await openPanel({
      bridgeEnabled: true,
      bridgeWorkspaceId: "ws-2",
    });

    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/Attach a workspace first/)).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("disables the bridge options while no workspace is attached", async () => {
    await openPanel({ bridgeEnabled: true, bridgeWorkspaceId: "ws-2" });

    expect(screen.getByLabelText("Allow writes")).toBeDisabled();
    expect(screen.getByLabelText("Local MCP tools")).toBeDisabled();
  });

  it("switches access off when the last workspace is detached", async () => {
    mocks.links = [{ workspaceId: "ws-1" }];
    await openPanel();

    fireEvent.click(screen.getByRole("button", { name: "First project" }));

    await waitFor(() =>
      expect(mocks.detach).toHaveBeenCalledWith("ws-1", "agent-1"),
    );
    expect(mocks.updateAgent).toHaveBeenCalledWith("agent-1", {
      bridgeWorkspaceId: null,
      bridgeEnabled: false,
    });
  });

  it("keeps the bridge options under the status and the workspaces last", async () => {
    // The bridge reads top-down, so its options follow the status; the workspaces are the
    // section that is chosen from the options, hence they come last.
    mocks.links = [{ workspaceId: "ws-1" }];
    await openPanel({}, { bridgeStatus: "online" });

    const follows = (first, second) =>
      Boolean(
        first.compareDocumentPosition(second) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      );

    const status = screen.getByRole("status");
    const options = screen.getByText("Options");
    const workspaces = screen.getByText("Workspace");

    expect(follows(status, options)).toBe(true);
    expect(follows(options, workspaces)).toBe(true);
    expect(
      follows(workspaces, screen.getByRole("button", { name: "Second project" })),
    ).toBe(true);
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

  it("reports a working bridge in green", async () => {
    mocks.links = [{ workspaceId: "ws-1" }];
    await openPanel({}, { bridgeStatus: "online" });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Agent bridge working");
    expect(status.querySelector(".status-success")).not.toBeNull();
  });

  it("reports a failing bridge in red with its reason", async () => {
    mocks.links = [{ workspaceId: "ws-1" }];
    await openPanel(
      {},
      { bridgeStatus: "error", bridgeError: "Bridge session failed (502)" },
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Agent bridge not working");
    expect(status.querySelector(".status-error")).not.toBeNull();
    expect(
      screen.getByText("Bridge session failed (502)"),
    ).toBeInTheDocument();
  });

  it("stays red and off after a bridge that could not start", async () => {
    // The page switched access off because the bridge failed; the switch reflects that and
    // the popover keeps the reason instead of pretending everything is fine.
    mocks.links = [{ workspaceId: "ws-1" }];
    const toggle = await openPanel(
      { bridgeEnabled: false },
      { bridgeFailure: "Bridge session failed (502)" },
    );

    expect(toggle).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Agent bridge not working",
    );
    expect(
      screen.getByText(/Access was switched off because the bridge could not start/),
    ).toBeInTheDocument();
  });

  it("reports an idle bridge when access is off", async () => {
    await openPanel(
      { bridgeEnabled: false },
      { bridgeStatus: "online" },
    );

    expect(screen.getByRole("status")).toHaveTextContent("Agent bridge off");
  });

  it("locks access when the deployment has no agent bridge", async () => {
    // A direct engine answers /bridge/sessions with 404, so the switch must not pretend a
    // retry could work.
    const toggle = await openPanel(
      { bridgeEnabled: false },
      {
        bridgeStatus: "error",
        bridgeUnavailable: true,
        bridgeFailure:
          "No bridge endpoint at http://localhost:10000/public/v1/bridge/sessions (HTTP 404).",
      },
    );

    expect(toggle).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Agent bridge not available",
    );
    expect(
      screen.getByText(/served by the Chat AI back service/),
    ).toBeInTheDocument();
  });
});
