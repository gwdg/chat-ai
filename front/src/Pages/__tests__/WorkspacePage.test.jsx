import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirmAction: vi.fn(),
  workspace: { id: "ws-1", name: "Teaching", icon: "default", color: "violet" },
}));

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ workspaceId: "ws-1" }),
}));
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: {}, interface_settings: {} }),
}));
vi.mock("../../db", () => ({ useConversationList: () => [] }));
vi.mock("../../db/workspaceDb", () => ({
  deleteWorkspace: vi.fn(),
  removeOrphanWorkspaceAgents: vi.fn(),
  seedWorkspaceAgentSessions: vi.fn(),
  syncAgentFilesSources: vi.fn(),
  syncChatStorageSources: vi.fn(),
  updateWorkspace: vi.fn(),
  useWorkspace: () => mocks.workspace,
  useWorkspaceAgents: () => [],
  useWorkspaceChats: () => [],
  useWorkspaceAgentSessionLinks: () => [],
}));
vi.mock("../../agents/agentStore", () => ({ useAgents: () => [] }));
vi.mock("../../agents/workspaceAgentSessions", () => ({
  workspaceSessionIds: () => [],
}));
vi.mock("../../modals/ModalContext", () => ({
  useModal: () => ({ confirmAction: mocks.confirmAction }),
}));
vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));
vi.mock("../../hooks/useUpdateModelsData", () => ({
  useUpdateModelsData: () => ({}),
}));
vi.mock("../../hooks/useUpdateUserData", () => ({
  useUpdateUserData: () => ({}),
}));
vi.mock("../../components/Sidebar/SidebarWrapper", () => ({
  default: () => <div data-testid="sidebar" />,
}));
vi.mock("../../components/Header/AnnouncementBar", () => ({ default: () => null }));
vi.mock("../../components/Header/Header", () => ({ default: () => null }));
vi.mock("../../components/Footer/CollapsibleFooter", () => ({ default: () => null }));
vi.mock("../../components/Workspace/WorkspaceComposer", () => ({ default: () => null }));
vi.mock("../../components/Workspace/WorkspaceRightPanel", () => ({ default: () => null }));

import WorkspacePage from "../WorkspacePage";

beforeEach(() => {
  mocks.confirmAction.mockReset();
  mocks.workspace = { id: "ws-1", name: "Teaching", icon: "default", color: "violet" };
});

describe("WorkspacePage header", () => {
  it("starts the name at the sidebar edge, not in the centred column", () => {
    render(<WorkspacePage />);

    const header = screen.getByTestId("workspace-page-header");
    expect(header.querySelector(".mx-auto")).toBeNull();
    expect(header.querySelector(".max-w-3xl")).toBeNull();
    expect(header).toHaveTextContent("Teaching");
  });

  it("floats the delete where a chat floats Close Chat", () => {
    render(<WorkspacePage />);

    const button = screen.getByTestId("workspace-page-delete");
    const floater = button.closest("div.absolute");
    expect(floater).not.toBeNull();
    expect(floater.className).toContain("right-2");
    expect(floater.className).toContain("top-2");
    // The same round, shadowed control a chat uses, not a button in the header row.
    expect(button.className).toContain("btn-circle");
    expect(button.className).toContain("shadow-lg");
    expect(screen.getByTestId("workspace-page-header")).not.toContainElement(
      button,
    );
  });
});
