import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PinnedSection from "../PinnedSection";
import { toggleTopic } from "../../../Redux/reducers/interfaceSettingsSlice";

const mocks = vi.hoisted(() => ({
  collapsed: [],
  dispatch: vi.fn(),
  navigate: vi.fn(),
  workspaces: [],
  agents: [],
  setWorkspacePinned: vi.fn(async () => {}),
  setAgentPinned: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.dispatch,
  useSelector: () => mocks.collapsed,
}));
vi.mock("react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceList: () => mocks.workspaces,
  setWorkspacePinned: (...args) => mocks.setWorkspacePinned(...args),
}));
vi.mock("../../../agents/agentStore", () => ({
  useAgents: () => mocks.agents,
  setAgentPinned: (...args) => mocks.setAgentPinned(...args),
}));

const workspace = {
  id: "ws-1",
  name: "Research workspace",
  pinned: true,
  color: "violet",
};
const agent = { id: "a-1", name: "Review agent", pinned: true };

beforeEach(() => {
  mocks.collapsed = [];
  mocks.workspaces = [];
  mocks.agents = [];
  mocks.dispatch.mockClear();
  mocks.navigate.mockClear();
  mocks.setWorkspacePinned.mockClear();
  mocks.setAgentPinned.mockClear();
});

describe("PinnedSection", () => {
  it("renders nothing when there is nothing to pin", () => {
    const { container } = render(<PinnedSection />);

    expect(container).toBeEmptyDOMElement();
  });

  it("counts chats, workspaces and agents in the section header", () => {
    mocks.workspaces = [workspace];
    mocks.agents = [agent];
    render(<PinnedSection chatCount={2} />);

    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("toggles its own persisted collapse id", () => {
    mocks.agents = [agent];
    render(<PinnedSection />);

    fireEvent.click(screen.getByRole("button", { name: /pinned/i }));

    expect(mocks.dispatch).toHaveBeenCalledWith(toggleTopic("__pinned__"));
  });

  it("hides the rows while collapsed", () => {
    mocks.collapsed = ["__pinned__"];
    mocks.workspaces = [workspace];
    mocks.agents = [agent];
    render(<PinnedSection />);

    expect(screen.queryByText("Research workspace")).toBeNull();
    expect(screen.queryByText("Review agent")).toBeNull();
  });

  it("opens a pinned workspace and unpins it from the row", () => {
    mocks.workspaces = [workspace];
    render(<PinnedSection />);

    fireEvent.click(screen.getByText("Research workspace"));
    expect(mocks.navigate).toHaveBeenCalledWith("/workspace/ws-1");

    fireEvent.click(screen.getByRole("button", { name: /unpin workspace/i }));
    expect(mocks.setWorkspacePinned).toHaveBeenCalledWith("ws-1", false);
  });

  it("opens a pinned agent and unpins it from the row", () => {
    mocks.agents = [agent];
    render(<PinnedSection />);

    fireEvent.click(screen.getByText("Review agent"));
    expect(mocks.navigate).toHaveBeenCalledWith("/agent/a-1");

    fireEvent.click(screen.getByRole("button", { name: /unpin agent/i }));
    expect(mocks.setAgentPinned).toHaveBeenCalledWith("a-1", false);
  });

  it("hides pinned agents when the Agents module is off", () => {
    vi.stubEnv("VITE_MODULE_AGENTS", "false");
    mocks.agents = [agent];

    try {
      render(<PinnedSection />);
      expect(screen.queryByText("Review agent")).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("leaves unpinned workspaces and agents to their own sections", () => {
    mocks.workspaces = [{ ...workspace, pinned: false }];
    mocks.agents = [{ ...agent, pinned: undefined }];
    render(<PinnedSection />);

    expect(screen.queryByText("Research workspace")).toBeNull();
    expect(screen.queryByText("Review agent")).toBeNull();
  });
});
