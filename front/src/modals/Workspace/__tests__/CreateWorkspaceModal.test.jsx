import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  navigate: vi.fn(),
  onClose: vi.fn(),
  createWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  useWorkspaceSources: vi.fn(),
  useWorkspaceMounts: vi.fn(),
  useWorkspaceList: vi.fn(),
  createWorkspaceRootProvider: vi.fn(),
  listWorkspaceRoot: vi.fn(),
  addSelectionToWorkspace: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => api.navigate,
}));

vi.mock("../../../db/workspaceDb", () => ({
  createWorkspace: (...args) => api.createWorkspace(...args),
  updateWorkspace: (...args) => api.updateWorkspace(...args),
  deleteWorkspace: (...args) => api.deleteWorkspace(...args),
  useWorkspaceSources: (...args) => api.useWorkspaceSources(...args),
  useWorkspaceMounts: (...args) => api.useWorkspaceMounts(...args),
  useWorkspaceList: (...args) => api.useWorkspaceList(...args),
}));

vi.mock("../../../workspace/workspaceRoot", () => ({
  createWorkspaceRootProvider: (...args) =>
    api.createWorkspaceRootProvider(...args),
}));

vi.mock("../../../workspace/listWorkspaceRoot", () => ({
  listWorkspaceRoot: (...args) => api.listWorkspaceRoot(...args),
}));

vi.mock("../../../workspace/addSelectionToWorkspace", () => ({
  addSelectionToWorkspace: (...args) =>
    api.addSelectionToWorkspace(...args),
}));

vi.mock("../AddSourceModal", () => ({
  default: ({ isOpen, initialKind }) =>
    isOpen ? (
      <div
        data-testid="add-source-modal"
        data-initial-kind={initialKind ?? "default"}
      />
    ) : null,
}));

vi.mock("../../../components/Workspace/WorkspaceSourcesPanel", () => ({
  default: ({ sources }) => (
    <div data-testid="sources-panel" data-count={sources.length} />
  ),
}));

vi.mock("../../../components/Workspace/WorkspaceSourceBrowser", () => ({
  default: ({ sources, target }) => (
    <div
      data-testid="source-browser"
      data-count={sources.length}
      data-target={target ? target.drive : "none"}
    />
  ),
}));

vi.mock("../../../components/Workspace/WorkspaceRootBrowser", () => ({
  default: ({ entries = [], entryBadge }) => (
    <div data-testid="root-browser">
      {entries.map((entry) => {
        const badge = entryBadge?.(entry);
        return (
          <span key={entry.path}>
            {entry.name}
            {typeof badge === "string" && badge ? (
              <span data-testid={`root-badge-${entry.name}`}>{badge}</span>
            ) : null}
          </span>
        );
      })}
    </div>
  ),
}));

vi.mock("../../../components/Workspace/WorkspaceAgentPanel", () => ({
  default: ({ workspaceId }) => (
    <div data-testid="agent-panel" data-workspace-id={workspaceId ?? ""} />
  ),
}));

import CreateWorkspaceModal from "../CreateWorkspaceModal";

const EMPTY = [];

const renderModal = (isOpen = true) =>
  render(<CreateWorkspaceModal isOpen={isOpen} onClose={api.onClose} />);

const nameInput = () => screen.getByPlaceholderText("Workspace name");

const typeName = (value) =>
  fireEvent.change(nameInput(), { target: { value } });

const waitForDraft = async (id = "ws-draft") => {
  await waitFor(() => expect(api.useWorkspaceSources).toHaveBeenCalledWith(id));
};

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.createWorkspace.mockResolvedValue("ws-draft");
  api.updateWorkspace.mockResolvedValue(undefined);
  api.deleteWorkspace.mockResolvedValue(undefined);
  api.useWorkspaceSources.mockReturnValue(EMPTY);
  api.useWorkspaceMounts.mockReturnValue(EMPTY);
  api.useWorkspaceList.mockReturnValue(EMPTY);
  api.createWorkspaceRootProvider.mockReturnValue({ connect: vi.fn() });
  api.listWorkspaceRoot.mockResolvedValue(EMPTY);
  api.addSelectionToWorkspace.mockResolvedValue({
    mounted: 0,
    copied: 0,
    failed: [],
  });
});

describe("CreateWorkspaceModal", () => {
  it("creates exactly one draft and renders the workspace panes", async () => {
    renderModal();

    await waitForDraft();

    expect(api.createWorkspace).toHaveBeenCalledTimes(1);
    expect(api.createWorkspace).toHaveBeenCalledWith("New workspace");
    expect(screen.getByTestId("create-workspace-sources")).toBeInTheDocument();
    expect(screen.getByTestId("sources-panel")).toBeInTheDocument();
    expect(screen.getByTestId("source-browser")).toBeInTheDocument();
    expect(screen.getByTestId("root-browser")).toBeInTheDocument();
  });

  it("replaces the tab strip with the current root path", async () => {
    renderModal();
    await waitForDraft();

    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByTestId("create-workspace-path")).toHaveTextContent("/");
  });

  it("keeps colour dots inside the icon popover and writes the choice", async () => {
    renderModal();
    await waitForDraft();

    expect(screen.queryByTestId("create-workspace-color-violet")).toBeNull();

    fireEvent.click(screen.getByTestId("create-workspace-icon"));

    expect(
      screen.getByTestId("create-workspace-color-violet"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("create-workspace-color-violet"));

    await waitFor(() =>
      expect(api.updateWorkspace).toHaveBeenCalledWith("ws-draft", {
        color: "violet",
      }),
    );
  });

  it("labels tree entries with their storage origin", async () => {
    api.useWorkspaceMounts.mockReturnValue([
      { id: "mount-1", sourceId: "src-device", path: "/data" },
    ]);
    api.useWorkspaceSources.mockReturnValue([
      {
        id: "src-device",
        kind: "local",
        label: "Laptop",
        config: {},
        capabilities: {},
        status: "connected",
      },
    ]);
    api.listWorkspaceRoot.mockResolvedValue([
      {
        sourceId: "ws-root",
        path: "/data",
        name: "data",
        kind: "dir",
        local: false,
        mount: { id: "mount-1", sourceId: "src-device", path: "/data" },
      },
      {
        sourceId: "ws-root",
        path: "/notes.txt",
        name: "notes.txt",
        kind: "file",
        local: true,
      },
    ]);

    renderModal();
    await waitForDraft();

    expect(await screen.findByTestId("root-badge-data")).toHaveTextContent(
      "device",
    );
    expect(
      await screen.findByTestId("root-badge-notes.txt"),
    ).toHaveTextContent("browser");
  });

  it("writes icon and colour choices through to the draft", async () => {
    renderModal();
    await waitForDraft();

    fireEvent.click(screen.getByTestId("create-workspace-icon"));
    fireEvent.click(screen.getByTestId("create-workspace-icon-code"));

    await waitFor(() =>
      expect(api.updateWorkspace).toHaveBeenCalledWith("ws-draft", {
        icon: "code",
      }),
    );

    fireEvent.click(screen.getByTestId("create-workspace-color-violet"));

    await waitFor(() =>
      expect(api.updateWorkspace).toHaveBeenCalledWith("ws-draft", {
        color: "violet",
      }),
    );
  });

  it("renames the draft, navigates and never deletes it", async () => {
    renderModal();
    await waitForDraft();

    typeName("Research");
    fireEvent.click(screen.getByTestId("create-workspace-create"));

    await waitFor(() =>
      expect(api.navigate).toHaveBeenCalledWith("/workspace/ws-draft"),
    );
    expect(api.updateWorkspace).toHaveBeenCalledWith("ws-draft", {
      name: "Research",
    });
    expect(api.deleteWorkspace).not.toHaveBeenCalled();
  });

  it("deletes the abandoned draft on cancel and X, one draft per open", async () => {
    const view = renderModal();
    await waitForDraft();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(api.deleteWorkspace).toHaveBeenCalledWith("ws-draft"),
    );
    expect(api.onClose).toHaveBeenCalledTimes(1);

    api.createWorkspace.mockResolvedValue("ws-draft-2");
    view.rerender(
      <CreateWorkspaceModal isOpen={false} onClose={api.onClose} />,
    );
    view.rerender(<CreateWorkspaceModal isOpen onClose={api.onClose} />);

    await waitForDraft("ws-draft-2");
    expect(api.createWorkspace).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

    await waitFor(() =>
      expect(api.deleteWorkspace).toHaveBeenCalledWith("ws-draft-2"),
    );
    expect(api.deleteWorkspace).toHaveBeenCalledTimes(2);
    expect(api.onClose).toHaveBeenCalledTimes(2);
  });

  it("shows a duplicate-name error inline and keeps the modal open", async () => {
    api.updateWorkspace.mockRejectedValueOnce(
      new Error("A workspace with this name already exists"),
    );
    renderModal();
    await waitForDraft();

    typeName("Research");
    fireEvent.click(screen.getByTestId("create-workspace-create"));

    expect(
      await screen.findByText("A workspace with this name already exists"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("create-workspace-create")).toBeInTheDocument();
    expect(api.navigate).not.toHaveBeenCalled();
    expect(api.deleteWorkspace).not.toHaveBeenCalled();
  });
});
