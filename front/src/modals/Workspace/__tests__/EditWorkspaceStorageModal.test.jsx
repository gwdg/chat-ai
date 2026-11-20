import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  onClose: vi.fn(),
}));

vi.mock("../../../components/Workspace/WorkspaceStorageManager", () => ({
  default: ({ workspaceId, onOpenAddSource }) => (
    <div data-testid="storage-manager" data-workspace={workspaceId ?? ""}>
      <button type="button" onClick={() => onOpenAddSource?.("git")}>
        open add source
      </button>
      <button type="button" onClick={() => onOpenAddSource?.()}>
        open add source without a kind
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

import EditWorkspaceStorageModal from "../EditWorkspaceStorageModal";

const renderModal = (props = {}) =>
  render(
    <EditWorkspaceStorageModal
      isOpen
      onClose={api.onClose}
      workspaceId="ws-1"
      workspaceName="Teaching"
      {...props}
    />,
  );

beforeEach(() => {
  api.onClose.mockReset();
});

describe("EditWorkspaceStorageModal", () => {
  it("shows the storage manager of the workspace it was opened for", () => {
    renderModal();

    expect(screen.getByTestId("storage-manager")).toHaveAttribute(
      "data-workspace",
      "ws-1",
    );
    expect(
      screen.getByTestId("edit-workspace-storage-hint"),
    ).toHaveTextContent(
      "Storage locations of Teaching. Every change is applied immediately.",
    );
  });

  it("keeps Add source inside the dialog instead of replacing it", () => {
    renderModal();

    expect(screen.queryByTestId("add-source-modal")).toBeNull();

    fireEvent.click(screen.getByText("open add source"));

    // The nested picker knows both the workspace and the kind the source rail asked for.
    expect(screen.getByTestId("add-source-modal")).toHaveAttribute(
      "data-kind",
      "git",
    );
    expect(screen.getByTestId("add-source-modal")).toHaveAttribute(
      "data-workspace",
      "ws-1",
    );
    expect(screen.getByTestId("storage-manager")).toBeInTheDocument();
  });

  it("defaults to a local folder when the rail names no kind", () => {
    renderModal();

    fireEvent.click(screen.getByText("open add source without a kind"));

    expect(screen.getByTestId("add-source-modal")).toHaveAttribute(
      "data-kind",
      "local",
    );
  });

  it("closes the dialog from its own button", () => {
    renderModal();

    fireEvent.click(screen.getByTestId("edit-workspace-storage-close"));

    expect(api.onClose).toHaveBeenCalled();
  });

  it("falls back to a plain hint when the name is unknown", () => {
    renderModal({ workspaceName: "" });

    expect(
      screen.getByTestId("edit-workspace-storage-hint"),
    ).toHaveTextContent("Every change is applied immediately.");
  });
});
