import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceStorageTree from "../WorkspaceStorageTree";

const h = vi.hoisted(() => ({
  sources: [],
  mounts: [],
  providers: new Map(),
  rootProvider: {
    connect: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    list: vi.fn(async () => ({ entries: [] })),
  },
  openModal: vi.fn(),
  confirmAction: vi.fn((options, onConfirm) => onConfirm()),
  listWorkspaceRoot: vi.fn(),
}));

vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceSources: () => h.sources,
  useWorkspaceMounts: () => h.mounts,
  useWorkspaceChats: () => [],
}));

vi.mock("../../../db", () => ({
  useConversationList: () => [],
}));

vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({
    openModal: h.openModal,
    confirmAction: h.confirmAction,
  }),
}));

vi.mock("../../../workspace/useWorkspaceProviders", () => ({
  useWorkspaceProviders: () => ({ providers: h.providers, reconnect: vi.fn() }),
}));

vi.mock("../../../workspace/workspaceRoot", () => ({
  createWorkspaceRootProvider: () => h.rootProvider,
  emptyStream: () =>
    new ReadableStream({
      start(controller) {
        controller.close();
      },
    }),
}));

vi.mock("../../../workspace/listWorkspaceRoot", () => ({
  listWorkspaceRoot: h.listWorkspaceRoot,
}));

const entry = (path, kind = "file", extra = {}) => ({
  sourceId: "root",
  path,
  name: path.split("/").pop(),
  kind,
  local: true,
  ...extra,
});

const rowFor = (text) => screen.getByText(text).closest("div.group");

const mountRow = {
  id: "mount-1",
  workspaceId: "ws-1",
  sourceId: "dev-1",
  sourcePath: "/Photos",
  path: "/Phone",
  createdAt: 1,
  lastModified: 1,
};

beforeEach(() => {
  h.sources = [];
  h.mounts = [];
  h.providers = new Map();
  h.listWorkspaceRoot.mockReset();
  h.openModal.mockClear();
  h.confirmAction.mockClear();
  h.rootProvider.remove.mockClear();
  h.rootProvider.connect.mockClear();
});

describe("WorkspaceStorageTree", () => {
  it("renders the root listing with a browser pill", async () => {
    h.listWorkspaceRoot.mockResolvedValue([entry("/notes", "dir")]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    expect(await screen.findByText("notes")).toBeInTheDocument();
    expect(within(rowFor("notes")).getByText("browser")).toBeInTheDocument();
  });

  it("loads a folder's children when its row is clicked", async () => {
    h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
      if (path === "/") return [entry("/Docs", "dir")];
      if (path === "/Docs") return [entry("/Docs/readme.md")];
      return [];
    });

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    fireEvent.click(await screen.findByText("Docs"));

    expect(await screen.findByText("readme.md")).toBeInTheDocument();
    expect(h.listWorkspaceRoot).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/Docs" }),
    );
  });

  it("expands a mounted folder through its own provider", async () => {
    const provider = {
      status: "connected",
      connect: vi.fn(async () => {}),
      list: vi.fn(async () => ({
        entries: [
          {
            sourceId: "dev-1",
            path: "/Photos/a.jpg",
            name: "a.jpg",
            kind: "file",
          },
        ],
      })),
    };
    h.sources = [{ id: "dev-1", kind: "local", label: "Phone", readOnly: false }];
    h.mounts = [mountRow];
    h.providers = new Map([["dev-1", provider]]);
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/Phone", "dir", { local: false, mount: mountRow }),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    const phoneRow = await screen.findByText("Phone");
    expect(within(rowFor("Phone")).getByText("device")).toBeInTheDocument();

    fireEvent.click(phoneRow);

    expect(await screen.findByText("a.jpg")).toBeInTheDocument();
    expect(provider.list).toHaveBeenCalledWith("/Photos");
  });

  it("opens the add-source dialog for the workspace", async () => {
    h.listWorkspaceRoot.mockResolvedValue([]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    fireEvent.click(screen.getByText("Add source"));

    expect(h.openModal).toHaveBeenCalledWith("workspaceAddSource", {
      workspaceId: "ws-1",
    });
  });

  it("offers the trash button only on non-mount local rows", async () => {
    h.sources = [{ id: "dev-1", kind: "local", label: "Phone", readOnly: false }];
    h.mounts = [mountRow];
    h.providers = new Map([["dev-1", { status: "connected" }]]);
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/readme.md"),
      entry("/Phone", "dir", { local: false, mount: mountRow }),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    await screen.findByText("readme.md");
    expect(
      within(rowFor("readme.md")).getByRole("button", { name: "Delete" }),
    ).toBeInTheDocument();
    expect(
      within(rowFor("Phone")).queryByRole("button", { name: "Delete" }),
    ).toBeNull();
  });
});
