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

  it("wears the same band as the chats, workspace and agent sections", () => {
    mocks.workspaces = [workspace];
    renderSection();

    const toggle = screen.getByRole("button", { name: /pinned/i });
    const band = toggle.parentElement;
    // Same shape as CHATS/WORKSPACES/AGENTS/MCP SERVERS: a full-bleed,
    // rounded 32px band starting 4px from the sidebar edge.
    expect(band.className).toContain("-mx-2");
    expect(band.className).toContain("min-h-8");
    expect(band.className).toContain("rounded-lg");
    expect(band.className).toContain("bg-base-200/70");
    expect(band.className).toContain("px-3");
    expect(toggle.className).toContain("cursor-pointer");
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

  it("does not count pinned agents when agent rows are hidden", () => {
    mocks.agents = [agent];
    const { container } = renderSection({ showAgents: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("counts pinned agents when agent rows are shown", () => {
    mocks.agents = [agent];
    renderSection({ showAgents: true });

    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("ignores unpinned workspaces and agents in the count", () => {
    mocks.workspaces = [{ ...workspace, pinned: false }];
    mocks.agents = [{ ...agent, pinned: undefined }];
    const { container } = renderSection();

    expect(container).toBeEmptyDOMElement();
  });
});
