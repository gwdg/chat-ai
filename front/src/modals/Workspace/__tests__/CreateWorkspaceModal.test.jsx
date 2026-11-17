import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  navigate: vi.fn(),
  onClose: vi.fn(),
  settings: { tools: { mcp: false }, mcp_servers: [] },
  agents: [],
  createWorkspace: vi.fn(),
  addSource: vi.fn(),
  addLocalSource: vi.fn(),
  addWorkspaceMount: vi.fn(),
  getSourceHandle: vi.fn(),
  listCloneTargets: vi.fn(),
  pickDirectory: vi.fn(),
  cloneIntoWorkspace: vi.fn(),
  applyWorkspaceManifest: vi.fn(),
  importConversation: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => api.navigate,
}));

vi.mock("react-redux", () => ({
  useSelector: () => api.settings,
}));

vi.mock("../../../db/workspaceDb", () => ({
  createWorkspace: api.createWorkspace,
  addSource: api.addSource,
  addWorkspaceMount: api.addWorkspaceMount,
  getSourceHandle: api.getSourceHandle,
  listCloneTargets: api.listCloneTargets,
}));

vi.mock("../../../agents/agentStore", () => ({
  useAgents: () => api.agents,
}));

vi.mock("../../../hooks/useImportConversation", () => ({
  useImportConversation: () => api.importConversation,
}));

vi.mock("../../../hooks/useUpdateModelsData", () => ({
  useUpdateModelsData: () => [],
}));

vi.mock("../../../workspace/localWorkspace", () => ({
  pickDirectory: api.pickDirectory,
  addLocalSource: api.addLocalSource,
}));

vi.mock("../../../workspace/cloneIntoWorkspace", () => ({
  cloneIntoWorkspace: api.cloneIntoWorkspace,
}));

vi.mock("../../../workspace/applyWorkspaceManifest", () => ({
  applyWorkspaceManifest: api.applyWorkspaceManifest,
}));

import CreateWorkspaceModal from "../CreateWorkspaceModal";

const renderModal = () =>
  render(<CreateWorkspaceModal isOpen onClose={api.onClose} />);

const setName = (value) =>
  fireEvent.change(screen.getByPlaceholderText("e.g. Research"), {
    target: { value },
  });

describe("CreateWorkspaceModal", () => {
  beforeEach(() => {
    api.navigate.mockReset();
    api.onClose.mockReset();
    api.settings.tools.mcp = false;
    api.settings.mcp_servers = [];
    api.agents = [
      {
        id: "agent-1",
        name: "Coder",
        local: true,
        sessionId: "session-1",
      },
    ];
    api.createWorkspace.mockReset();
    api.createWorkspace.mockResolvedValue("ws-new");
    api.addSource.mockReset();
    api.addSource.mockResolvedValue("source-mcp");
    api.addLocalSource.mockReset();
    api.addLocalSource.mockResolvedValue("source-local");
    api.addWorkspaceMount.mockReset();
    api.addWorkspaceMount.mockResolvedValue("mount-1");
    api.getSourceHandle.mockReset();
    api.listCloneTargets.mockReset();
    api.listCloneTargets.mockResolvedValue([]);
    api.pickDirectory.mockReset();
    api.cloneIntoWorkspace.mockReset();
    api.applyWorkspaceManifest.mockReset();
    api.applyWorkspaceManifest.mockResolvedValue({
      agentId: null,
      createdAgent: null,
      chatIds: [],
      rollback: vi.fn(),
    });
    api.importConversation.mockReset();
    Object.defineProperty(window, "showDirectoryPicker", {
      value: vi.fn(),
      configurable: true,
    });
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });
  });

  it("creates an empty workspace and navigates without touching sources", async () => {
    renderModal();

    setName("Research");
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() =>
      expect(api.createWorkspace).toHaveBeenCalledWith("Research"),
    );
    await waitFor(() =>
      expect(api.navigate).toHaveBeenCalledWith("/workspace/ws-new"),
    );
    expect(api.createWorkspace).toHaveBeenCalledTimes(1);
    expect(api.addSource).not.toHaveBeenCalled();
    expect(api.addLocalSource).not.toHaveBeenCalled();
    expect(api.cloneIntoWorkspace).not.toHaveBeenCalled();
  });

  it("adds a picked local folder and mounts it at its folder name", async () => {
    const handle = { name: "project", kind: "directory" };
    api.pickDirectory.mockResolvedValue(handle);
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Local folder" }));
    expect(await screen.findByDisplayValue("project")).toBeInTheDocument();

    setName("Research");
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() => expect(api.addLocalSource).toHaveBeenCalledTimes(1));
    expect(api.addLocalSource).toHaveBeenCalledWith({
      workspaceId: "ws-new",
      handle,
      label: "project",
      readOnly: false,
    });
    expect(api.addWorkspaceMount).toHaveBeenCalledWith({
      workspaceId: "ws-new",
      sourceId: "source-local",
      sourcePath: "/",
      path: "/project",
      readOnly: false,
    });
    await waitFor(() =>
      expect(api.navigate).toHaveBeenCalledWith("/workspace/ws-new"),
    );
  });

  it("clones a git row, reviews the manifest in the row and applies it", async () => {
    const manifest = {
      schemaVersion: 1,
      workspace: { icon: "rocket" },
      chats: [],
    };
    api.cloneIntoWorkspace.mockImplementation(async ({ beforeCopy, onProgress }) => {
      onProgress?.({ step: "clone" });
      await beforeCopy?.({
        folder: "repo",
        path: "/repo",
        target: "browser",
        manifest,
        measure: { files: 3, bytes: 2048 },
      });
      return { path: "/repo" };
    });
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Git repository" }));
    fireEvent.change(screen.getByLabelText("Public repository URL"), {
      target: { value: "https://github.com/acme/repo.git" },
    });
    expect(screen.getByLabelText("Target subfolder")).toHaveValue("repo");

    setName("Research");
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    const continueButton = await screen.findByRole("button", {
      name: "Continue",
    });
    expect(api.cloneIntoWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-new",
        url: "https://github.com/acme/repo.git",
        folder: "repo",
        target: "browser",
      }),
    );
    fireEvent.click(continueButton);

    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(api.applyWorkspaceManifest).toHaveBeenCalledTimes(1);
    expect(api.applyWorkspaceManifest).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-new",
        manifest,
        connection: expect.objectContaining({ id: "agent-1" }),
      }),
    );
    await waitFor(() =>
      expect(api.navigate).toHaveBeenCalledWith("/workspace/ws-new"),
    );
  });

  it("keeps the dialog open on a failed row and offers the workspace", async () => {
    api.pickDirectory.mockResolvedValue({ name: "project", kind: "directory" });
    api.addLocalSource.mockRejectedValue(new Error("permission denied"));
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Local folder" }));
    await screen.findByDisplayValue("project");
    setName("Research");
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(
      await screen.findByText("Failed · permission denied"),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Research")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    expect(api.navigate).toHaveBeenCalledWith("/workspace/ws-new");
  });

  it("offers local and git actions but hides MCP when local MCP is disabled", async () => {
    renderModal();

    await waitFor(() => expect(api.listCloneTargets).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Local folder" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Git repository" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "MCP server" }),
    ).not.toBeInTheDocument();
  });

  it("adds an MCP row with endpoint, transport and allowlist when enabled", async () => {
    api.settings.tools.mcp = true;
    api.settings.mcp_servers = [
      { id: "local", name: "Local", url: "http://localhost:9000/mcp" },
    ];
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "MCP server" }));
    fireEvent.change(screen.getByLabelText("MCP endpoint"), {
      target: { value: "http://localhost:8080/mcp" },
    });
    fireEvent.change(
      screen.getByLabelText("Tool allowlist (comma separated, optional)"),
      { target: { value: "read_file, list_directory" } },
    );
    setName("Research");
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() => expect(api.addSource).toHaveBeenCalledTimes(1));
    expect(api.addSource).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-new",
        kind: "mcp",
        config: {
          endpoint: "http://localhost:8080/mcp",
          transport: "streamable-http",
          toolAllowlist: ["read_file", "list_directory"],
        },
        status: "offline",
      }),
    );
  });
});
