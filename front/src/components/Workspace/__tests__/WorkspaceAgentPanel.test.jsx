import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  agents: [],
  links: [],
  openModal: vi.fn(),
  addAgent: vi.fn(),
  attachWorkspaceAgent: vi.fn(async () => {}),
  detachWorkspaceAgent: vi.fn(async () => {}),
  removeAgentFilesSource: vi.fn(async () => {}),
  notifyError: vi.fn(),
}));

vi.mock("../../../agents/agentStore", () => ({
  useAgents: () => mocks.agents,
  addAgent: mocks.addAgent,
}));
vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceAgents: () => mocks.links,
  attachWorkspaceAgent: mocks.attachWorkspaceAgent,
  detachWorkspaceAgent: mocks.detachWorkspaceAgent,
  removeAgentFilesSource: mocks.removeAgentFilesSource,
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifyError: mocks.notifyError }),
}));

import WorkspaceAgentPanel from "../WorkspaceAgentPanel";

const renderPanel = () => render(<WorkspaceAgentPanel workspaceId="ws-1" />);

const browserOption = () =>
  screen.getByRole("button", { name: /in-browser pi agent/i });
const opencodeOption = () =>
  screen.getByRole("button", { name: /opencode server/i });
const remoteOption = () =>
  screen.getByRole("button", { name: /remote agent/i });

beforeEach(() => {
  mocks.agents = [];
  mocks.links = [];
  mocks.openModal.mockReset();
  mocks.addAgent.mockReset();
  mocks.attachWorkspaceAgent.mockReset();
  mocks.detachWorkspaceAgent.mockReset();
  mocks.removeAgentFilesSource.mockReset();
  mocks.notifyError.mockReset();
});

describe("WorkspaceAgentPanel", () => {
  it("renders the three workspace agent options", () => {
    renderPanel();

    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("In-browser Pi agent")).toBeInTheDocument();
    expect(screen.getByText("OpenCode server")).toBeInTheDocument();
    expect(screen.getByText("Remote agent")).toBeInTheDocument();
  });

  it("selects the in-browser agent when nothing is attached", () => {
    renderPanel();

    expect(browserOption()).toHaveAttribute("aria-pressed", "true");
    expect(opencodeOption()).toHaveAttribute("aria-pressed", "false");
    expect(remoteOption()).toHaveAttribute("aria-pressed", "false");
  });

  it("drops its card and heading when hosted inside a tab", () => {
    render(<WorkspaceAgentPanel workspaceId="ws-1" framed={false} />);

    const wrapper = document.querySelector('[data-guide="workspace-agent"]');
    expect(wrapper.className).toBe("");
    expect(screen.queryByText("Agent")).not.toBeInTheDocument();
    expect(browserOption()).toBeInTheDocument();
    expect(opencodeOption()).toBeInTheDocument();
    expect(remoteOption()).toBeInTheDocument();
  });

  it("selects the remote agent when a service agent is attached", () => {
    mocks.agents = [
      {
        id: "remote-1",
        name: "HPC service agent",
        serviceAgentId: "service-1",
        serverUrl: "https://service.example",
      },
    ];
    mocks.links = [{ workspaceId: "ws-1", agentId: "remote-1" }];

    renderPanel();

    expect(remoteOption()).toHaveAttribute("aria-pressed", "true");
    expect(browserOption()).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the opencode picker with existing agents and an add row", () => {
    mocks.agents = [
      { id: "oc-1", name: "Desk OpenCode", serverUrl: "http://localhost:4096" },
    ];

    renderPanel();
    fireEvent.click(opencodeOption());

    expect(screen.getByText("Choose an existing agent")).toBeInTheDocument();
    expect(screen.getByText("Desk OpenCode")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add new agent/i }),
    ).toBeInTheDocument();
    expect(opencodeOption()).toHaveAttribute("aria-pressed", "true");
  });

  it("detaches the attached agents when the in-browser agent is chosen", async () => {
    mocks.agents = [
      { id: "remote-1", name: "HPC", serviceAgentId: "service-1" },
      { id: "oc-1", name: "OpenCode", serverUrl: "http://localhost:4096" },
    ];
    mocks.links = [
      { workspaceId: "ws-1", agentId: "remote-1" },
      { workspaceId: "ws-1", agentId: "oc-1" },
    ];

    renderPanel();
    fireEvent.click(browserOption());

    await waitFor(() => {
      expect(mocks.detachWorkspaceAgent).toHaveBeenCalledWith("ws-1", "remote-1");
      expect(mocks.detachWorkspaceAgent).toHaveBeenCalledWith("ws-1", "oc-1");
    });
    expect(mocks.removeAgentFilesSource).toHaveBeenCalledWith("ws-1", "remote-1");
    expect(mocks.removeAgentFilesSource).toHaveBeenCalledWith("ws-1", "oc-1");
  });

  it("adds the new agent in the chosen mode and attaches it", async () => {
    renderPanel();
    fireEvent.click(opencodeOption());
    fireEvent.click(screen.getByRole("button", { name: /add new agent/i }));

    expect(mocks.openModal).toHaveBeenCalledWith(
      "agentAdd",
      expect.objectContaining({ initialMode: "external" }),
    );

    const config = mocks.openModal.mock.calls[0][1];
    const agent = { id: "new-1", name: "New server", serverUrl: "http://new" };
    act(() => config.onCreate(agent));

    expect(mocks.addAgent).toHaveBeenCalledWith(agent);
    await waitFor(() =>
      expect(mocks.attachWorkspaceAgent).toHaveBeenCalledWith("ws-1", "new-1"),
    );
  });
});
