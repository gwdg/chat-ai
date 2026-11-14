import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttachFromWorkspaceButton from "../AttachFromWorkspaceButton";

const workspaceMocks = vi.hoisted(() => ({ links: [] }));

vi.mock("../../../db/workspaceDb", () => ({
  useChatWorkspaces: () => workspaceMocks.links,
}));
vi.mock("../../Workspace/AttachFromWorkspacePanel", () => ({
  default: ({ workspaceIds }) => (
    <div>{`panel:${workspaceIds.join(",")}`}</div>
  ),
}));

const localState = {
  id: "conversation",
  messages: [{ role: "user", content: [{ type: "text", text: "" }] }],
  settings: { model: { id: "test-model" } },
};

beforeEach(() => {
  workspaceMocks.links = [];
});

describe("AttachFromWorkspaceButton", () => {
  it("is hidden when the chat has no workspace", () => {
    render(
      <AttachFromWorkspaceButton
        localState={localState}
        setLocalState={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Attach from workspace" }),
    ).not.toBeInTheDocument();
  });

  it("opens a picker listing every attached workspace", () => {
    workspaceMocks.links = [
      { workspaceId: "workspace-1" },
      { workspaceId: "workspace-1" },
      { workspaceId: "workspace-2" },
    ];
    render(
      <AttachFromWorkspaceButton
        localState={localState}
        setLocalState={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Attach from workspace" }),
    );

    expect(screen.getByText("panel:workspace-1,workspace-2")).toBeInTheDocument();
  });
});
