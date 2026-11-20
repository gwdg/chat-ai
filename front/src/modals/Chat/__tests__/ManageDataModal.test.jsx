import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ManageDataModal from "../ManageDataModal";

const dbMocks = vi.hoisted(() => ({ links: [], workspaces: [] }));
const toastMocks = vi.hoisted(() => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({ navigate: vi.fn() }));
const modalMocks = vi.hoisted(() => ({ openModal: vi.fn() }));

vi.mock("../../../db/workspaceDb", () => ({
  useChatWorkspaces: () => dbMocks.links,
  useWorkspaceList: () => dbMocks.workspaces,
}));
vi.mock("react-redux", () => ({
  useSelector: (selector) => selector({ interface_settings: {} }),
  useDispatch: () => vi.fn(),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => toastMocks,
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => routerMocks.navigate,
}));
vi.mock("../../ModalContext", () => ({
  useModal: () => modalMocks,
}));

const file = (name, path, kind = "file") => ({
  sourceId: "conversation:c1",
  path,
  name,
  kind,
  size: kind === "file" ? 12 : undefined,
  mtime: kind === "file" ? "2026-01-02T03:04:05.000Z" : undefined,
});

const makeProvider = (byPath) => ({
  sourceId: "conversation:c1",
  kind: "browser",
  status: "connected",
  capabilities: {},
  connect: vi.fn(),
  list: vi.fn(async (path) => ({ entries: byPath[path] ?? [] })),
  stat: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  mkdir: vi.fn(async (target) => {
    const parent = target.slice(0, target.lastIndexOf("/")) || "/";
    byPath[parent] = [
      ...(byPath[parent] ?? []),
      file(target.split("/").pop(), target, "dir"),
    ];
  }),
  remove: vi.fn(),
  move: vi.fn(async () => {}),
});

const localState = {
  id: "c1",
  settings: { tools: { browser_storage: true } },
};

beforeEach(() => {
  dbMocks.links = [];
  dbMocks.workspaces = [];
  routerMocks.navigate.mockClear();
});

describe("ManageDataModal", () => {
  it("browses the chat's own files when no workspace is attached", async () => {
    const provider = makeProvider({ "/": [file("notes.md", "/notes.md")] });
    render(
      <ManageDataModal
        isOpen
        onClose={vi.fn()}
        localState={localState}
        setLocalState={vi.fn()}
        provider={provider}
      />,
    );

    expect(await screen.findByText("notes.md")).toBeInTheDocument();
    expect(provider.list).toHaveBeenCalledWith("/");
    expect(screen.getByText("Files in this chat")).toBeInTheDocument();
  });

  it("opens a folder and lists its files", async () => {
    const provider = makeProvider({
      "/": [file("docs", "/docs", "dir")],
      "/docs": [file("plan.md", "/docs/plan.md")],
    });
    render(
      <ManageDataModal
        isOpen
        onClose={vi.fn()}
        localState={localState}
        setLocalState={vi.fn()}
        provider={provider}
      />,
    );

    fireEvent.click(await screen.findByText("docs"));

    expect(await screen.findByText("plan.md")).toBeInTheDocument();
    await waitFor(() => expect(provider.list).toHaveBeenCalledWith("/docs"));
  });

  it("keeps the file browser open while a folder is created", async () => {
    const provider = makeProvider({ "/": [] });
    render(
      <ManageDataModal
        isOpen
        onClose={vi.fn()}
        localState={localState}
        setLocalState={vi.fn()}
        provider={provider}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "New folder" }));
    const dialogs = await screen.findAllByRole("dialog");
    const dialog = dialogs[dialogs.length - 1];
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "notes" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "New folder" }));

    expect(await screen.findByText("notes")).toBeInTheDocument();
    expect(provider.mkdir).toHaveBeenCalledWith("/notes");
    // The file browser stays mounted while the nested create dialog is used.
    expect(screen.getByText("Files in this chat")).toBeInTheDocument();
  });

  it("explains the result when access storage is off", () => {
    const provider = makeProvider({ "/": [] });
    render(
      <ManageDataModal
        isOpen
        onClose={vi.fn()}
        localState={{
          ...localState,
          settings: { tools: { browser_storage: false } },
        }}
        provider={provider}
      />,
    );

    expect(
      screen.getByText(/The model gets no file tools/),
    ).toBeInTheDocument();
    // The switch is managed in the parent workspace menu, not here.
    expect(
      screen.queryByRole("checkbox", { name: "Access storage" }),
    ).not.toBeInTheDocument();
  });

  it("lets a chat attached to several workspaces pick one", () => {
    dbMocks.links = [{ workspaceId: "w1" }, { workspaceId: "w2" }];
    dbMocks.workspaces = [
      { id: "w1", name: "Research" },
      { id: "w2", name: "Teaching" },
    ];
    const onClose = vi.fn();
    const provider = makeProvider({ "/": [] });
    render(
      <ManageDataModal
        isOpen
        onClose={onClose}
        localState={localState}
        setLocalState={vi.fn()}
        provider={provider}
      />,
    );

    expect(screen.queryByText("Files in this chat")).not.toBeInTheDocument();
    expect(screen.getByText("Research")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Teaching"));

    expect(onClose).toHaveBeenCalled();
    expect(routerMocks.navigate).toHaveBeenCalledWith("/workspace/w2");
  });

  it("opens the workspace editor from an attached workspace row", () => {
    dbMocks.links = [{ workspaceId: "w1" }, { workspaceId: "w2" }];
    dbMocks.workspaces = [
      { id: "w1", name: "Research" },
      { id: "w2", name: "Teaching" },
    ];
    const onClose = vi.fn();
    render(
      <ManageDataModal
        isOpen
        onClose={onClose}
        localState={localState}
        setLocalState={vi.fn()}
        provider={makeProvider({ "/": [] })}
      />,
    );

    fireEvent.click(screen.getByTestId("manage-data-edit-w1"));

    expect(onClose).toHaveBeenCalled();
    expect(modalMocks.openModal).toHaveBeenCalledWith("workspaceEdit", {
      workspaceId: "w1",
    });
    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it("ignores workspace links whose workspace is gone", () => {
    dbMocks.links = [{ workspaceId: "missing" }];
    dbMocks.workspaces = [];
    const provider = makeProvider({ "/": [] });
    render(
      <ManageDataModal
        isOpen
        onClose={vi.fn()}
        localState={localState}
        setLocalState={vi.fn()}
        provider={provider}
      />,
    );

    expect(screen.getByText("Files in this chat")).toBeInTheDocument();
  });
});
