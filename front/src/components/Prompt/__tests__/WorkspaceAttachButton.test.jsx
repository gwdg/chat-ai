import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceAttachButton from "../WorkspaceAttachButton";

const openModal = vi.fn();

vi.mock("../../../db/workspaceDb", () => ({
  attachWorkspaceChat: vi.fn(),
  detachWorkspaceChat: vi.fn(),
  useChatWorkspaces: () => [],
  useWorkspaceList: () => [],
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal }),
}));
vi.mock("../../Workspace/WorkspaceSettings", () => ({
  default: () => null,
}));

const localState = { id: "conversation", settings: { tools: {} } };

beforeEach(() => {
  openModal.mockClear();
});

describe("WorkspaceAttachButton", () => {
  it("opens Manage data from inside the workspace menu", async () => {
    render(
      <WorkspaceAttachButton
        localState={localState}
        setLocalState={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    fireEvent.click(await screen.findByText("Manage data"));

    expect(openModal).toHaveBeenCalledWith("manageData", { localState });
  });

  it("puts access storage first and writes it to the conversation", () => {
    const setLocalState = vi.fn((updater) => updater(localState));
    render(
      <WorkspaceAttachButton
        localState={localState}
        setLocalState={setLocalState}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    const toggle = screen.getByRole("checkbox", { name: "Access storage" });
    expect(toggle.checked).toBe(true);

    fireEvent.click(toggle);

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.browser_storage).toBe(false);
    expect(next.flush).toBe(true);
  });
});
