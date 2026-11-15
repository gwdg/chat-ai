import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PinnedSection from "../PinnedSection";
import { toggleTopic } from "../../../Redux/reducers/interfaceSettingsSlice";

const mocks = vi.hoisted(() => ({
  collapsed: [],
  dispatch: vi.fn(),
  workspaces: [],
  agents: [],
}));

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.dispatch,
  useSelector: () => mocks.collapsed,
}));
vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceList: () => mocks.workspaces,
}));
vi.mock("../../../agents/agentStore", () => ({
  useAgents: () => mocks.agents,
}));

const workspace = { id: "ws-1", name: "Research workspace", pinned: true };
const agent = { id: "a-1", name: "Review agent", pinned: true };

const renderSection = (props = {}) =>
  render(
    <PinnedSection {...props}>
      <div data-testid="pinned-rows">rows from the list components</div>
    </PinnedSection>,
  );

beforeEach(() => {
  mocks.collapsed = [];
  mocks.workspaces = [];
  mocks.agents = [];
  mocks.dispatch.mockClear();
});

describe("PinnedSection", () => {
  it("renders nothing when there is nothing to pin", () => {
    const { container } = renderSection();

    expect(container).toBeEmptyDOMElement();
  });

  it("counts chats, workspaces and agents in the section header", () => {
    mocks.workspaces = [workspace];
    mocks.agents = [agent];
    renderSection({ chatCount: 2 });

    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("toggles its own persisted collapse id", () => {
    mocks.agents = [agent];
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: /pinned/i }));

    expect(mocks.dispatch).toHaveBeenCalledWith(toggleTopic("__pinned__"));
  });

  it("hides the rows while collapsed", () => {
    mocks.collapsed = ["__pinned__"];
    mocks.workspaces = [workspace];
    renderSection();

    expect(screen.queryByTestId("pinned-rows")).toBeNull();
  });

  it("renders the rows supplied by the list components", () => {
    mocks.workspaces = [workspace];
    renderSection();

    expect(screen.getByTestId("pinned-rows")).toBeInTheDocument();
  });

  it("hides pinned agents when the Agents module is off", () => {
    vi.stubEnv("VITE_MODULE_AGENTS", "false");
    mocks.agents = [agent];

    try {
      const { container } = renderSection();
      expect(container).toBeEmptyDOMElement();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("ignores unpinned workspaces and agents in the count", () => {
    mocks.workspaces = [{ ...workspace, pinned: false }];
    mocks.agents = [{ ...agent, pinned: undefined }];
    const { container } = renderSection();

    expect(container).toBeEmptyDOMElement();
  });
});
