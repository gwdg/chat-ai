import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceStorageTree, {
  resetExpandedFolders,
} from "../WorkspaceStorageTree";
import { WorkspaceError } from "../../../workspace/providers/types";

const h = vi.hoisted(() => ({
  sources: [],
  mounts: [],
  providers: new Map(),
  rootProvider: {
    sourceId: "root",
    kind: "browser",
    status: "connected",
    capabilities: {
      read: true,
      write: true,
      delete: true,
      mkdir: true,
      rename: true,
      move: true,
      copy: true,
    },
    connect: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
    write: vi.fn(async (path) => ({ path, kind: "file" })),
    stat: vi.fn(),
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
  removeMount: vi.fn(),
  listWorkspaceRoot: vi.fn(),
  upload: vi.fn(async () => 1),
  download: vi.fn(async () => {}),
  canPickDownloadDirectory: () => h.pickFolderSupported,
  pickFolderSupported: false,
  pickDirectory: vi.fn(),
  saveEntries: vi.fn(async () => []),
  runTransfer: vi.fn(async () => {}),
}));

vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceSources: () => h.sources,
  useWorkspaceMounts: () => h.mounts,
  useWorkspaceChats: () => [],
  removeWorkspaceMount: (...args) => h.removeMount(...args),
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

vi.mock("../../../workspace/upload", () => ({
  uploadLocalFiles: (...args) => h.upload(...args),
}));

vi.mock("../../../workspace/transfer", () => ({
  runTransfer: (...args) => h.runTransfer(...args),
}));

vi.mock("../../../workspace/download", () => ({
  downloadProviderEntry: (...args) => h.download(...args),
  canPickDownloadDirectory: () => h.canPickDownloadDirectory(),
  pickDownloadDirectory: (...args) => h.pickDirectory(...args),
  saveProviderEntriesToDirectory: (...args) => h.saveEntries(...args),
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
  resetExpandedFolders();
  h.sources = [];
  h.mounts = [];
  h.providers = new Map();
  h.listWorkspaceRoot.mockReset();
  h.openModal.mockClear();
  h.confirmAction.mockClear();
  h.removeMount.mockReset();
  h.removeMount.mockResolvedValue(undefined);
  h.upload.mockClear();
  h.download.mockClear();
  h.pickFolderSupported = false;
  h.pickDirectory.mockReset();
  h.saveEntries.mockReset();
  h.saveEntries.mockResolvedValue([]);
  h.runTransfer.mockReset();
  h.runTransfer.mockResolvedValue(undefined);
  h.rootProvider.remove.mockClear();
  h.rootProvider.connect.mockClear();
  h.rootProvider.rename.mockClear();
  h.rootProvider.stat.mockReset();
  h.rootProvider.stat.mockImplementation(async () => {
    throw new WorkspaceError("NOT_FOUND", "/");
  });
});

describe("WorkspaceStorageTree", () => {
  it("renders the root listing without a browser pill", async () => {
    h.listWorkspaceRoot.mockResolvedValue([entry("/notes", "dir")]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    expect(await screen.findByText("notes")).toBeInTheDocument();
    expect(within(rowFor("notes")).queryByText("browser")).toBeNull();
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

  it("reports an unavailable folder once instead of retrying it", async () => {
    h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
      if (path === "/") return [entry("/Docs", "dir")];
      throw new WorkspaceError("NOT_FOUND", path);
    });
    const folderCalls = () =>
      h.listWorkspaceRoot.mock.calls.filter(
        ([request]) => request.path === "/Docs",
      ).length;

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("Docs"));

    // The row names the folder, a yellow triangle marks the failure, and a
    // provider reason that says something beyond the path is appended.
    const failure = await screen.findByText("Could not open “Docs”");
    expect(
      failure
        .closest('[data-guide="workspace-folder-error"]')
        .querySelector("svg"),
    ).toHaveClass("text-warning");
    expect(folderCalls()).toBe(1);

    // Collapsing makes the row render again: an automatic retry would list it a
    // second time here, because a failed attempt leaves it open with no children.
    fireEvent.click(screen.getByText("Docs"));
    expect(folderCalls()).toBe(1);
  });

  it("tries an unavailable folder again only when the row is reopened", async () => {
    h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
      if (path === "/") return [entry("/Docs", "dir")];
      throw new WorkspaceError("NOT_FOUND", path);
    });
    const folderCalls = () =>
      h.listWorkspaceRoot.mock.calls.filter(
        ([request]) => request.path === "/Docs",
      ).length;

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("Docs"));
    await screen.findByText("Could not open “Docs”");

    // Collapse and expand: the user asked for the folder again.
    fireEvent.click(screen.getByText("Docs"));
    fireEvent.click(screen.getByText("Docs"));

    await waitFor(() => expect(folderCalls()).toBe(2));
    expect(await screen.findByText("Could not open “Docs”")).toBeInTheDocument();
    expect(folderCalls()).toBe(2);
  });

  it("appends the provider's reason under a folder it cannot open", async () => {
    h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
      if (path === "/") return [entry("/Docs", "dir")];
      throw new WorkspaceError(
        "PROVIDER_ERROR",
        "The service is not answering.",
      );
    });

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("Docs"));

    const failure = await screen.findByText(
      "Could not open “Docs”: The service is not answering.",
    );
    expect(
      failure.closest('[data-guide="workspace-folder-error"]'),
    ).not.toBeNull();
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

  it("opens the global create dialog when no host owns it", async () => {
    h.listWorkspaceRoot.mockResolvedValue([]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "New folder" }));

    expect(h.openModal).toHaveBeenCalledWith(
      "workspaceCreateEntry",
      expect.objectContaining({ kind: "dir", path: "/" }),
    );
  });

  it("hands a new entry to the host dialog instead of replacing it", async () => {
    h.listWorkspaceRoot.mockResolvedValue([]);
    const onCreateEntry = vi.fn();

    render(
      <WorkspaceStorageTree
        workspaceId="ws-1"
        onCreateEntry={onCreateEntry}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "New file" }));

    // The Manage Workspace dialog holds its own draft, so a global modal must not close it.
    expect(onCreateEntry).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "file", path: "/" }),
    );
    expect(h.openModal).not.toHaveBeenCalled();
  });

  it("drops the pane title when the sidebar asks for it", async () => {
    h.listWorkspaceRoot.mockResolvedValue([]);

    render(<WorkspaceStorageTree workspaceId="ws-1" showTitle={false} />);
    await waitFor(() => expect(h.listWorkspaceRoot).toHaveBeenCalled());

    expect(screen.queryByText("Workspace files")).toBeNull();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("lists /chats and every row under it without a browser pill", async () => {
    h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
      if (path === "/") return [entry("/chats", "dir", { local: false })];
      if (path === "/chats") {
        return [entry("/chats/conv-1", "dir", { local: false })];
      }
      return [];
    });

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    const chatsRow = await screen.findByText("chats");
    expect(within(rowFor("chats")).queryByText("browser")).toBeNull();

    fireEvent.click(chatsRow);

    expect(await screen.findByText("conv-1")).toBeInTheDocument();
    expect(within(rowFor("conv-1")).queryByText("browser")).toBeNull();
  });

  it("shows / as the workspace root drop target", async () => {
    h.listWorkspaceRoot.mockResolvedValue([entry("/Docs", "dir")]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    await screen.findByText("Docs");

    const rootRow = document.querySelector('[data-guide="workspace-root-row"]');
    expect(rootRow).not.toBeNull();
    expect(within(rootRow).getByText("/")).toBeInTheDocument();
  });

  it("pills only rows that come from a source", async () => {
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

    const pill = within(rowFor("Phone")).getByText("device");
    expect(pill).toHaveClass("w-14");
    expect(pill).toHaveClass("justify-center");
    expect(pill.parentElement.lastElementChild).toBe(pill);

    expect(within(rowFor("readme.md")).queryByText("browser")).toBeNull();
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

  it("offers to save a description beside an image", async () => {
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/chart.png", "file", { mime: "image/png" }),
    ]);
    h.rootProvider.write.mockClear();
    const onPreview = vi.fn();

    render(<WorkspaceStorageTree workspaceId="ws-1" onPreview={onPreview} />);

    fireEvent.click(await screen.findByText("chart.png"));

    await waitFor(() =>
      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({ saveDescription: expect.any(Function) }),
      ),
    );
    const request = onPreview.mock.calls.at(-1)[0];
    await request.saveDescription("# chart.png\n\nA chart.\n", "chart-description.md");

    // The description is a sibling of the image, not a workspace-root file.
    expect(h.rootProvider.write).toHaveBeenCalledWith(
      "/chart-description.md",
      expect.anything(),
      { size: expect.any(Number), overwrite: true },
    );
    // The result opens in the preview pane, replacing the image it describes.
    await waitFor(() =>
      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          entry: expect.objectContaining({ name: "chart-description.md" }),
          text: "hello",
        }),
      ),
    );
  });

  // A description that is already beside the image is opened again, not
  // overwritten: `descriptionExists` asks the provider and `openDescription`
  // previews the sibling without writing anything.
  it("reopens an existing description instead of writing a new one", async () => {
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/chart.png", "file", { mime: "image/png" }),
    ]);
    h.rootProvider.write.mockClear();
    h.rootProvider.stat.mockResolvedValue({
      sourceId: "root",
      path: "/chart-description.md",
      name: "chart-description.md",
      kind: "file",
    });
    const onPreview = vi.fn();

    render(<WorkspaceStorageTree workspaceId="ws-1" onPreview={onPreview} />);

    fireEvent.click(await screen.findByText("chart.png"));
    await waitFor(() =>
      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({ descriptionExists: expect.any(Function) }),
      ),
    );
    const request = onPreview.mock.calls.at(-1)[0];

    await expect(
      request.descriptionExists("chart-description.md"),
    ).resolves.toBe(true);
    await request.openDescription("chart-description.md");

    expect(h.rootProvider.write).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          entry: expect.objectContaining({ name: "chart-description.md" }),
          text: "hello",
        }),
      ),
    );
  });

  it("selects a file and offers a Detach it cannot use", async () => {
    h.listWorkspaceRoot.mockResolvedValue([entry("/notes.txt", "file")]);

    render(<WorkspaceStorageTree workspaceId="ws-1" allowDetach />);

    const file = await screen.findByText("notes.txt");

    expect(
      screen.queryByRole("button", { name: "Detach" }),
    ).not.toBeInTheDocument();

    fireEvent.click(file);

    expect(rowFor("notes.txt")).toHaveClass("bg-accent/10");
    expect(screen.getByRole("button", { name: "Detach" })).toBeDisabled();
  });

  it("detaches the selected mount from the workspace", async () => {
    const provider = {
      status: "connected",
      connect: vi.fn(async () => {}),
      list: vi.fn(async () => ({ entries: [] })),
    };
    h.sources = [{ id: "dev-1", kind: "local", label: "Phone", readOnly: false }];
    h.mounts = [mountRow];
    h.providers = new Map([["dev-1", provider]]);
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/Phone", "dir", { local: false, mount: mountRow }),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" allowDetach />);

    fireEvent.click(await screen.findByText("Phone"));

    const detach = await screen.findByRole("button", { name: "Detach" });
    expect(detach).toBeEnabled();
    fireEvent.click(detach);

    await waitFor(() =>
      expect(h.removeMount).toHaveBeenCalledWith("ws-1", "mount-1"),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Detach" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("renames the selected entry in place", async () => {
    h.listWorkspaceRoot.mockResolvedValue([entry("/notes.txt")]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("notes.txt"));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect(h.openModal).toHaveBeenCalledWith(
      "workspaceCreateEntry",
      expect.objectContaining({
        path: "/",
        initialName: "notes.txt",
        titleKey: "workspace.rename_entry",
        confirmKey: "common.rename",
      }),
    );

    const request = h.openModal.mock.calls.at(-1)[1];
    await request.onCreate("renamed.txt");
    expect(h.rootProvider.rename).toHaveBeenCalledWith(
      "/notes.txt",
      "renamed.txt",
    );
  });

  it("offers no Rename for a mount point or a synthetic folder", async () => {
    h.sources = [{ id: "dev-1", kind: "local", label: "Phone", readOnly: false }];
    h.mounts = [mountRow];
    h.providers = new Map([["dev-1", { status: "connected" }]]);
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/Phone", "dir", { local: false, mount: mountRow }),
      entry("/chats", "dir", { local: false }),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    fireEvent.click(await screen.findByText("Phone"));
    expect(
      screen.queryByRole("button", { name: "Rename" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("chats"));
    expect(
      screen.queryByRole("button", { name: "Rename" }),
    ).not.toBeInTheDocument();
  });

  it("offers no Rename when the provider cannot rename", async () => {
    const provider = {
      status: "connected",
      capabilities: { rename: false },
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
    fireEvent.click(await screen.findByText("Phone"));
    fireEvent.click(await screen.findByText("a.jpg"));

    expect(
      screen.queryByRole("button", { name: "Rename" }),
    ).not.toBeInTheDocument();
  });

  it("renames a row inside a mount through that source's provider", async () => {
    const provider = {
      status: "connected",
      capabilities: { rename: true },
      connect: vi.fn(async () => {}),
      rename: vi.fn(async () => {}),
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
    fireEvent.click(await screen.findByText("Phone"));
    fireEvent.click(await screen.findByText("a.jpg"));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    const request = h.openModal.mock.calls.at(-1)[1];
    expect(request).toEqual(
      expect.objectContaining({ path: "/Phone", initialName: "a.jpg" }),
    );
    await request.onCreate("b.jpg");
    expect(provider.rename).toHaveBeenCalledWith("/Photos/a.jpg", "b.jpg");
  });

  it("downloads the selected file through its provider", async () => {
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/notes.txt", "file", { mime: "text/plain", size: 5 }),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("notes.txt"));
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() =>
      expect(h.download).toHaveBeenCalledWith(
        h.rootProvider,
        expect.objectContaining({
          name: "notes.txt",
          path: "/notes.txt",
          kind: "file",
        }),
      ),
    );
  });

  it("offers no Download for a folder", async () => {
    h.listWorkspaceRoot.mockResolvedValue([entry("/Docs", "dir")]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("Docs"));

    expect(
      screen.queryByRole("button", { name: "Download" }),
    ).not.toBeInTheDocument();
  });

  it("deletes the selected file only after an explicit confirmation", async () => {
    h.listWorkspaceRoot.mockResolvedValue([entry("/notes.txt")]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("notes.txt"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const request = h.openModal.mock.calls.at(-1);
    expect(request[0]).toBe("confirmAction");
    expect(request[1]).toEqual(
      expect.objectContaining({
        messageKey: "workspace.delete_file_confirm",
        confirmKey: "common.delete",
        danger: true,
        showDontShowAgain: false,
      }),
    );
    expect(h.rootProvider.remove).not.toHaveBeenCalled();

    await request[1].onConfirm();
    await waitFor(() =>
      expect(h.rootProvider.remove).toHaveBeenCalledWith("/notes.txt", {
        recursive: false,
      }),
    );
  });

  it("deletes a folder recursively", async () => {
    h.listWorkspaceRoot.mockResolvedValue([entry("/Docs", "dir")]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("Docs"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const request = h.openModal.mock.calls.at(-1);
    expect(request[1]).toEqual(
      expect.objectContaining({ messageKey: "workspace.delete_folder_confirm" }),
    );

    await request[1].onConfirm();
    await waitFor(() =>
      expect(h.rootProvider.remove).toHaveBeenCalledWith("/Docs", {
        recursive: true,
      }),
    );
  });

  it("offers neither Download nor Delete on a read-only row", async () => {
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/locked.txt", "file", { readOnly: true }),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("locked.txt"));

    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("offers no Delete for a mount point", async () => {
    h.sources = [{ id: "dev-1", kind: "local", label: "Phone", readOnly: false }];
    h.mounts = [mountRow];
    h.providers = new Map([["dev-1", { status: "connected" }]]);
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/Phone", "dir", { local: false, mount: mountRow }),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("Phone"));

    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("selects without offering Detach outside the dialogs", async () => {
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/notes.txt", "file"),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    fireEvent.click(await screen.findByText("notes.txt"));

    expect(rowFor("notes.txt")).toHaveClass("bg-accent/10");
    expect(
      screen.queryByRole("button", { name: "Detach" }),
    ).not.toBeInTheDocument();
  });

  // The tree used to refresh only "/" — every expanded folder kept the children it
  // had listed once, so a file the agent created inside it never showed up until the
  // sidebar was collapsed and rebuilt.
  it("refreshes the children of every open folder, not only the root", async () => {
    let docs = [entry("/Docs/one.md")];
    h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
      if (path === "/") return [entry("/Docs", "dir")];
      if (path === "/Docs") return docs;
      return [];
    });

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    fireEvent.click(await screen.findByText("Docs"));
    expect(await screen.findByText("one.md")).toBeInTheDocument();

    docs = [...docs, entry("/Docs/two.md")];
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(await screen.findByText("two.md")).toBeInTheDocument();
    expect(screen.getByText("one.md")).toBeInTheDocument();
  });

  it("lists a collapsed folder fresh after a refresh", async () => {
    let docs = [entry("/Docs/one.md")];
    h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
      if (path === "/") return [entry("/Docs", "dir")];
      if (path === "/Docs") return docs;
      return [];
    });

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    fireEvent.click(await screen.findByText("Docs"));
    expect(await screen.findByText("one.md")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Docs"));
    expect(screen.queryByText("one.md")).not.toBeInTheDocument();

    docs = [...docs, entry("/Docs/two.md")];
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    fireEvent.click(screen.getByText("Docs"));

    expect(await screen.findByText("two.md")).toBeInTheDocument();
  });

  it("follows the agent's own writes for this workspace", async () => {
    let docs = [entry("/Docs/one.md")];
    h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
      if (path === "/") return [entry("/Docs", "dir")];
      if (path === "/Docs") return docs;
      return [];
    });

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("Docs"));
    expect(await screen.findByText("one.md")).toBeInTheDocument();

    docs = [...docs, entry("/Docs/two.md")];
    fireEvent(
      window,
      new CustomEvent("chatai:workspace-files-changed", {
        detail: { workspaceId: "another-workspace" },
      }),
    );
    expect(screen.queryByText("two.md")).not.toBeInTheDocument();

    fireEvent(
      window,
      new CustomEvent("chatai:workspace-files-changed", {
        detail: { workspaceId: "ws-1" },
      }),
    );
    expect(await screen.findByText("two.md")).toBeInTheDocument();
  });

  const fireChange = (detail) =>
    fireEvent(
      window,
      new CustomEvent("chatai:workspace-files-changed", { detail }),
    );

  const markFor = () => document.querySelector('[data-guide="file-mark"]');

  const mountWithDocs = async (docs) => {
    h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
      if (path === "/") return [entry("/Docs", "dir")];
      if (path === "/Docs") return docs;
      return [];
    });
    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("Docs"));
    await screen.findByText("one.md");
  };

  it("marks a file the agent just created, and an edited file in amber", async () => {
    await mountWithDocs([entry("/Docs/one.md")]);
    expect(markFor()).toBeNull();

    fireChange({ workspaceId: "ws-1", path: "/Docs/one.md", kind: "modify" });
    await waitFor(() => expect(markFor()).toHaveAttribute("data-mark", "modify"));
    expect(markFor().className).toContain("bg-warning");

    fireChange({ workspaceId: "ws-1", path: "/Docs/one.md", kind: "create" });
    await waitFor(() =>
      expect(markFor().className).toContain("bg-success"),
    );
  });

  it("keeps a brand-new file green while the agent edits it", async () => {
    await mountWithDocs([entry("/Docs/one.md")]);

    fireChange({ workspaceId: "ws-1", path: "/Docs/one.md", kind: "create" });
    await waitFor(() => expect(markFor()).toHaveAttribute("data-mark", "create"));
    const first = markFor();

    fireChange({ workspaceId: "ws-1", path: "/Docs/one.md", kind: "modify" });
    await waitFor(() => expect(markFor()).not.toBe(first));
    expect(markFor()).toHaveAttribute("data-mark", "create");
  });

  it("restarts the dot when the same file changes again", async () => {
    await mountWithDocs([entry("/Docs/one.md")]);

    fireChange({ workspaceId: "ws-1", path: "/Docs/one.md", kind: "modify" });
    await waitFor(() => expect(markFor()).not.toBeNull());
    const first = markFor();

    fireChange({ workspaceId: "ws-1", path: "/Docs/one.md", kind: "modify" });
    // A new key remounts the dot, which is what replays the fade from the top.
    await waitFor(() => expect(markFor()).not.toBe(first));
  });

  it("fades a mark away after a few seconds", async () => {
    await mountWithDocs([entry("/Docs/one.md")]);

    fireChange({ workspaceId: "ws-1", path: "/Docs/one.md", kind: "create" });
    await waitFor(() => expect(markFor()).not.toBeNull());

    await waitFor(() => expect(markFor()).toBeNull(), { timeout: 6000 });
  }, 10000);

  it("remembers unfolded folders when the tab is unmounted and comes back", async () => {
    h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
      if (path === "/") return [entry("/Docs", "dir")];
      if (path === "/Docs") return [entry("/Docs/one.md")];
      return [];
    });

    const first = render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("Docs"));
    await screen.findByText("one.md");
    first.unmount();

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    // Doc's row still carries the disclosure and its children come back with it.
    expect(await screen.findByText("one.md")).toBeInTheDocument();
    expect(screen.getByText("Docs").closest("button")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("also remembers a folder that was folded again", async () => {
    h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
      if (path === "/") return [entry("/Docs", "dir")];
      if (path === "/Docs") return [entry("/Docs/one.md")];
      return [];
    });

    const first = render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("Docs"));
    await screen.findByText("one.md");
    fireEvent.click(screen.getByText("Docs"));
    first.unmount();

    render(<WorkspaceStorageTree workspaceId="ws-1" />);

    expect(await screen.findByText("Docs")).toBeInTheDocument();
    expect(screen.queryByText("one.md")).not.toBeInTheDocument();
    expect(screen.getByText("Docs").closest("button")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("drops the wash when the empty part of the list is clicked", async () => {
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/notes.txt", "file"),
      entry("/Docs", "dir"),
    ]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("notes.txt"));
    expect(rowFor("notes.txt")).toHaveClass("bg-accent/10");

    fireEvent.click(document.querySelector('[data-guide="workspace-files"]'));

    expect(rowFor("notes.txt")).not.toHaveClass("bg-accent/10");
  });

  it("keeps the wash when the click lands on the row itself", async () => {
    h.listWorkspaceRoot.mockResolvedValue([entry("/notes.txt", "file")]);

    render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("notes.txt"));

    fireEvent.click(document.querySelector('[data-guide="workspace-files"]'));
    fireEvent.click(screen.getByText("notes.txt"));

    expect(rowFor("notes.txt")).toHaveClass("bg-accent/10");
  });

  const addFile = (container) =>
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(["x"], "a.txt", { type: "text/plain" })] },
    });

  it("adds a file to the browser root when nothing is selected", async () => {
    h.listWorkspaceRoot.mockResolvedValue([entry("/Docs", "dir")]);

    const { container } = render(<WorkspaceStorageTree workspaceId="ws-1" />);
    await screen.findByText("Docs");

    addFile(container);

    await waitFor(() => expect(h.upload).toHaveBeenCalled());
    const [provider, directory] = h.upload.mock.calls[0];
    expect(provider).toBe(h.rootProvider);
    expect(directory).toBe("/");
  });

  it("adds into a selected folder, and back to the browser root once it is cleared", async () => {
    const provider = {
      status: "connected",
      connect: vi.fn(async () => {}),
      list: vi.fn(async () => ({ entries: [] })),
    };
    h.sources = [{ id: "dev-1", kind: "local", label: "Phone", readOnly: false }];
    h.mounts = [mountRow];
    h.providers = new Map([["dev-1", provider]]);
    h.listWorkspaceRoot.mockResolvedValue([
      entry("/Phone", "dir", { local: false, mount: mountRow }),
    ]);

    const { container } = render(<WorkspaceStorageTree workspaceId="ws-1" />);
    fireEvent.click(await screen.findByText("Phone"));

    addFile(container);
    await waitFor(() => expect(h.upload).toHaveBeenCalledTimes(1));
    expect(h.upload.mock.calls[0][0]).toBe(provider);
    expect(h.upload.mock.calls[0][1]).toBe("/Photos");

    fireEvent.click(document.querySelector('[data-guide="workspace-files"]'));
    addFile(container);

    await waitFor(() => expect(h.upload).toHaveBeenCalledTimes(2));
    expect(h.upload.mock.calls[1][0]).toBe(h.rootProvider);
    expect(h.upload.mock.calls[1][1]).toBe("/");
  });

  // A file manager selects a set, not just one row: shift paints a range and
  // Ctrl/Cmd toggles single rows, and the toolbar acts on all of it.
  describe("multiple selection", () => {
    const threeFiles = [
      entry("/a.txt"),
      entry("/b.txt"),
      entry("/c.txt"),
    ];

    it("selects a range with shift and shows the count", async () => {
      h.listWorkspaceRoot.mockResolvedValue(threeFiles);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("a.txt");

      fireEvent.click(screen.getByText("a.txt"));
      fireEvent.click(screen.getByText("c.txt"), { shiftKey: true });

      expect(rowFor("a.txt")).toHaveClass("bg-accent/10");
      expect(rowFor("b.txt")).toHaveClass("bg-accent/10");
      expect(rowFor("c.txt")).toHaveClass("bg-accent/10");
      expect(screen.getByText("3 items selected")).toBeInTheDocument();
    });

    it("toggles one row with Ctrl and clears the set", async () => {
      h.listWorkspaceRoot.mockResolvedValue(threeFiles);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("a.txt");

      fireEvent.click(screen.getByText("a.txt"));
      fireEvent.click(screen.getByText("b.txt"), { ctrlKey: true });
      expect(screen.getByText("2 items selected")).toBeInTheDocument();

      // The same row again takes it back out of the set.
      fireEvent.click(screen.getByText("b.txt"), { ctrlKey: true });
      expect(screen.queryByText("2 items selected")).toBeNull();
      expect(rowFor("b.txt")).not.toHaveClass("bg-accent/10");

      fireEvent.click(screen.getByText("b.txt"), { ctrlKey: true });
      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
      expect(screen.queryByText("2 items selected")).toBeNull();
      expect(rowFor("a.txt")).not.toHaveClass("bg-accent/10");
    });

    it("deletes every selected row after one plural confirmation", async () => {
      h.listWorkspaceRoot.mockResolvedValue(threeFiles);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("a.txt");

      fireEvent.click(screen.getByText("a.txt"));
      fireEvent.click(screen.getByText("b.txt"), { shiftKey: true });
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      const request = h.openModal.mock.calls.at(-1);
      expect(request[0]).toBe("confirmAction");
      expect(request[1]).toEqual(
        expect.objectContaining({
          messageKey: "workspace.delete_selection_confirm",
          messageValues: { count: 2 },
          danger: true,
          showDontShowAgain: false,
        }),
      );
      expect(h.rootProvider.remove).not.toHaveBeenCalled();

      await request[1].onConfirm();
      await waitFor(() =>
        expect(h.rootProvider.remove).toHaveBeenCalledTimes(2),
      );
      expect(h.rootProvider.remove).toHaveBeenCalledWith("/a.txt", {
        recursive: false,
      });
      expect(h.rootProvider.remove).toHaveBeenCalledWith("/b.txt", {
        recursive: false,
      });
    });

    it("downloads every selected file", async () => {
      h.listWorkspaceRoot.mockResolvedValue(threeFiles);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("a.txt");

      fireEvent.click(screen.getByText("a.txt"));
      fireEvent.click(screen.getByText("b.txt"), { shiftKey: true });
      fireEvent.click(screen.getByRole("button", { name: "Download" }));

      await waitFor(() => expect(h.download).toHaveBeenCalledTimes(2));
      expect(h.download.mock.calls.map(([, file]) => file.name)).toEqual([
        "a.txt",
        "b.txt",
      ]);
    });

    // A browser download dialog cannot take a folder, so a set asks once where
    // it should go and is written there through the File System Access API.
    it("asks for a destination folder once and saves the whole set there", async () => {
      h.pickFolderSupported = true;
      const picked = { name: "Downloads" };
      h.pickDirectory.mockResolvedValue(picked);
      h.listWorkspaceRoot.mockResolvedValue(threeFiles);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("a.txt");

      fireEvent.click(screen.getByText("a.txt"));
      fireEvent.click(screen.getByText("b.txt"), { shiftKey: true });
      fireEvent.click(screen.getByRole("button", { name: "Download" }));

      await waitFor(() => expect(h.saveEntries).toHaveBeenCalledTimes(1));
      expect(h.pickDirectory).toHaveBeenCalledTimes(1);
      const [directory, items] = h.saveEntries.mock.calls[0];
      expect(directory).toBe(picked);
      expect(items.map((item) => item.entry.name)).toEqual(["a.txt", "b.txt"]);
      expect(items[0].provider).toBe(h.rootProvider);
      // The browser's own download is not started as well.
      expect(h.download).not.toHaveBeenCalled();
    });

    it("saves nothing when the destination prompt is cancelled", async () => {
      h.pickFolderSupported = true;
      h.pickDirectory.mockResolvedValue(null);
      h.listWorkspaceRoot.mockResolvedValue(threeFiles);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("a.txt");

      fireEvent.click(screen.getByText("a.txt"));
      fireEvent.click(screen.getByText("b.txt"), { shiftKey: true });
      fireEvent.click(screen.getByRole("button", { name: "Download" }));

      await waitFor(() => expect(h.pickDirectory).toHaveBeenCalledTimes(1));
      expect(h.saveEntries).not.toHaveBeenCalled();
      expect(h.download).not.toHaveBeenCalled();
    });

    it("reports a folder prompt that failed instead of downloading anyway", async () => {
      h.pickFolderSupported = true;
      h.pickDirectory.mockRejectedValue(new Error("Picker unavailable"));
      h.listWorkspaceRoot.mockResolvedValue(threeFiles);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("a.txt");

      fireEvent.click(screen.getByText("a.txt"));
      fireEvent.click(screen.getByText("b.txt"), { shiftKey: true });
      fireEvent.click(screen.getByRole("button", { name: "Download" }));

      expect(await screen.findByText("Picker unavailable")).toBeInTheDocument();
      expect(h.saveEntries).not.toHaveBeenCalled();
      expect(h.download).not.toHaveBeenCalled();
    });

    it("reports the files a folder save could not write", async () => {
      h.pickFolderSupported = true;
      h.pickDirectory.mockResolvedValue({ name: "Downloads" });
      h.saveEntries.mockResolvedValue([
        { name: "b.txt", message: "Permission denied" },
      ]);
      h.listWorkspaceRoot.mockResolvedValue(threeFiles);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("a.txt");

      fireEvent.click(screen.getByText("a.txt"));
      fireEvent.click(screen.getByText("b.txt"), { shiftKey: true });
      fireEvent.click(screen.getByRole("button", { name: "Download" }));

      expect(
        await screen.findByText("b.txt: Permission denied"),
      ).toBeInTheDocument();
    });

    it("downloads a single file without asking for a folder", async () => {
      h.pickFolderSupported = true;
      h.listWorkspaceRoot.mockResolvedValue(threeFiles);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("a.txt");

      fireEvent.click(screen.getByText("a.txt"));
      fireEvent.click(screen.getByRole("button", { name: "Download" }));

      await waitFor(() => expect(h.download).toHaveBeenCalledTimes(1));
      expect(h.pickDirectory).not.toHaveBeenCalled();
      expect(h.saveEntries).not.toHaveBeenCalled();
    });
  });

  // The page rebuild dropped this once: the tree had no drag source and no drop
  // target, so rows could only be moved by the agent. A row dropped on a folder
  // moves into it; a drop on the list below the rows is the workspace root.
  describe("drag and drop", () => {
    const dataTransferFor = () => {
      const data = new Map();
      return {
        get types() {
          return [...data.keys()];
        },
        getData: (type) => data.get(type) ?? "",
        setData: (type, value) => data.set(type, value),
        effectAllowed: "none",
        dropEffect: "none",
      };
    };

    // Query the row right before the drag and hand the same transfer to the drop:
    // the handlers keep the dragged row in state, so the payload is not read back.
    const dragRow = (label) => {
      const transfer = dataTransferFor();
      fireEvent.dragStart(rowFor(label), { dataTransfer: transfer });
      return transfer;
    };

    const connectedProvider = (overrides = {}) => ({
      sourceId: "dev-1",
      kind: "local",
      status: "connected",
      capabilities: {
        read: true,
        write: true,
        delete: true,
        mkdir: true,
        rename: true,
        move: true,
        copy: true,
      },
      connect: vi.fn(async () => {}),
      stat: vi.fn(async (path) => {
        throw new WorkspaceError("NOT_FOUND", path);
      }),
      list: vi.fn(async () => ({ entries: [] })),
      ...overrides,
    });

    it("moves a root file onto a folder of the same source", async () => {
      h.listWorkspaceRoot.mockResolvedValue([
        entry("/notes.txt"),
        entry("/Docs", "dir"),
      ]);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("notes.txt");

      const transfer = dragRow("notes.txt");
      fireEvent.dragOver(rowFor("Docs"), { dataTransfer: transfer });
      expect(rowFor("Docs").className).toContain("ring-primary");

      fireEvent.drop(rowFor("Docs"), { dataTransfer: transfer });

      await waitFor(() => expect(h.runTransfer).toHaveBeenCalledTimes(1));
      expect(h.runTransfer).toHaveBeenCalledWith({
        workspaceId: "ws-1",
        from: h.rootProvider,
        to: h.rootProvider,
        entry: expect.objectContaining({
          path: "/notes.txt",
          name: "notes.txt",
          kind: "file",
        }),
        targetDir: "/Docs",
        strategy: "move",
      });
      // A move inside one source needs no confirmation.
      expect(h.openModal).not.toHaveBeenCalled();
    });

    it("nests a folder inside the dropped-on folder", async () => {
      h.listWorkspaceRoot.mockResolvedValue([
        entry("/Docs", "dir"),
        entry("/Archive", "dir"),
      ]);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("Docs");

      fireEvent.drop(rowFor("Archive"), { dataTransfer: dragRow("Docs") });

      await waitFor(() => expect(h.runTransfer).toHaveBeenCalledTimes(1));
      expect(h.runTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          entry: expect.objectContaining({ path: "/Docs", kind: "dir" }),
          // A folder lands as target/name/**, never merged into the target itself.
          targetDir: "/Archive/Docs",
          strategy: "move",
        }),
      );
    });

    it("moves a file back to the workspace root on the list background", async () => {
      h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
        if (path === "/") return [entry("/Archive", "dir")];
        if (path === "/Archive") return [entry("/Archive/one.md")];
        return [];
      });

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      fireEvent.click(await screen.findByText("Archive"));
      await screen.findByText("one.md");

      const transfer = dragRow("one.md");
      const list = document.querySelector('[data-guide="workspace-files"]');
      fireEvent.dragOver(list, { dataTransfer: transfer });
      expect(list.className).toContain("ring-primary");
      fireEvent.drop(list, { dataTransfer: transfer });

      await waitFor(() => expect(h.runTransfer).toHaveBeenCalledTimes(1));
      expect(h.runTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          entry: expect.objectContaining({ path: "/Archive/one.md" }),
          targetDir: "/",
        }),
      );
    });

    it("moves a file back to the root through the / row", async () => {
      h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
        if (path === "/") return [entry("/Archive", "dir")];
        if (path === "/Archive") return [entry("/Archive/one.md")];
        return [];
      });

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      fireEvent.click(await screen.findByText("Archive"));
      await screen.findByText("one.md");

      const rootRow = document.querySelector(
        '[data-guide="workspace-root-row"]',
      );
      const transfer = dragRow("one.md");
      fireEvent.dragOver(rootRow, { dataTransfer: transfer });
      expect(rootRow.className).toContain("ring-primary");

      fireEvent.drop(rootRow, { dataTransfer: transfer });

      await waitFor(() => expect(h.runTransfer).toHaveBeenCalledTimes(1));
      expect(h.runTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          entry: expect.objectContaining({ path: "/Archive/one.md" }),
          targetDir: "/",
          strategy: "move",
        }),
      );
    });

    it("refuses a drop where the name already exists", async () => {
      h.listWorkspaceRoot.mockResolvedValue([
        entry("/notes.txt"),
        entry("/Docs", "dir"),
      ]);
      h.rootProvider.stat.mockResolvedValue({
        sourceId: "root",
        path: "/Docs/notes.txt",
        name: "notes.txt",
        kind: "file",
      });

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("notes.txt");

      fireEvent.drop(rowFor("Docs"), { dataTransfer: dragRow("notes.txt") });

      expect(
        await screen.findByText(/already exists at the destination/),
      ).toBeInTheDocument();
      expect(h.runTransfer).not.toHaveBeenCalled();
    });

    it("asks before moving into another source and moves on confirm", async () => {
      const provider = connectedProvider();
      h.sources = [
        { id: "dev-1", kind: "local", label: "Phone", readOnly: false },
      ];
      h.mounts = [mountRow];
      h.providers = new Map([["dev-1", provider]]);
      h.listWorkspaceRoot.mockResolvedValue([
        entry("/notes.txt"),
        entry("/Phone", "dir", { local: false, mount: mountRow }),
      ]);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("notes.txt");

      fireEvent.drop(rowFor("Phone"), { dataTransfer: dragRow("notes.txt") });

      await waitFor(() => expect(h.openModal).toHaveBeenCalledTimes(1));
      expect(h.runTransfer).not.toHaveBeenCalled();

      const [modalName, props] = h.openModal.mock.calls[0];
      expect(modalName).toBe("workspaceTransfer");
      expect(props.plan.strategy).toBe("move");
      expect(props.fromLabel).toBe("Workspace Root");
      expect(props.toLabel).toBe("Phone");

      props.onConfirm();

      await waitFor(() => expect(h.runTransfer).toHaveBeenCalledTimes(1));
      expect(h.runTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          from: h.rootProvider,
          to: provider,
          // The mount's own path, not the workspace path the row shows.
          targetDir: "/Photos",
          strategy: "move",
        }),
      );
    });

    it("refuses to move a folder into its own descendant", async () => {
      h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
        if (path === "/") return [entry("/Docs", "dir")];
        if (path === "/Docs") return [entry("/Docs/Sub", "dir")];
        return [];
      });

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      fireEvent.click(await screen.findByText("Docs"));
      await screen.findByText("Sub");

      fireEvent.drop(rowFor("Sub"), { dataTransfer: dragRow("Docs") });

      expect(
        await screen.findByText("This transfer cannot be started."),
      ).toBeInTheDocument();
      expect(h.runTransfer).not.toHaveBeenCalled();
    });

    it("moves every selected row when one of them is dragged", async () => {
      h.listWorkspaceRoot.mockResolvedValue([
        entry("/a.txt"),
        entry("/b.txt"),
        entry("/Docs", "dir"),
      ]);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("a.txt");

      fireEvent.click(screen.getByText("a.txt"));
      fireEvent.click(screen.getByText("b.txt"), { shiftKey: true });

      fireEvent.drop(rowFor("Docs"), { dataTransfer: dragRow("a.txt") });

      await waitFor(() => expect(h.runTransfer).toHaveBeenCalledTimes(2));
      expect(
        h.runTransfer.mock.calls.map(([request]) => request.entry.name),
      ).toEqual(["a.txt", "b.txt"]);
      expect(h.runTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ targetDir: "/Docs", strategy: "move" }),
      );
      // One drag, one drop: no confirmation for a move inside one source.
      expect(h.openModal).not.toHaveBeenCalled();
    });

    it("refuses to drop a dragged folder on itself", async () => {
      h.listWorkspaceRoot.mockResolvedValue([entry("/Docs", "dir")]);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("Docs");

      const transfer = dragRow("Docs");
      fireEvent.dragOver(rowFor("Docs"), { dataTransfer: transfer });
      expect(rowFor("Docs").className).not.toContain("ring-primary");

      fireEvent.drop(rowFor("Docs"), { dataTransfer: transfer });
      expect(h.runTransfer).not.toHaveBeenCalled();
    });

    it("never makes a mount row draggable", async () => {
      h.sources = [
        { id: "dev-1", kind: "local", label: "Phone", readOnly: false },
      ];
      h.mounts = [mountRow];
      h.providers = new Map([["dev-1", { status: "connected" }]]);
      h.listWorkspaceRoot.mockResolvedValue([
        entry("/Phone", "dir", { local: false, mount: mountRow }),
      ]);

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("Phone");

      expect(rowFor("Phone")).toHaveAttribute("draggable", "false");
    });

    it("does not accept a drop on the synthetic /chats folder", async () => {
      h.listWorkspaceRoot.mockImplementation(async ({ path }) => {
        if (path === "/") {
          return [entry("/notes.txt"), entry("/chats", "dir", { local: false })];
        }
        return [];
      });

      render(<WorkspaceStorageTree workspaceId="ws-1" />);
      await screen.findByText("notes.txt");

      const transfer = dragRow("notes.txt");
      fireEvent.dragOver(rowFor("chats"), { dataTransfer: transfer });
      expect(rowFor("chats").className).not.toContain("ring-primary");

      fireEvent.drop(rowFor("chats"), { dataTransfer: transfer });
      expect(h.runTransfer).not.toHaveBeenCalled();
    });
  });
});
