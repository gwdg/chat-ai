import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addLocalSource, addWorkspaceMount, pickDirectory, rootProvider } =
  vi.hoisted(() => {
    const rootProvider = {
      connect: vi.fn(async () => {}),
      stat: vi.fn(),
      list: vi.fn(),
      close: vi.fn(),
    };
    return {
      addLocalSource: vi.fn(async () => "source-1"),
      addWorkspaceMount: vi.fn(async () => "mount-1"),
      pickDirectory: vi.fn(),
      rootProvider,
    };
  });

vi.mock("../../../db/workspaceDb", () => ({
  addLocalSource: (...args) => addLocalSource(...args),
  addWorkspaceMount: (...args) => addWorkspaceMount(...args),
}));

vi.mock("../../../workspace/localWorkspace", () => ({
  addLocalSource: (...args) => addLocalSource(...args),
  pickDirectory: (...args) => pickDirectory(...args),
}));

vi.mock("../../../workspace/workspaceRoot", () => ({
  createWorkspaceRootProvider: () => rootProvider,
}));

import MountLocalFolderModal from "../MountLocalFolderModal";

const handle = { name: "project", kind: "directory" };

const renderModal = (props = {}) =>
  render(
    <MountLocalFolderModal
      isOpen
      workspaceId="ws-1"
      onClose={vi.fn()}
      {...props}
    />,
  );

const choose = () =>
  fireEvent.click(screen.getByRole("button", { name: "Choose folder…" }));
const confirm = () =>
  fireEvent.click(screen.getByRole("button", { name: "Mount folder" }));

describe("MountLocalFolderModal", () => {
  beforeEach(() => {
    Object.defineProperty(window, "showDirectoryPicker", {
      value: vi.fn(),
      configurable: true,
    });
    addLocalSource.mockReset();
    addLocalSource.mockResolvedValue("source-1");
    addWorkspaceMount.mockReset();
    addWorkspaceMount.mockResolvedValue("mount-1");
    pickDirectory.mockReset();
    pickDirectory.mockResolvedValue(handle);
    rootProvider.stat.mockReset();
    rootProvider.stat.mockImplementation(async (path) => {
      const error = new Error(path);
      error.code = "NOT_FOUND";
      throw error;
    });
    rootProvider.list.mockReset();
    rootProvider.list.mockResolvedValue({ entries: [] });
  });

  it("creates the local source and mounts it under the folder name", async () => {
    const onAdded = vi.fn();
    const onClose = vi.fn();
    renderModal({ onAdded, onClose });

    choose();
    expect(await screen.findByTestId("mount-local-folder")).toHaveTextContent(
      "project",
    );
    confirm();

    await waitFor(() => expect(addLocalSource).toHaveBeenCalledTimes(1));
    expect(addLocalSource).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      handle,
      label: "project",
      readOnly: false,
    });
    expect(addWorkspaceMount).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      sourceId: "source-1",
      sourcePath: "/",
      path: "/project",
      readOnly: false,
    });
    expect(onAdded).toHaveBeenCalledWith({
      sourceId: "source-1",
      mountId: "mount-1",
      path: "/project",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("passes read-only through the picker, source and mount", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("checkbox"));
    choose();
    await screen.findByText("project");
    confirm();

    await waitFor(() => expect(addWorkspaceMount).toHaveBeenCalledTimes(1));
    expect(pickDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "read" }),
    );
    expect(addLocalSource.mock.calls[0][0]).toMatchObject({ readOnly: true });
    expect(addWorkspaceMount.mock.calls[0][0]).toMatchObject({ readOnly: true });
  });

  it("shows a target collision and creates nothing", async () => {
    rootProvider.stat.mockResolvedValueOnce({ kind: "dir", path: "/project" });
    rootProvider.list.mockResolvedValueOnce({
      entries: [{ kind: "file", path: "/project/readme.md" }],
    });
    renderModal();

    choose();
    await screen.findByText("project");
    confirm();

    expect(
      await screen.findByText("The folder /project already contains files."),
    ).toBeInTheDocument();
    expect(addLocalSource).not.toHaveBeenCalled();
    expect(addWorkspaceMount).not.toHaveBeenCalled();
  });
});
