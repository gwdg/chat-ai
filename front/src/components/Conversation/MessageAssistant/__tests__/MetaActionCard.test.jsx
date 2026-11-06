import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MetaActionCard from "../MetaActionCard";

const conversation = {
  id: "chat-1",
  title: "Old title",
  settings: {},
  folderId: null,
  pinned: false,
};

vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: (selector) =>
    selector({
      user_settings: {
        memories: [],
        memory_mode: 0,
      },
      interface_settings: {},
    }),
}));

vi.mock("../../../../db", () => ({
  assignConversationToFolder: vi.fn(async () => {}),
  ensureFolder: vi.fn(async () => "folder-1"),
  getConversationMeta: vi.fn(async () => conversation),
  getFolder: vi.fn(async () => null),
  setConversationPinned: vi.fn(async () => {}),
  setFolderPinned: vi.fn(async () => {}),
  updateConversationMeta: vi.fn(async () => {}),
  useConversationList: () => [conversation],
  useFolderList: () => [],
}));

import {
  assignConversationToFolder,
  getConversationMeta,
  updateConversationMeta,
} from "../../../../db";

const localState = {
  id: "meta-chat",
  messages: [{ role: "assistant", content: [{ type: "text", text: "proposal" }] }],
  settings: {},
};

describe("MetaActionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConversationMeta).mockResolvedValue(conversation);
  });

  it("applies and reverts a chat rename", async () => {
    const setLocalState = vi.fn();
    render(
      <MetaActionCard
        actions={[{ type: "rename", conversationId: "chat-1", title: "New title" }]}
        localState={localState}
        setLocalState={setLocalState}
        message_index={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /accept changes/i }));
    await waitFor(() =>
      expect(updateConversationMeta).toHaveBeenCalledWith("chat-1", {
        title: "New title",
      }),
    );

    vi.mocked(getConversationMeta).mockResolvedValue({
      ...conversation,
      title: "New title",
    });
    fireEvent.click(await screen.findByRole("button", { name: /revert changes/i }));
    await waitFor(() =>
      expect(updateConversationMeta).toHaveBeenCalledWith("chat-1", {
        title: "Old title",
      }),
    );
  });

  it("adds an MCP server through the confirmed MCP action", async () => {
    render(
      <MetaActionCard
        actions={[
          {
            type: "mcp_server",
            op: "add",
            serverScope: "local",
            scope: "all",
            conversationId: null,
            url: "localhost:9000",
            serverId: "",
            enabled: true,
          },
        ]}
        localState={localState}
        setLocalState={vi.fn()}
        message_index={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /accept changes/i }));
    await waitFor(() =>
      expect(updateConversationMeta).toHaveBeenCalledWith("chat-1", {
        settings: {
          mcp_servers: [{ url: "localhost:9000", enabled: true }],
        },
      }),
    );
  });

  it("assigns a chat to a topic", async () => {
    render(
      <MetaActionCard
        actions={[
          {
            type: "move",
            conversationId: "chat-1",
            folderId: "folder-1",
            folderName: "Work",
          },
        ]}
        localState={localState}
        setLocalState={vi.fn()}
        message_index={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /accept changes/i }));
    await waitFor(() =>
      expect(assignConversationToFolder).toHaveBeenCalledWith("chat-1", "folder-1"),
    );
  });
});
