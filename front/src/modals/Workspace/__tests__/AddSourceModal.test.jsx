import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const addSource = vi.fn();
const userSettings = { tools: { mcp: false }, mcp_servers: [] };

vi.mock("../../../db/workspaceDb", () => ({
  addSource: (...args) => addSource(...args),
}));

// The modal only reads whether local MCP servers are configured.
vi.mock("react-redux", () => ({
  useSelector: () => userSettings,
}));

import AddSourceModal from "../AddSourceModal";

const stubPicker = (implementation) => {
  Object.defineProperty(window, "showDirectoryPicker", {
    value: vi.fn(implementation),
    configurable: true,
  });
};

const choose = (name = "Choose folder…") =>
  fireEvent.click(screen.getByRole("button", { name }));
const confirm = () => fireEvent.click(screen.getByRole("button", { name: "OK" }));

describe("AddSourceModal local folder", () => {
  beforeEach(() => {
    addSource.mockReset();
    addSource.mockResolvedValue("source-1");
    userSettings.tools.mcp = false;
    userSettings.mcp_servers = [];
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    delete window.isSecureContext;
  });

  it("picks the folder first and adds it on OK", async () => {
    const handle = { name: "project", kind: "directory" };
    stubPicker(async () => handle);

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    // Picking fills the folder field but does not create anything on its own.
    choose();
    expect(await screen.findByTestId("local-source-folder")).toHaveTextContent(
      "project",
    );
    expect(addSource).not.toHaveBeenCalled();

    confirm();

    await waitFor(() => expect(addSource).toHaveBeenCalledTimes(1));
    expect(addSource.mock.calls[0][0]).toMatchObject({
      workspaceId: "ws-1",
      kind: "local",
      label: "project",
      handle,
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
    expect(addSource).not.toHaveBeenCalled();
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

    await waitFor(() => expect(addSource).toHaveBeenCalledTimes(1));
    expect(addSource.mock.calls[0][0]).toMatchObject({ label: "Research data" });
  });

  it("explains a picker that returns no folder instead of doing nothing", async () => {
    stubPicker(async () => {
      throw new DOMException("The user aborted a request.", "AbortError");
    });

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    choose();

    expect(await screen.findByText(/No folder was taken over/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();
    expect(addSource).not.toHaveBeenCalled();
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

    await waitFor(() => expect(addSource).toHaveBeenCalledTimes(1));
    expect(picker).toHaveBeenCalledWith({ mode: "read" });
    expect(addSource.mock.calls[0][0]).toMatchObject({ readOnly: true });
  });

  it("does not offer the only kind as a button that cannot do anything", () => {
    stubPicker(async () => ({ name: "project", kind: "directory" }));

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);

    // "Local folder" names the source type; the action is the folder picker button.
    expect(
      screen.queryByRole("button", { name: "Local folder" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Local folder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose folder…" })).toBeEnabled();
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

describe("AddSourceModal MCP server", () => {
  beforeEach(() => {
    addSource.mockReset();
    addSource.mockResolvedValue("source-1");
    userSettings.tools.mcp = true;
    userSettings.mcp_servers = [{ id: "local", name: "Local", url: "http://x" }];
  });

  afterEach(() => {
    userSettings.tools.mcp = false;
    userSettings.mcp_servers = [];
  });

  it("adds an MCP source on OK, without asking for a folder", () => {
    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "MCP" }));

    expect(
      screen.queryByRole("button", { name: "Choose folder…" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("http://localhost:9000/mcp"), {
      target: { value: "http://localhost:8080/mcp" },
    });
    confirm();

    return waitFor(() => expect(addSource).toHaveBeenCalledTimes(1)).then(() => {
      expect(addSource.mock.calls[0][0]).toMatchObject({
        kind: "mcp",
        label: "MCP",
        config: { endpoint: "http://localhost:8080/mcp" },
      });
    });
  });
});
