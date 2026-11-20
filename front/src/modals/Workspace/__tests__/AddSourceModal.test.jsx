import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  addSource: vi.fn(),
  addWorkspaceMount: vi.fn(),
  listWorkspaceMounts: vi.fn(),
  cloneIntoWorkspace: vi.fn(),
  agents: [],
  settings: { tools: { mcp: false }, mcp_servers: [] },
}));

vi.mock("../../../db/workspaceDb", () => ({
  addSource: (...args) => api.addSource(...args),
  addWorkspaceMount: (...args) => api.addWorkspaceMount(...args),
  listWorkspaceMounts: (...args) => api.listWorkspaceMounts(...args),
}));

// The modal only reads whether local MCP servers are configured.
vi.mock("react-redux", () => ({
  useSelector: () => api.settings,
}));

vi.mock("../../../agents/agentStore", () => ({
  useAgents: () => api.agents,
}));

vi.mock("../../../workspace/cloneIntoWorkspace", () => ({
  cloneIntoWorkspace: (...args) => api.cloneIntoWorkspace(...args),
}));

import AddSourceModal from "../AddSourceModal";

const localAgent = {
  id: "agent-1",
  name: "Coder",
  local: true,
  sessionId: "session-1",
};

const stubPicker = (implementation) => {
  Object.defineProperty(window, "showDirectoryPicker", {
    value: vi.fn(implementation),
    configurable: true,
  });
};

const choose = (name = "Choose folder…") =>
  fireEvent.click(screen.getByRole("button", { name }));
const confirm = () => fireEvent.click(screen.getByRole("button", { name: "OK" }));
const chooseKind = (value) =>
  fireEvent.change(screen.getByLabelText("Source type"), {
    target: { value },
  });
const chooseGit = () => chooseKind("git");

beforeEach(() => {
  api.addSource.mockReset();
  api.addSource.mockResolvedValue("source-1");
  api.addWorkspaceMount.mockReset();
  api.addWorkspaceMount.mockResolvedValue("mount-1");
  api.listWorkspaceMounts.mockReset();
  api.listWorkspaceMounts.mockResolvedValue([]);
  api.cloneIntoWorkspace.mockReset();
  api.agents = [];
  api.settings.tools.mcp = false;
  api.settings.mcp_servers = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  Object.defineProperty(window, "isSecureContext", {
    value: true,
    configurable: true,
  });
});

afterEach(() => {
  delete window.isSecureContext;
  vi.restoreAllMocks();
});

describe("AddSourceModal local folder", () => {
  it("picks the folder first and adds it on OK", async () => {
    const handle = { name: "project", kind: "directory" };
    stubPicker(async () => handle);

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    // Picking fills the folder field but does not create anything on its own.
    choose();
    expect(await screen.findByTestId("local-source-folder")).toHaveTextContent(
      "project",
    );
    expect(api.addSource).not.toHaveBeenCalled();

    confirm();

    await waitFor(() => expect(api.addSource).toHaveBeenCalledTimes(1));
    expect(api.addSource.mock.calls[0][0]).toMatchObject({
      workspaceId: "ws-1",
      kind: "local",
      label: "project",
      handle,
    });
    // The folder is mounted at the workspace root in the same step.
    await waitFor(() =>
      expect(api.addWorkspaceMount).toHaveBeenCalledTimes(1),
    );
    expect(api.addWorkspaceMount.mock.calls[0][0]).toMatchObject({
      workspaceId: "ws-1",
      sourceId: "source-1",
      sourcePath: "/",
      path: "/project",
    });
  });

  it("keeps OK disabled until a folder is chosen", () => {
    stubPicker(async () => ({ name: "project", kind: "directory" }));

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);

    expect(screen.getByTestId("local-source-folder")).toHaveTextContent(
      "No folder chosen yet.",
    );
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();
    confirm();
    expect(api.addSource).not.toHaveBeenCalled();
  });

  it("uses a typed label instead of the folder name", async () => {
    stubPicker(async () => ({ name: "project", kind: "directory" }));

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Local folder"), {
      target: { value: "Research data" },
    });
    choose();
    await screen.findByText("project");
    confirm();

    await waitFor(() => expect(api.addSource).toHaveBeenCalledTimes(1));
    expect(api.addSource.mock.calls[0][0]).toMatchObject({ label: "Research data" });
  });

  it("explains a picker that returns no folder instead of doing nothing", async () => {
    stubPicker(async () => {
      throw new DOMException("The user aborted a request.", "AbortError");
    });

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    choose();

    expect(await screen.findByText(/No folder was taken over/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();
    expect(api.addSource).not.toHaveBeenCalled();
  });

  it("asks for read access only for a read-only source", async () => {
    const picker = vi.fn(async () => ({ name: "project", kind: "directory" }));
    Object.defineProperty(window, "showDirectoryPicker", {
      value: picker,
      configurable: true,
    });

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox"));
    choose();
    await screen.findByText("project");
    confirm();

    await waitFor(() => expect(api.addSource).toHaveBeenCalledTimes(1));
    expect(picker).toHaveBeenCalledWith({ mode: "read" });
    expect(api.addSource.mock.calls[0][0]).toMatchObject({ readOnly: true });
  });

  it("offers Git alongside Local folder even when local MCP is disabled", () => {
    stubPicker(async () => ({ name: "project", kind: "directory" }));

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Local folder", "Git repository"]);
  });

  it("puts the folder picker above the label, right under the source type", () => {
    stubPicker(async () => ({ name: "project", kind: "directory" }));

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);

    const folder = screen.getByText("Folder");
    const picker = screen.getByRole("button", { name: "Choose folder…" });
    const label = screen.getByText("Label");
    expect(
      folder.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      picker.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("says up front that local folders need a secure page", () => {
    stubPicker(async () => ({ name: "project", kind: "directory" }));
    Object.defineProperty(window, "isSecureContext", {
      value: false,
      configurable: true,
    });

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);

    expect(screen.getByText(/needs a secure page/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose folder…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();
  });
});

describe("AddSourceModal Git repository", () => {
  it("requires a repository URL before OK is enabled", async () => {
    api.agents = [localAgent];

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    chooseGit();

    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Public repository URL"), {
      target: { value: "https://github.com/acme/repo.git" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "OK" })).toBeEnabled(),
    );
  });

  it("requires a local agent and says so when there is none", () => {
    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    chooseGit();

    expect(
      screen.getAllByText(/No local OpenCode agent is configured/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();
  });

  it("clones into browser storage with the parsed URL and suggested folder", async () => {
    api.agents = [localAgent];
    api.cloneIntoWorkspace.mockResolvedValue({ path: "/repo" });
    const onAdded = vi.fn();

    render(
      <AddSourceModal
        isOpen
        workspaceId="ws-1"
        onClose={vi.fn()}
        onAdded={onAdded}
      />,
    );
    chooseGit();
    fireEvent.change(screen.getByLabelText("Public repository URL"), {
      target: { value: "https://github.com/acme/repo.git" },
    });
    fireEvent.change(screen.getByLabelText("Branch or tag (optional)"), {
      target: { value: "main" },
    });

    expect(screen.getByLabelText("Target subfolder")).toHaveValue("repo");
    confirm();

    await waitFor(() =>
      expect(api.cloneIntoWorkspace).toHaveBeenCalledTimes(1),
    );
    expect(api.cloneIntoWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        agent: localAgent,
        url: "https://github.com/acme/repo.git",
        branch: "main",
        folder: "repo",
        target: "browser",
        onProgress: expect.any(Function),
      }),
    );
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith({ path: "/repo" }));
    expect(api.addSource).not.toHaveBeenCalled();
  });

  it("shows a clone failure inline and leaves the source list untouched", async () => {
    api.agents = [localAgent];
    api.cloneIntoWorkspace.mockRejectedValue(new Error("git clone failed"));
    const onAdded = vi.fn();

    render(
      <AddSourceModal
        isOpen
        workspaceId="ws-1"
        onClose={vi.fn()}
        onAdded={onAdded}
      />,
    );
    chooseGit();
    fireEvent.change(screen.getByLabelText("Public repository URL"), {
      target: { value: "https://github.com/acme/repo.git" },
    });
    confirm();

    expect(await screen.findByText("git clone failed")).toBeInTheDocument();
    expect(api.addSource).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });
});

describe("AddSourceModal MCP server", () => {
  beforeEach(() => {
    api.settings.tools.mcp = true;
    api.settings.mcp_servers = [{ id: "local", name: "Local", url: "http://x" }];
  });

  it("offers the three source kinds", () => {
    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Local folder", "Git repository", "MCP"]);
  });

  it("adds an MCP source on OK, without asking for a folder", () => {
    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    chooseKind("mcp");

    expect(
      screen.queryByRole("button", { name: "Choose folder…" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("http://localhost:9000/mcp"), {
      target: { value: "http://localhost:8080/mcp" },
    });
    confirm();

    return waitFor(() => expect(api.addSource).toHaveBeenCalledTimes(1)).then(() => {
      expect(api.addSource.mock.calls[0][0]).toMatchObject({
        kind: "mcp",
        label: "MCP",
        config: { endpoint: "http://localhost:8080/mcp" },
      });
    });
  });
});
