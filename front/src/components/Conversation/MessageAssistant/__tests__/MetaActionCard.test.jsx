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

const { dispatch, mockState, workspaceState, agentState } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  workspaceState: { rows: [] },
  agentState: { rows: [], pinnedCalls: [] },
  mockState: {
    user_settings: {
      memories: [],
      memory_groups: [{ id: "private", name: "Private" }],
      default_memory_group: "default",
      memory_mode: 0,
    },
    interface_settings: {},
  },
}));

vi.mock("react-redux", () => ({
  useDispatch: () => dispatch,
  useSelector: (selector) => selector(mockState),
}));

vi.mock("../../../../db/workspaceDb", () => ({
  attachWorkspaceAgent: vi.fn(async () => {}),
  attachWorkspaceChat: vi.fn(async () => {}),
  detachWorkspaceAgent: vi.fn(async () => {}),
  detachWorkspaceChat: vi.fn(async () => {}),
  getWorkspace: vi.fn(async () => null),
  hasWorkspaceAgentLink: vi.fn(async () => false),
  hasWorkspaceChatLink: vi.fn(async () => false),
  setWorkspacePinned: vi.fn(async () => {}),
  useWorkspaceList: () => workspaceState.rows,
}));

vi.mock("../../../../agents/agentStore", () => ({
  getAgents: () => agentState.rows,
  useAgents: () => agentState.rows,
  setAgentPinned: (id, pinned) => {
    agentState.rows = agentState.rows.map((agent) =>
      agent.id === id ? { ...agent, pinned } : agent,
    );
    agentState.pinnedCalls.push([id, pinned]);
  },
}));

vi.mock("../../../../db", () => ({
  assignConversationToFolder: vi.fn(async () => {}),
  ensureFolder: vi.fn(async () => "folder-1"),
  getConversationMeta: vi.fn(async () => conversation),
  getFolder: vi.fn(async () => null),
  newId: vi.fn(() => "new-mcp-id"),
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
import {
  getWorkspace,
  setWorkspacePinned,
} from "../../../../db/workspaceDb";

const localState = {
  id: "meta-chat",
  messages: [{ role: "assistant", content: [{ type: "text", text: "proposal" }] }],
  settings: {},
};

describe("MetaActionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.user_settings.memories = [];
    workspaceState.rows = [];
    agentState.rows = [];
    agentState.pinnedCalls = [];
    vi.mocked(getConversationMeta).mockResolvedValue(conversation);
    vi.mocked(getWorkspace).mockResolvedValue(null);
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
            scope: "all",
            conversationId: null,
            url: "localhost:9000",
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

  it("adds a global MCP copy even when the URL already exists", async () => {
    mockState.user_settings.mcp_servers = [
      {
        id: "crm-1",
        name: "crm-mcp",
        url: "http://localhost:9000/mcp",
      },
    ];
    render(
      <MetaActionCard
        actions={[
          {
            type: "mcp_server",
            op: "add",
            scope: "global",
            conversationId: null,
            entryId: "",
            name: "crm-mcp2",
            url: "http://localhost:9000/mcp",
          },
        ]}
        localState={localState}
        setLocalState={vi.fn()}
        message_index={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /accept changes/i }));
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            mcp_servers: [
              expect.objectContaining({ id: "crm-1", name: "crm-mcp" }),
              expect.objectContaining({ id: "new-mcp-id", name: "crm-mcp2" }),
            ],
          }),
        }),
      ),
    );
    mockState.user_settings.mcp_servers = [];
  });

  it("applies an Arcana Tools tool setting", async () => {
    vi.mocked(getConversationMeta).mockResolvedValue({
      ...conversation,
      settings: { tools: { arcana_tools: false } },
    });
    render(
      <MetaActionCard
        actions={[
          {
            type: "conversation_setting",
            scope: "conversation",
            conversationId: "chat-1",
            key: "arcana_tools",
            value: true,
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
        settings: { tools: { arcana_tools: true } },
      }),
    );
  });

  it("applies and reverts a chat's list of Arcana collections", async () => {
    vi.mocked(getConversationMeta).mockResolvedValue({
      ...conversation,
      settings: { arcana_shares: [] },
    });
    render(
      <MetaActionCard
        actions={[
          {
            type: "conversation_setting",
            scope: "conversation",
            conversationId: "chat-1",
            key: "arcana_shares",
            value: [
              {
                collection: "alice/papers",
                description: " Peer-reviewed papers ",
              },
              { collection: "bob/notes" },
            ],
          },
        ]}
        localState={localState}
        setLocalState={vi.fn()}
        message_index={0}
      />,
    );

    // The proposal names the collections it would bind.
    expect(screen.getByText(/alice\/papers, bob\/notes/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /accept changes/i }));
    await waitFor(() =>
      expect(updateConversationMeta).toHaveBeenCalledWith("chat-1", {
        settings: {
          arcana_shares: [
            {
              collection: "alice/papers",
              owner: "alice",
              name: "papers",
              description: "Peer-reviewed papers",
            },
            { collection: "bob/notes", owner: "bob", name: "notes" },
          ],
        },
      }),
    );

    // The applied settings are what the chat now holds; the revert only runs
    // when they still match, exactly like a real conversation row.
    const appliedSettings = vi.mocked(updateConversationMeta).mock.calls[0][1]
      .settings;
    vi.mocked(getConversationMeta).mockResolvedValue({
      ...conversation,
      settings: appliedSettings,
    });
    fireEvent.click(await screen.findByRole("button", { name: /revert changes/i }));
    await waitFor(() =>
      expect(updateConversationMeta).toHaveBeenLastCalledWith("chat-1", {
        settings: { arcana_shares: [] },
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

  it("adds a proposed memory to the named group", async () => {
    render(
      <MetaActionCard
        actions={[
          { type: "add_memory", text: "Private detail", group: "Private" },
        ]}
        localState={localState}
        setLocalState={vi.fn()}
        message_index={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /accept changes/i }));
    await waitFor(() => {
      const memoryUpdate = dispatch.mock.calls
        .map(([action]) => action)
        .find((action) => Array.isArray(action?.payload?.memories));
      expect(memoryUpdate?.payload.memories).toEqual([
        expect.objectContaining({
          text: "Private detail",
          groupId: "private",
        }),
      ]);
    });
  });

  it("applies and reverts a workspace pin", async () => {
    const workspace = { id: "ws-1", name: "Research", pinned: false };
    workspaceState.rows = [workspace];
    vi.mocked(getWorkspace).mockResolvedValue(workspace);

    render(
      <MetaActionCard
        actions={[
          { type: "pin_workspace", workspaceId: "ws-1", pinned: true },
        ]}
        localState={localState}
        setLocalState={vi.fn()}
        message_index={0}
      />,
    );

    expect(screen.getByText(/Pin workspace “Research”/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /accept changes/i }));
    await waitFor(() =>
      expect(setWorkspacePinned).toHaveBeenCalledWith("ws-1", true),
    );

    vi.mocked(getWorkspace).mockResolvedValue({ ...workspace, pinned: true });
    fireEvent.click(
      await screen.findByRole("button", { name: /revert changes/i }),
    );
    await waitFor(() =>
      expect(setWorkspacePinned).toHaveBeenCalledWith("ws-1", false),
    );
  });

  it("applies and reverts an agent pin", async () => {
    agentState.rows = [{ id: "agent-1", name: "Research agent" }];

    render(
      <MetaActionCard
        actions={[{ type: "pin_agent", agentId: "agent-1", pinned: true }]}
        localState={localState}
        setLocalState={vi.fn()}
        message_index={0}
      />,
    );

    expect(screen.getByText(/Pin agent “Research agent”/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /accept changes/i }));
    await waitFor(() =>
      expect(agentState.pinnedCalls).toEqual([["agent-1", true]]),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /revert changes/i }),
    );
    await waitFor(() =>
      expect(agentState.rows[0].pinned).toBe(false),
    );
  });

  it("adds a proposed memory to the chat's effective group by default", async () => {
    render(
      <MetaActionCard
        actions={[{ type: "add_memory", text: "Private detail" }]}
        localState={{
          ...localState,
          settings: { memory_group_override: "private" },
        }}
        setLocalState={vi.fn()}
        message_index={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /accept changes/i }));
    await waitFor(() => {
      const memoryUpdate = dispatch.mock.calls
        .map(([action]) => action)
        .find((action) => Array.isArray(action?.payload?.memories));
      expect(memoryUpdate?.payload.memories).toEqual([
        expect.objectContaining({
          text: "Private detail",
          groupId: "private",
        }),
      ]);
    });
  });
  it("shows the full prompt text for an agent prompt action", () => {
    const longText = "x".repeat(1500);
    const { container } = render(
      <MetaActionCard
        actions={[
          {
            type: "agent_action",
            op: "prompt",
            agentId: "agent-1",
            text: longText,
          },
        ]}
        localState={localState}
        setLocalState={vi.fn()}
        message_index={0}
      />,
    );

    expect(container.querySelector("pre")?.textContent).toBe(longText);
  });

  it("includes the prompt character count in the agent prompt summary", () => {
    render(
      <MetaActionCard
        actions={[
          {
            type: "agent_action",
            op: "prompt",
            agentId: "agent-1",
            text: "x".repeat(1500),
          },
        ]}
        localState={localState}
        setLocalState={vi.fn()}
        message_index={0}
      />,
    );

    expect(
      screen.getByText(/Send 1500 characters to agent agent-1/),
    ).toBeInTheDocument();
  });

  it("renders no prompt text block for an agent interrupt action", () => {
    const { container } = render(
      <MetaActionCard
        actions={[
          { type: "agent_action", op: "interrupt", agentId: "agent-1" },
        ]}
        localState={localState}
        setLocalState={vi.fn()}
        message_index={0}
      />,
    );

    expect(screen.getByText(/Interrupt agent agent-1/)).toBeInTheDocument();
    expect(screen.queryByText("Prompt text")).not.toBeInTheDocument();
    expect(container.querySelector("pre")).toBeNull();
  });
});
