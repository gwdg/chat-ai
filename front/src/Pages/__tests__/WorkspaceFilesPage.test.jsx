import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  workspace: { id: "ws-1", name: "Teaching", icon: "default", color: "violet" },
}));

vi.mock("react-router", () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ workspaceId: "ws-1" }),
}));
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: {}, interface_settings: {} }),
}));
vi.mock("../../db", () => ({ useConversationList: () => [] }));
vi.mock("../../db/workspaceDb", () => ({
  syncAgentFilesSources: vi.fn(),
  syncChatStorageSources: vi.fn(),
  useWorkspace: () => mocks.workspace,
  useWorkspaceAgents: () => [],
  useWorkspaceChats: () => [],
}));
vi.mock("../../agents/agentStore", () => ({ useAgents: () => [] }));
vi.mock("../../hooks/useUpdateModelsData", () => ({
  useUpdateModelsData: () => ({}),
}));
vi.mock("../../hooks/useUpdateUserData", () => ({
  useUpdateUserData: () => ({}),
}));
vi.mock("../../utils/conversationUtils", () => ({
  getDefaultConversation: () => ({ id: "draft", settings: {} }),
}));
vi.mock("../../components/Sidebar/SidebarWrapper", () => ({
  default: () => <div data-testid="sidebar" />,
}));
vi.mock("../../components/Header/AnnouncementBar", () => ({
  default: () => null,
}));
vi.mock("../../components/Header/Header", () => ({ default: () => null }));
vi.mock("../../components/Footer/CollapsibleFooter", () => ({
  default: () => null,
}));
vi.mock("../../components/Workspace/WorkspaceStorageTree", () => ({
  default: ({ workspaceId, onPreview }) => (
    <div data-testid="tree" data-workspace={workspaceId}>
      <button
        type="button"
        onClick={() =>
          onPreview?.({
            entry: { name: "notes.md", mime: "text/markdown" },
            text: "hello",
            loading: true,
          })
        }
      >
        Open loading
      </button>
      <button
        type="button"
        onClick={() =>
          onPreview?.({
            entry: { name: "notes.md", mime: "text/markdown" },
            text: "hello",
          })
        }
      >
        Open file
      </button>
    </div>
  ),
}));
vi.mock("../../components/Workspace/WorkspaceRightPanel", () => ({
  WorkspacePreviewPane: ({ request, onClose }) => (
    <div data-testid="preview">
      <span>{request.entry.name}</span>
      <button type="button" onClick={onClose}>
        Close preview
      </button>
    </div>
  ),
}));

import WorkspaceFilesPage from "../WorkspaceFilesPage";

beforeEach(() => {
  mocks.navigate.mockClear();
  window.localStorage.clear();
  mocks.workspace = {
    id: "ws-1",
    name: "Teaching",
    icon: "default",
    color: "violet",
  };
});

describe("WorkspaceFilesPage", () => {
  it("shows the workspace tree as a page and returns to the workspace", () => {
    render(<WorkspaceFilesPage />);

    expect(screen.getByTestId("workspace-page-header")).toHaveTextContent(
      "Teaching",
    );
    expect(screen.getByTestId("tree")).toHaveAttribute("data-workspace", "ws-1");

    fireEvent.click(
      screen.getByRole("button", { name: "Back to workspace" }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/workspace/ws-1");
  });

  it("shows the clicked file beside the tree and closes it again", () => {
    render(<WorkspaceFilesPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open loading" }));
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));

    expect(screen.getByTestId("preview")).toHaveTextContent("notes.md");

    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(screen.queryByTestId("preview")).toBeNull();
  });

  it("splits the tree and the preview evenly and lets the user adjust it", () => {
    render(<WorkspaceFilesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));

    const body = screen.getByTestId("workspace-files-body");
    const separator = screen.getByRole("separator", {
      name: "Resize file tree and preview",
    });
    expect(body.style.getPropertyValue("--files-split")).toBe("50%");
    expect(separator).toHaveAttribute("aria-valuenow", "50");

    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(body.style.getPropertyValue("--files-split")).toBe("54%");
    expect(separator).toHaveAttribute("aria-valuenow", "54");
    expect(
      window.localStorage.getItem("chatai.workspaceFiles.split"),
    ).toBe("0.54");

    fireEvent.doubleClick(separator);
    expect(body.style.getPropertyValue("--files-split")).toBe("50%");

    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(body.style.getPropertyValue("--files-split")).toBe("46%");
  });

  it("restores a stored split and clamps it so neither side collapses", () => {
    window.localStorage.setItem("chatai.workspaceFiles.split", "0.95");
    render(<WorkspaceFilesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));

    expect(
      screen
        .getByTestId("workspace-files-body")
        .style.getPropertyValue("--files-split"),
    ).toBe("80%");
  });

  it("shows the not-found panel when the workspace does not exist", async () => {
    mocks.workspace = null;
    render(<WorkspaceFilesPage />);

    expect(await screen.findByText("Workspace not found")).toBeInTheDocument();
  });
});
