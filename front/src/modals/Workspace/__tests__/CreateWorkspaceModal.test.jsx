import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  navigate: vi.fn(),
  onClose: vi.fn(),
  agents: [],
  createWorkspace: vi.fn(),
  addSource: vi.fn(),
  addLocalSource: vi.fn(),
  addWorkspaceMount: vi.fn(),
  pickDirectory: vi.fn(),
  cloneIntoWorkspace: vi.fn(),
  applyWorkspaceManifest: vi.fn(),
  importConversation: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => api.navigate,
}));

vi.mock("../../../db/workspaceDb", () => ({
  createWorkspace: api.createWorkspace,
  addSource: api.addSource,
  addWorkspaceMount: api.addWorkspaceMount,
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

const renderModal = () => render(<CreateWorkspaceModal isOpen onClose={api.onClose} />);

const nameInput = () => screen.getByPlaceholderText("e.g. Research");

const typeName = (value) => fireEvent.change(nameInput(), { target: { value } });

const pickFolder = (name = "project") => {
  api.pickDirectory.mockResolvedValue({ name, kind: "directory" });
  fireEvent.click(screen.getByTestId("create-workspace-source-local"));
};

const addRepo = (url = "https://github.com/acme/repo.git") => {
  fireEvent.click(screen.getByTestId("create-workspace-source-git"));
  fireEvent.change(screen.getByTestId("create-workspace-git-url"), {
    target: { value: url },
  });
  fireEvent.click(screen.getByTestId("create-workspace-git-add"));
};

const submit = () =>
  fireEvent.click(screen.getByTestId("create-workspace-create"));

describe("CreateWorkspaceModal", () => {
  beforeEach(() => {
    api.navigate.mockReset();
    api.onClose.mockReset();
    api.agents = [{ id: "agent-1", name: "Coder", local: true, sessionId: "session-1" }];
    api.createWorkspace.mockReset();
    api.createWorkspace.mockResolvedValue("ws-new");
    api.addSource.mockReset();
    api.addSource.mockResolvedValue("source-mcp");
    api.addLocalSource.mockReset();
    api.addLocalSource.mockResolvedValue("source-local");
    api.addWorkspaceMount.mockReset();
    api.addWorkspaceMount.mockResolvedValue("mount-1");
    api.pickDirectory.mockReset();
    api.cloneIntoWorkspace.mockReset();
    api.cloneIntoWorkspace.mockResolvedValue({ path: "/repo" });
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

  it("shows the two columns with what every workspace already contains", () => {
    renderModal();

    expect(nameInput()).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getAllByText("Browser storage")).toHaveLength(2);
    expect(screen.getAllByText("Arcana filesystem")).toHaveLength(2);
    expect(screen.getAllByText("Included")).toHaveLength(4);
    expect(
      screen.getByText(/Nothing added yet/),
    ).toBeInTheDocument();
  });

  it("adds a picked folder as a row and prefills the workspace name", async () => {
    renderModal();
    pickFolder("my-project");

    expect(await screen.findByTestId("create-workspace-tree-row")).toHaveTextContent(
      "my-project",
    );
    expect(nameInput()).toHaveValue("my-project");
  });

  it("creates the workspace, the local source and its mount", async () => {
    const handle = { name: "project", kind: "directory" };
    api.pickDirectory.mockResolvedValue(handle);
    renderModal();

    fireEvent.click(screen.getByTestId("create-workspace-source-local"));
    await screen.findByTestId("create-workspace-tree-row");
    typeName("Research");
    submit();

    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith("/workspace/ws-new"));
    expect(api.createWorkspace).toHaveBeenCalledWith("Research", {
      icon: "rocket",
      color: "rose",
    });
    expect(api.addLocalSource).toHaveBeenCalledWith({
      workspaceId: "ws-new",
      handle,
    });
    expect(api.addWorkspaceMount).toHaveBeenCalledWith({
      workspaceId: "ws-new",
      sourceId: "source-local",
      sourcePath: "/",
      path: "/project",
    });
  });

  it("clones a repository row into the folder named after the URL", async () => {
    renderModal();
    addRepo();

    expect(screen.getByTestId("create-workspace-tree-row")).toHaveTextContent("/repo");
    typeName("Research");
    submit();

    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith("/workspace/ws-new"));
    expect(api.cloneIntoWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-new",
        agent: expect.objectContaining({ id: "agent-1" }),
        url: "https://github.com/acme/repo.git",
        folder: "repo",
        target: "browser",
      }),
    );
    expect(api.applyWorkspaceManifest).not.toHaveBeenCalled();
  });

  it("applies a repository manifest with the clone agent", async () => {
    const manifest = { schemaVersion: 1, chats: [] };
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
    addRepo();
    typeName("Research");
    submit();

    await waitFor(() =>
      expect(api.applyWorkspaceManifest).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-new",
          manifest,
          connection: expect.objectContaining({ id: "agent-1" }),
          importConversation: api.importConversation,
        }),
      ),
    );
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith("/workspace/ws-new"));
  });

  it("keeps the dialog open when a row fails and offers the workspace", async () => {
    api.cloneIntoWorkspace.mockRejectedValue(new Error("clone failed"));
    renderModal();
    addRepo();
    typeName("Research");
    submit();

    expect(await screen.findByText("Failed · clone failed")).toBeInTheDocument();
    expect(nameInput()).toBeInTheDocument();
    expect(screen.queryByTestId("create-workspace-create")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    expect(api.navigate).toHaveBeenCalledWith("/workspace/ws-new");
  });

  it("drops a row again with its remove button", async () => {
    renderModal();
    pickFolder();
    await screen.findByTestId("create-workspace-tree-row");

    fireEvent.click(screen.getByRole("button", { name: "Remove source" }));

    expect(screen.queryByTestId("create-workspace-tree-row")).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing added yet/)).toBeInTheDocument();
  });

  it("cannot create without a name", async () => {
    renderModal();

    expect(screen.getByTestId("create-workspace-create")).toBeDisabled();
    typeName("   ");
    expect(screen.getByTestId("create-workspace-create")).toBeDisabled();
    typeName("Research");
    expect(screen.getByTestId("create-workspace-create")).toBeEnabled();
  });

  it("creates the workspace with the chosen icon and colour", async () => {
    renderModal();

    fireEvent.click(screen.getByTestId("create-workspace-icon"));
    fireEvent.click(screen.getByTestId("create-workspace-icon-code"));
    fireEvent.click(screen.getByTestId("create-workspace-color-violet"));
    typeName("Research");
    submit();

    await waitFor(() =>
      expect(api.createWorkspace).toHaveBeenCalledWith("Research", {
        icon: "code",
        color: "violet",
      }),
    );
  });

  it("shows the storage cards with included drives and the device folder count", async () => {
    renderModal();

    expect(screen.getAllByText("Browser storage")).toHaveLength(2);
    expect(screen.getAllByText("Arcana filesystem")).toHaveLength(2);
    expect(screen.getByText("Your Device")).toBeInTheDocument();
    expect(screen.getByText("0 folders")).toBeInTheDocument();

    pickFolder("my-project");

    await screen.findByTestId("create-workspace-tree-row");
    expect(screen.getByText("1 folder")).toBeInTheDocument();
  });

  it("adds an MCP row and applies it when the workspace is created", async () => {
    renderModal();

    fireEvent.click(screen.getByTestId("create-workspace-source-mcp"));
    fireEvent.change(screen.getByTestId("create-workspace-mcp-endpoint"), {
      target: { value: "http://localhost:9000/mcp" },
    });
    fireEvent.click(screen.getByTestId("create-workspace-mcp-add"));

    expect(screen.getByTestId("create-workspace-tree-row")).toHaveTextContent(
      "localhost:9000",
    );
    typeName("Research");
    submit();

    await waitFor(() =>
      expect(api.navigate).toHaveBeenCalledWith("/workspace/ws-new"),
    );
    expect(api.addSource).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-new",
        kind: "mcp",
        label: "localhost:9000",
        config: {
          endpoint: "http://localhost:9000/mcp",
          transport: "streamable-http",
          toolAllowlist: [],
        },
        status: "offline",
      }),
    );
  });
});
