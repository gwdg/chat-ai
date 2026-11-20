import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
    read: vi.fn(
      async () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("hello"));
            controller.close();
          },
        }),
    ),
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

  it("titles the pane and refreshes without a path or add-source button", async () => {
    h.listWorkspaceRoot.mockResolvedValue([]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    expect(await screen.findByText("Workspace files")).toBeInTheDocument();
    expect(screen.queryByText("Add source")).toBeNull();
    expect(screen.queryByTestId("create-workspace-path")).toBeNull();

    const calls = h.listWorkspaceRoot.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(h.listWorkspaceRoot.mock.calls.length).toBe(calls + 1);
  });

  it("drops the pane title when the sidebar asks for it", async () => {
    h.listWorkspaceRoot.mockResolvedValue([]);

    render(<WorkspaceStorageTree workspaceId="ws-1" showTitle={false} />);
    await waitFor(() => expect(h.listWorkspaceRoot).toHaveBeenCalled());

    expect(screen.queryByText("Workspace files")).toBeNull();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("marks /chats and every row under it as browser storage", async () => {
    h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
      if (path === "/") return [entry("/chats", "dir", { local: false })];
      if (path === "/chats") {
        return [entry("/chats/conv-1", "dir", { local: false })];
      }
      return [];
    });

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    const chatsRow = await screen.findByText("chats");
    expect(within(rowFor("chats")).getByText("browser")).toBeInTheDocument();

    fireEvent.click(chatsRow);

    expect(await screen.findByText("conv-1")).toBeInTheDocument();
    expect(within(rowFor("conv-1")).getByText("browser")).toBeInTheDocument();
  });

  it("ends every row with one fixed-width pill and no trash button", async () => {
    h.sources = [{ id: "dev-1", kind: "local", label: "Phone", readOnly: false }];
    h.mounts = [mountRow];
    h.providers = new Map([["dev-1", { status: "connected" }]]);
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/readme.md"),
      entry("/Phone", "dir", { local: false, mount: mountRow }),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    await screen.findByText("readme.md");
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();

    for (const name of ["readme.md", "Phone"]) {
      const pill = within(rowFor(name)).getByText(
        name === "Phone" ? "device" : "browser",
      );
      expect(pill).toHaveClass("w-14");
      expect(pill).toHaveClass("justify-center");
      expect(pill.parentElement.lastElementChild).toBe(pill);
    }
  });

  it("puts the lock before the pill on a read-only row", async () => {
    h.sources = [{ id: "dev-1", kind: "local", label: "Phone", readOnly: true }];
    h.mounts = [mountRow];
    h.providers = new Map([["dev-1", { status: "connected" }]]);
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/Phone", "dir", { local: false, mount: mountRow }),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    await screen.findByText("Phone");
    const row = rowFor("Phone");
    const lock = within(row).getByLabelText("Read-only");
    const pill = within(row).getByText("device");
    expect(lock.nextElementSibling).toBe(pill);
    expect(pill).toHaveClass("w-14");
  });

  it("locks a row that sits under a read-only mount", async () => {
    const readOnlyMount = { ...mountRow, readOnly: true };
    h.sources = [{ id: "dev-1", kind: "local", label: "Phone", readOnly: false }];
    h.mounts = [readOnlyMount];
    h.providers = new Map([["dev-1", { status: "connected" }]]);
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/Phone", "dir", { local: false, mount: readOnlyMount }),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    await screen.findByText("Phone");
    expect(
      within(rowFor("Phone")).getByLabelText("Read-only"),
    ).toBeInTheDocument();
  });

  it("locks every row of a read-only source", async () => {
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
    h.sources = [{ id: "dev-1", kind: "local", label: "Phone", readOnly: true }];
    h.mounts = [mountRow];
    h.providers = new Map([["dev-1", provider]]);
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/Phone", "dir", { local: false, mount: mountRow }),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    fireEvent.click(await screen.findByText("Phone"));

    await screen.findByText("a.jpg");
    expect(
      within(rowFor("a.jpg")).getByLabelText("Read-only"),
    ).toBeInTheDocument();
  });

  it("opens a file row in the preview pane", async () => {
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/notes.txt", "file", { mime: "text/plain" }),
    ]);
    const onPreview = vi.fn();

    render(<WorkspaceStorageTree workspaceId="ws-1" onPreview={onPreview} />);

    fireEvent.click(await screen.findByText("notes.txt"));

    expect(onPreview.mock.calls[0][0]).toEqual({
      entry: { name: "notes.txt", mime: "text/plain", size: undefined },
      loading: true,
    });
    await waitFor(() =>
      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "hello",
          entry: expect.objectContaining({ name: "notes.txt" }),
        }),
      ),
    );
  });
});
