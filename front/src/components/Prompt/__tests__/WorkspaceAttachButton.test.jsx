import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceAttachButton from "../WorkspaceAttachButton";

const openModal = vi.fn();
const navigate = vi.fn();
const dbMocks = vi.hoisted(() => ({
  links: [],
  workspaces: [
    { id: "w1", name: "Research" },
    { id: "w2", name: "Teaching" },
  ],
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
});

describe("WorkspaceAttachButton", () => {
  it("opens the chat files from the workspace menu when no workspace is attached", async () => {
    renderButton();
    openMenu();

    fireEvent.click(await screen.findByText("Manage data"));

    expect(navigate).not.toHaveBeenCalled();
    expect(openModal).toHaveBeenCalledWith("manageData", { localState });
  });

  it("opens the attached workspace directly instead of repeating it in Manage data", async () => {
    dbMocks.links = [{ workspaceId: "w1" }];
    renderButton();
    openMenu();

    expect(
      screen.getByText(/This chat is attached to Research/),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByText("Manage data in Research"));

    expect(navigate).toHaveBeenCalledWith("/workspace/w1");
    expect(openModal).not.toHaveBeenCalled();
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

  it("offers the write switch only for a chat with an attached workspace", () => {
    renderButton();
    openMenu();

    expect(
      screen.queryByRole("checkbox", { name: "Allow write" }),
    ).not.toBeInTheDocument();
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
