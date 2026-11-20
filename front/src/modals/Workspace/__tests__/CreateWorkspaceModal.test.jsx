import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  navigate: vi.fn(),
  onClose: vi.fn(),
  createWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  useWorkspaceList: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => api.navigate,
}));

vi.mock("../../../db/workspaceDb", () => ({
  createWorkspace: (...args) => api.createWorkspace(...args),
  updateWorkspace: (...args) => api.updateWorkspace(...args),
  deleteWorkspace: (...args) => api.deleteWorkspace(...args),
  useWorkspaceList: (...args) => api.useWorkspaceList(...args),
}));

vi.mock("../../../components/Workspace/WorkspaceStorageManager", () => ({
  default: ({ workspaceId, onOpenAddSource }) => (
    <div data-testid="storage-manager" data-workspace={workspaceId ?? ""}>
      <button type="button" onClick={() => onOpenAddSource?.("local")}>
        open add source
      </button>
    </div>
  ),
}));

vi.mock("../AddSourceModal", () => ({
  default: ({ initialKind, workspaceId }) => (
    <div
      data-testid="add-source-modal"
      data-kind={initialKind}
      data-workspace={workspaceId ?? ""}
    />
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
  await waitFor(() =>
    expect(screen.getByTestId("storage-manager")).toHaveAttribute(
      "data-workspace",
      id,
    ),
  );
};

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.createWorkspace.mockResolvedValue("ws-draft");
  api.updateWorkspace.mockResolvedValue(undefined);
  api.deleteWorkspace.mockResolvedValue(undefined);
  api.useWorkspaceList.mockReturnValue(EMPTY);
});

describe("CreateWorkspaceModal", () => {
  it("creates exactly one draft and hands it to the storage manager", async () => {
    renderModal();

    await waitForDraft();

    expect(api.createWorkspace).toHaveBeenCalledTimes(1);
    expect(api.createWorkspace).toHaveBeenCalledWith("New workspace");
    expect(screen.getAllByTestId("storage-manager")).toHaveLength(1);
  });

  it("opens Add source inside the dialog instead of replacing it", async () => {
    renderModal();
    await waitForDraft();

    fireEvent.click(screen.getByText("open add source"));

    expect(screen.getByTestId("add-source-modal")).toHaveAttribute(
      "data-kind",
      "local",
    );
    expect(screen.getByTestId("storage-manager")).toBeInTheDocument();
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

  it("puts icon and colour back on Cancel and keeps the modal open", async () => {
    renderModal();
    await waitForDraft();

    fireEvent.click(screen.getByTestId("create-workspace-icon"));
    fireEvent.click(screen.getByTestId("create-workspace-icon-code"));
    fireEvent.click(screen.getByTestId("create-workspace-color-violet"));
    fireEvent.click(screen.getByTestId("create-workspace-cancel"));

    expect(screen.queryByTestId("create-workspace-picker")).toBeNull();
    await waitFor(() =>
      expect(api.updateWorkspace).toHaveBeenCalledWith("ws-draft", {
        icon: "rocket",
      }),
    );
    expect(api.updateWorkspace).toHaveBeenCalledWith("ws-draft", {
      color: "rose",
    });
    expect(api.onClose).not.toHaveBeenCalled();
  });

  it("asks for a name and turns the prompt red after an empty blur", async () => {
    renderModal();
    await waitForDraft();

    const hint = screen.getByTestId("create-workspace-name-hint");
    expect(hint).toHaveTextContent("Select a name for your workspace");
    expect(hint.className).not.toContain("text-error");

    fireEvent.blur(nameInput());
    expect(hint.className).toContain("text-error");

    typeName("Research");
    expect(screen.getByTestId("create-workspace-name-hint")).toBeEmptyDOMElement();
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

describe("CreateWorkspaceModal in edit mode", () => {
  const ROW = {
    id: "ws-1",
    name: "Research",
    icon: "code",
    color: "violet",
  };

  beforeEach(() => {
    api.useWorkspaceList.mockReturnValue([ROW]);
  });

  const renderEditor = () =>
    render(
      <CreateWorkspaceModal
        isOpen
        onClose={api.onClose}
        workspaceId="ws-1"
      />,
    );

  it("fills the dialog from the workspace and needs no draft", async () => {
    renderEditor();

    await waitFor(() =>
      expect(screen.getByTestId("storage-manager")).toHaveAttribute(
        "data-workspace",
        "ws-1",
      ),
    );
    expect(nameInput()).toHaveValue("Research");
    expect(api.createWorkspace).not.toHaveBeenCalled();
    expect(screen.getByTestId("edit-workspace-apply")).toHaveTextContent(
      "Apply Changes",
    );
    expect(screen.queryByTestId("create-workspace-create")).toBeNull();
  });

  it("applies name, icon and colour in one write and stays put", async () => {
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("storage-manager")).toHaveAttribute(
        "data-workspace",
        "ws-1",
      ),
    );

    typeName("Research notes");
    fireEvent.click(screen.getByTestId("create-workspace-icon"));
    fireEvent.click(screen.getByTestId("create-workspace-icon-rocket"));
    fireEvent.click(screen.getByTestId("create-workspace-color-rose"));
    fireEvent.click(screen.getByTestId("edit-workspace-apply"));

    await waitFor(() =>
      expect(api.updateWorkspace).toHaveBeenCalledWith("ws-1", {
        name: "Research notes",
        icon: "rocket",
        color: "rose",
      }),
    );
    // The pending choices are not written one by one, and nothing navigates.
    expect(api.updateWorkspace).toHaveBeenCalledTimes(1);
    expect(api.navigate).not.toHaveBeenCalled();
    expect(api.onClose).toHaveBeenCalledTimes(1);
    expect(api.deleteWorkspace).not.toHaveBeenCalled();
  });

  it("never deletes the workspace when it is cancelled", async () => {
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("storage-manager")).toHaveAttribute(
        "data-workspace",
        "ws-1",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(api.onClose).toHaveBeenCalledTimes(1));
    expect(api.deleteWorkspace).not.toHaveBeenCalled();
    expect(api.updateWorkspace).not.toHaveBeenCalled();
  });
});
