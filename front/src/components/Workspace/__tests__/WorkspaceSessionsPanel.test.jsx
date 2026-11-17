import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

const mocks = vi.hoisted(() => ({
  chatLinksByWorkspace: {},
  conversations: [],
  workspaces: [],
  navigate: vi.fn(),
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mocks.navigate };
});
vi.mock("../../../db", () => ({
  useConversationList: () => mocks.conversations,
}));
vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceChats: (workspaceId) =>
    mocks.chatLinksByWorkspace[workspaceId] ?? [],
  useWorkspaceList: () => mocks.workspaces,
}));

import WorkspaceSessionsPanel from "../WorkspaceSessionsPanel";

const renderPanel = (props) =>
  render(
    <MemoryRouter>
      <WorkspaceSessionsPanel {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.chatLinksByWorkspace = {};
  mocks.conversations = [];
  mocks.workspaces = [];
  mocks.navigate.mockReset();
});

describe("WorkspaceSessionsPanel", () => {
  it("lists the workspace's chats by title and skips missing conversations", () => {
    mocks.workspaces = [{ id: "ws-1", name: "Research" }];
    mocks.chatLinksByWorkspace["ws-1"] = [
      { id: "link-1", workspaceId: "ws-1", conversationId: "chat-1", createdAt: 1 },
      { id: "link-2", workspaceId: "ws-1", conversationId: "chat-gone", createdAt: 2 },
      { id: "link-3", workspaceId: "ws-1", conversationId: "chat-2", createdAt: 3 },
    ];
    mocks.conversations = [
      { id: "chat-1", title: "Trip planning" },
      { id: "chat-2", title: "Budget notes" },
    ];

    renderPanel({ workspaceIds: ["ws-1"] });

    expect(screen.getByText("Trip planning")).toBeInTheDocument();
    expect(screen.getByText("Budget notes")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByText("chat-gone")).toBeNull();
    expect(
      document.querySelector('[data-guide="workspace-sessions-list"]'),
    ).toBeInTheDocument();
  });

  it("falls back to Untitled Chat for an empty title", () => {
    mocks.workspaces = [{ id: "ws-1", name: "Research" }];
    mocks.chatLinksByWorkspace["ws-1"] = [
      { id: "link-1", workspaceId: "ws-1", conversationId: "chat-1", createdAt: 1 },
    ];
    mocks.conversations = [{ id: "chat-1", title: "" }];

    renderPanel({ workspaceIds: ["ws-1"] });

    const row = screen.getByRole("button", { name: "Untitled Chat" });
    expect(row).toBeInTheDocument();
    expect(row).toHaveAttribute("title", "Untitled Chat");
  });

  it("navigates to the chat when a row is clicked", () => {
    mocks.workspaces = [{ id: "ws-1", name: "Research" }];
    mocks.chatLinksByWorkspace["ws-1"] = [
      { id: "link-1", workspaceId: "ws-1", conversationId: "chat-1", createdAt: 1 },
    ];
    mocks.conversations = [{ id: "chat-1", title: "Trip planning" }];

    renderPanel({ workspaceIds: ["ws-1"] });

    fireEvent.click(screen.getByRole("button", { name: "Trip planning" }));

    expect(mocks.navigate).toHaveBeenCalledWith("/chat/chat-1");
  });

  it("marks the active conversation's row as selected", () => {
    mocks.workspaces = [{ id: "ws-1", name: "Research" }];
    mocks.chatLinksByWorkspace["ws-1"] = [
      { id: "link-1", workspaceId: "ws-1", conversationId: "chat-1", createdAt: 1 },
      { id: "link-2", workspaceId: "ws-1", conversationId: "chat-2", createdAt: 2 },
    ];
    mocks.conversations = [
      { id: "chat-1", title: "Trip planning" },
      { id: "chat-2", title: "Budget notes" },
    ];

    renderPanel({ workspaceIds: ["ws-1"], activeConversationId: "chat-1" });

    const activeRow = screen.getByRole("button", { name: "Trip planning" });
    expect(activeRow).toHaveClass("bg-base-200", "text-base-content", "shadow-sm");
    expect(activeRow).toHaveClass(
      "relative",
      "flex",
      "items-center",
      "gap-1",
      "rounded-xl",
      "border",
      "border-transparent",
      "px-2",
      "py-1",
      "min-w-0",
      "w-full",
      "truncate",
      "text-left",
      "text-xs",
      "leading-relaxed",
    );

    const inactiveRow = screen.getByRole("button", { name: "Budget notes" });
    expect(inactiveRow).toHaveClass(
      "text-base-content",
      "hover:bg-base-200",
      "transition-all",
      "duration-100",
    );
    expect(inactiveRow).not.toHaveClass("shadow-sm");
  });

  it("renders the empty state when the workspace has no chats", () => {
    mocks.workspaces = [{ id: "ws-1", name: "Research" }];

    renderPanel({ workspaceIds: ["ws-1"] });

    expect(
      screen.getByText("No chats in this workspace yet."),
    ).toBeInTheDocument();
  });
});
