import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttachButton from "../AttachButton";

const dbMocks = vi.hoisted(() => ({ links: [] }));
const attachmentMocks = vi.hoisted(() => ({ addAttachments: vi.fn() }));

vi.mock("../../../db/workspaceDb", () => ({
  useChatWorkspaces: () => dbMocks.links,
}));
vi.mock("../../../hooks/useAttachments", () => ({
  useAttachments: () => ({ addAttachments: attachmentMocks.addAttachments }),
}));
vi.mock("../../Workspace/AttachFromWorkspacePanel", () => ({
  default: ({ workspaceIds }) => (
    <div data-testid="workspace-panel">{workspaceIds.join(",")}</div>
  ),
}));

const localState = {
  id: "conversation",
  messages: [{ role: "user", content: [{ type: "text", text: "" }] }],
  settings: { model: { id: "test-model" } },
};

beforeEach(() => {
  dbMocks.links = [];
  attachmentMocks.addAttachments.mockClear();
});

describe("AttachButton", () => {
  it("opens the file picker straight away when the chat has no workspace", () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    render(<AttachButton localState={localState} setLocalState={vi.fn()} />);

    fireEvent.click(document.querySelector('[data-guide="attach-file"]'));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("From workspace")).not.toBeInTheDocument();
    clickSpy.mockRestore();
  });

  it("offers both sources when the chat has a workspace", () => {
    dbMocks.links = [{ workspaceId: "workspace-1" }];
    render(<AttachButton localState={localState} setLocalState={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Attach File" }),
    );

    expect(screen.getByText("From device")).toBeInTheDocument();
    expect(screen.getByText("From workspace")).toBeInTheDocument();
  });

  it("attaches from the device and closes the menu", async () => {
    dbMocks.links = [{ workspaceId: "workspace-1" }];
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    render(<AttachButton localState={localState} setLocalState={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Attach File" }),
    );
    fireEvent.click(screen.getByText("From device"));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByText("From workspace")).not.toBeInTheDocument();
    });
    clickSpy.mockRestore();
  });

  it("opens the workspace tree and returns to the two options", async () => {
    dbMocks.links = [
      { workspaceId: "workspace-1" },
      { workspaceId: "workspace-1" },
      { workspaceId: "workspace-2" },
    ];
    render(<AttachButton localState={localState} setLocalState={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Attach File" }),
    );
    fireEvent.click(screen.getByText("From workspace"));

    expect(screen.getByTestId("workspace-panel")).toHaveTextContent(
      "workspace-1,workspace-2",
    );
    fireEvent.click(screen.getByText("Back"));

    expect(screen.getByText("From device")).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-panel")).not.toBeInTheDocument();
  });
});
