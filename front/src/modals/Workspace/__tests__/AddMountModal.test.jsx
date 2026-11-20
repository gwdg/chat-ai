import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addWorkspaceMount, sourceProvider, rootProvider } = vi.hoisted(() => {
  const sourceProvider = {
    connect: vi.fn(async () => {}),
    list: vi.fn(),
    close: vi.fn(),
  };
  const rootProvider = {
    connect: vi.fn(async () => {}),
    list: vi.fn(),
    stat: vi.fn(),
    close: vi.fn(),
  };
  return {
    addWorkspaceMount: vi.fn(async () => "mount-1"),
    sourceProvider,
    rootProvider,
  };
});

vi.mock("../../../db/workspaceDb", () => ({
  addWorkspaceMount: (...args) => addWorkspaceMount(...args),
}));

vi.mock("../../../workspace/providers", () => ({
  createProvider: () => sourceProvider,
}));

vi.mock("../../../workspace/workspaceRoot", () => ({
  createWorkspaceRootProvider: () => rootProvider,
}));

import AddMountModal from "../AddMountModal";

const source = {
  id: "s1",
  workspaceId: "ws-1",
  kind: "local",
  label: "Local",
  config: {},
  capabilities: {},
  readOnly: false,
};

const renderModal = (props = {}) =>
  render(
    <AddMountModal
      isOpen
      workspaceId="ws-1"
      sources={[source]}
      mounts={[]}
      onClose={vi.fn()}
      {...props}
    />,
  );

const sourcePanel = () => screen.getByTestId("folder-picker-source");
const workspacePanel = () => screen.getByTestId("folder-picker-workspace");
const currentIn = (panel) => within(panel).getByTestId("folder-picker-current");

const clickFolder = async (panel, name) =>
  fireEvent.click(await within(panel).findByRole("button", { name }));

const clickUp = (panel) =>
  fireEvent.click(
    within(panel).getByRole("button", { name: "Up one level" }),
  );

describe("AddMountModal folder pickers", () => {
  beforeEach(() => {
    addWorkspaceMount.mockClear();
    sourceProvider.connect.mockClear();
    sourceProvider.list.mockReset();
    rootProvider.list.mockReset();
    rootProvider.stat.mockReset();
    // Nothing exists at a destination path unless a test says so.
    rootProvider.stat.mockImplementation(async (path) => {
      const error = new Error(path);
      error.code = "NOT_FOUND";
      throw error;
    });

    sourceProvider.list.mockImplementation(async (path) =>
      path === "/"
        ? {
            entries: [
              { path: "/shoe", name: "shoe", kind: "dir", sourceId: "s1" },
              { path: "/notes.txt", name: "notes.txt", kind: "file", sourceId: "s1" },
            ],
          }
        : {
            entries: [
              { path: `${path}/inner`, name: "inner", kind: "dir", sourceId: "s1" },
            ],
          },
    );
    rootProvider.list.mockImplementation(async (path) =>
      path === "/"
        ? { entries: [{ path: "/docs", name: "docs", kind: "dir" }] }
        : { entries: [] },
    );
  });

  it("expands both directory lists and offers no editable path fields", () => {
    renderModal();

    expect(sourcePanel()).toBeInTheDocument();
    expect(workspacePanel()).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("lists only folders of the selected source", async () => {
    renderModal();

    expect(
      await within(sourcePanel()).findByRole("button", { name: "shoe" }),
    ).toBeInTheDocument();
    expect(
      within(sourcePanel()).queryByRole("button", { name: "notes.txt" }),
    ).not.toBeInTheDocument();
  });

  it("names the mount after the source when its root is selected", async () => {
    renderModal();

    await within(sourcePanel()).findByRole("button", { name: "shoe" });

    expect(currentIn(sourcePanel())).toHaveTextContent(/^\/$/);
    expect(within(workspacePanel()).getByText("Mounts at /Local")).toBeInTheDocument();
  });

  it("selects a source folder and places the mount under the same name", async () => {
    renderModal();

    await clickFolder(sourcePanel(), "shoe");

    expect(currentIn(sourcePanel())).toHaveTextContent("/shoe");
    expect(within(workspacePanel()).getByText("Mounts at /shoe")).toBeInTheDocument();
  });

  it("descends into a folder and selects it", async () => {
    renderModal();

    await clickFolder(sourcePanel(), "shoe");
    await clickFolder(sourcePanel(), "inner");

    expect(currentIn(sourcePanel())).toHaveTextContent("/shoe/inner");
    expect(
      within(workspacePanel()).getByText("Mounts at /inner"),
    ).toBeInTheDocument();
  });

  it("goes back up with the up button", async () => {
    renderModal();
    await clickFolder(sourcePanel(), "shoe");

    clickUp(sourcePanel());

    expect(currentIn(sourcePanel())).toHaveTextContent(/^\/$/);
    expect(within(workspacePanel()).getByText("Mounts at /Local")).toBeInTheDocument();
  });

  it("places the mount inside a picked workspace folder", async () => {
    renderModal();
    await clickFolder(sourcePanel(), "shoe");

    await clickFolder(workspacePanel(), "docs");

    expect(within(workspacePanel()).getByText("Mounts at /docs/shoe")).toBeInTheDocument();
    expect(currentIn(workspacePanel())).toHaveTextContent("/docs");
  });

  it("keeps the picked workspace folder when another source folder is picked", async () => {
    renderModal();
    await clickFolder(sourcePanel(), "shoe");
    await clickFolder(workspacePanel(), "docs");

    await clickFolder(sourcePanel(), "inner");

    expect(
      within(workspacePanel()).getByText("Mounts at /docs/inner"),
    ).toBeInTheDocument();
  });

  it("resets the source folder when another source is selected", async () => {
    renderModal({
      sources: [source, { ...source, id: "s2", label: "Second" }],
    });
    await clickFolder(sourcePanel(), "shoe");

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "s2" },
    });

    expect(currentIn(sourcePanel())).toHaveTextContent(/^\/$/);
    expect(within(workspacePanel()).getByText("Mounts at /Second")).toBeInTheDocument();
  });

  it("lists folders from later pages of a paginated source", async () => {
    sourceProvider.list
      .mockResolvedValueOnce({
        entries: [{ path: "/a", name: "a", kind: "dir", sourceId: "s1" }],
        next: "cursor-1",
      })
      .mockResolvedValueOnce({
        entries: [{ path: "/b", name: "b", kind: "dir", sourceId: "s1" }],
      });
    renderModal();

    expect(
      await within(sourcePanel()).findByRole("button", { name: "b" }),
    ).toBeInTheDocument();
    expect(
      within(sourcePanel()).getByRole("button", { name: "a" }),
    ).toBeInTheDocument();
  });

  it("starts on the workspace browser source when adding from the root", async () => {
    // Source order is not guaranteed, and an Arcana source can be unreachable; the root "Add
    // folder" action belongs to the workspace's own browser tree.
    renderModal({
      sources: [
        {
          ...source,
          id: "arcana",
          kind: "arcana-filesystem",
          label: "Arcana filesystem",
        },
        { ...source, id: "browser", kind: "browser", label: "Browser storage" },
      ],
    });

    expect(screen.getByRole("combobox")).toHaveValue("browser");
    expect(
      await within(workspacePanel()).findByText("Mounts at /Browser storage"),
    ).toBeInTheDocument();
  });

  it("shows a readable reason when a source cannot be listed", async () => {
    sourceProvider.list.mockRejectedValueOnce(new Error("Not Found"));
    renderModal();

    expect(
      await within(sourcePanel()).findByText("Could not load folders."),
    ).toBeInTheDocument();
    expect(within(sourcePanel()).getByText("Not Found")).toBeInTheDocument();
    expect(within(sourcePanel()).queryByText(/\{"detail"/)).toBeNull();
  });

  it("refuses a destination that already contains files", async () => {
    rootProvider.stat.mockImplementation(async (path) =>
      path === "/shoe"
        ? { path, name: "shoe", kind: "dir" }
        : Promise.reject(Object.assign(new Error(path), { code: "NOT_FOUND" })),
    );
    rootProvider.list.mockImplementation(async (path) =>
      path === "/shoe"
        ? { entries: [{ path: "/shoe/notes.txt", name: "notes.txt", kind: "file" }] }
        : path === "/"
          ? { entries: [{ path: "/docs", name: "docs", kind: "dir" }] }
          : { entries: [] },
    );
    renderModal();

    await clickFolder(sourcePanel(), "shoe");

    expect(await screen.findByTestId("mount-target-problem")).toHaveTextContent(
      "The folder /shoe already contains files.",
    );
    expect(screen.getByRole("button", { name: "Add folder" })).toBeDisabled();
    expect(addWorkspaceMount).not.toHaveBeenCalled();
  });

  it("refuses a destination that already has a mounted folder", async () => {
    renderModal({
      mounts: [
        {
          id: "m1",
          workspaceId: "ws-1",
          sourceId: "s1",
          path: "/shoe",
          readOnly: false,
        },
      ],
    });

    await clickFolder(sourcePanel(), "shoe");

    expect(await screen.findByTestId("mount-target-problem")).toHaveTextContent(
      "The workspace already has a folder at /shoe.",
    );
    expect(screen.getByRole("button", { name: "Add folder" })).toBeDisabled();
    expect(addWorkspaceMount).not.toHaveBeenCalled();
  });

  it("does not offer a mounted folder as the destination", async () => {
    renderModal({
      mounts: [
        {
          id: "m1",
          workspaceId: "ws-1",
          sourceId: "s1",
          path: "/media",
          readOnly: false,
        },
      ],
    });

    expect(
      await within(workspacePanel()).findByRole("button", { name: "docs" }),
    ).toBeInTheDocument();
    expect(
      within(workspacePanel()).queryByRole("button", { name: "media" }),
    ).toBeNull();
  });

  it("adds the mount with the picked paths", async () => {
    renderModal();
    await clickFolder(sourcePanel(), "shoe");
    await clickFolder(workspacePanel(), "docs");

    fireEvent.click(screen.getByRole("button", { name: "Add folder" }));

    await waitFor(() =>
      expect(addWorkspaceMount).toHaveBeenCalledWith({
        workspaceId: "ws-1",
        sourceId: "s1",
        sourcePath: "/shoe",
        path: "/docs/shoe",
        readOnly: false,
      }),
    );
  });
});
