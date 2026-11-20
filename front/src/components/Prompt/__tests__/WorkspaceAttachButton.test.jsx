import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceAttachButton from "../WorkspaceAttachButton";

const openModal = vi.fn();
const navigate = vi.fn();
const WORKSPACES = [
  { id: "w1", name: "Research" },
  { id: "w2", name: "Teaching" },
];
const dbMocks = vi.hoisted(() => ({
  links: [],
  workspaces: [],
}));

vi.mock("../../../db/workspaceDb", () => ({
  attachWorkspaceChat: vi.fn(),
  detachWorkspaceChat: vi.fn(),
  useChatWorkspaces: () => dbMocks.links,
  useWorkspaceList: () => dbMocks.workspaces,
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal }),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));
vi.mock("../../Workspace/WorkspaceSettings", () => ({
  default: () => null,
}));

const localState = { id: "conversation", settings: { tools: {} } };

const renderButton = (setLocalState = vi.fn()) =>
  render(
    <WorkspaceAttachButton
      localState={localState}
      setLocalState={setLocalState}
    />,
  );

const openMenu = () =>
  fireEvent.click(screen.getByRole("button", { name: "Workspace" }));

beforeEach(() => {
  openModal.mockClear();
  navigate.mockClear();
  dbMocks.links = [];
  dbMocks.workspaces = WORKSPACES;
});

describe("WorkspaceAttachButton", () => {
  it("renders nothing for a chat that has no workspace", () => {
    renderButton();

    // A workspace button with no workspace behind it has nothing to show: the storage switch,
    // the editor and the attachment list all belong to a workspace this chat does not have.
    expect(
      screen.queryByRole("button", { name: "Workspace" }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when there is no workspace to attach at all", () => {
    dbMocks.workspaces = [];
    renderButton();

    expect(
      screen.queryByRole("button", { name: "Workspace" }),
    ).not.toBeInTheDocument();
  });

  it("opens the workspace editor when exactly one workspace is attached", async () => {
    dbMocks.links = [{ workspaceId: "w1" }];
    renderButton();
    openMenu();

    expect(
      screen.getByText(/This chat is attached to Research/),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByText("Manage data in Research"));

    // The editor is Create workspace in edit mode: name, icon, colour and the storage rail.
    expect(openModal).toHaveBeenCalledWith("workspaceEdit", {
      workspaceId: "w1",
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("asks which workspace to open when several are attached", async () => {
    dbMocks.links = [{ workspaceId: "w1" }, { workspaceId: "w2" }];
    renderButton();
    openMenu();

    fireEvent.click(await screen.findByText("Manage data"));

    expect(navigate).not.toHaveBeenCalled();
    expect(openModal).toHaveBeenCalledWith("manageData", { localState });
  });

  it("puts access storage first and writes it to the conversation", () => {
    dbMocks.links = [{ workspaceId: "w1" }];
    const setLocalState = vi.fn((updater) => updater(localState));
    renderButton(setLocalState);
    openMenu();

    const toggle = screen.getByRole("checkbox", { name: "Access storage" });
    expect(toggle.checked).toBe(true);

    fireEvent.click(toggle);

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.browser_storage).toBe(false);
    expect(next.flush).toBe(true);
  });

  it("toggles writing for the attached workspace right under access storage", () => {
    dbMocks.links = [{ workspaceId: "w1" }];
    const state = { id: "conversation", settings: { tools: {} } };
    const setLocalState = vi.fn((updater) => updater(state));
    render(
      <WorkspaceAttachButton
        localState={state}
        setLocalState={setLocalState}
      />,
    );
    openMenu();

    const write = screen.getByRole("checkbox", { name: "Allow write" });
    expect(write.checked).toBe(true);

    fireEvent.click(write);

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.workspace_write_access).toBe(false);
    expect(next.flush).toBe(true);
  });

  it("disables the workspace write switch while access storage is off", () => {
    dbMocks.links = [{ workspaceId: "w1" }];
    const state = {
      id: "conversation",
      settings: { tools: { browser_storage: false } },
    };
    render(
      <WorkspaceAttachButton localState={state} setLocalState={vi.fn()} />,
    );
    openMenu();

    expect(
      screen.getByRole("checkbox", { name: "Allow write" }),
    ).toBeDisabled();
  });
});
