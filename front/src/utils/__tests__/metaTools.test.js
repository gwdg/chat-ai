import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createMetaToolRunner,
  getMetaToolDefinitions,
  META_TOOL_DEFINITIONS,
} from "../metaTools";
import {
  getRecentMessageExcerpts,
  listConversationMetas,
  listFolders,
  searchMessages,
} from "../../db";
import { listWorkspaceSummaries } from "../../db/workspaceDb";
import { featureGuides } from "../../config/featureGuides";
import { useCases } from "../../config/useCases";

vi.mock("../../db", () => ({
  listConversationMetas: vi.fn(),
  listFolders: vi.fn(),
  searchMessages: vi.fn(),
  getRecentMessageExcerpts: vi.fn(),
  getConversationMeta: vi.fn(),
}));

const agentMocks = vi.hoisted(() => ({
  agents: [],
  info: vi.fn(async () => ({})),
  status: vi.fn(async () => ({})),
  messages: vi.fn(async () => []),
  files: vi.fn(async () => []),
  read: vi.fn(async () => ({
    blob: new Blob(["hello"]),
    type: "text/plain",
  })),
}));

vi.mock("../../db/workspaceDb", () => ({
  listWorkspaceSummaries: vi.fn(async () => []),
}));
vi.mock("../../agents/agentStore", () => ({
  getAgents: () => agentMocks.agents,
}));
vi.mock("../../apis/opencodeAgents", () => ({
  getOpencodeInfo: (...args) => agentMocks.info(...args),
  getOpencodeSessionStatus: (...args) => agentMocks.status(...args),
  listOpencodeMessages: (...args) => agentMocks.messages(...args),
  listOpencodeFiles: (...args) => agentMocks.files(...args),
  readOpencodeFile: (...args) => agentMocks.read(...args),
}));

vi.mock("../personaCatalog", () => ({
  loadPersonaCatalog: vi.fn(async () => [
    {
      id: "writing/editor.json",
      title: "Editor",
      category: "writing",
      description: "Improves text",
    },
  ]),
}));

const context = {
  userSettings: {
    model: { id: "test-model", name: "Test Model" },
    memories: [
      { text: "Remember the milk", groupId: "work" },
      { text: "Call Alice" },
    ],
    memory_groups: [{ id: "work", name: "Work" }],
    default_memory_group: "work",
    memory_mode: 1,
    timeout: 300000,
  },
  interfaceSettings: {
    dark_mode: false,
    conversation_sort: "created_desc",
    conversation_grouping: "topic",
    completed_tutorials: [],
    completed_use_cases: [],
    suppressed_tutorials: [],
  },
  metaSettings: { model: { id: "test-model", name: "Test Model" } },
  modelsData: [
    { id: "test-model", name: "Test Model" },
    { id: "other-model", name: "Other Model" },
  ],
  memories: [
    { text: "Remember the milk", groupId: "work" },
    { text: "Call Alice" },
  ],
};

describe("Meta chat local tools", () => {
  beforeEach(() => {
    agentMocks.agents = [];
    agentMocks.info.mockReset();
    agentMocks.status.mockReset();
    agentMocks.messages.mockReset();
    agentMocks.files.mockReset();
    agentMocks.read.mockReset();
    agentMocks.info.mockResolvedValue({});
    agentMocks.status.mockResolvedValue({});
    agentMocks.messages.mockResolvedValue([]);
    agentMocks.files.mockResolvedValue([]);
    agentMocks.read.mockResolvedValue({
      blob: new Blob(["hello"]),
      type: "text/plain",
    });
    vi.mocked(listWorkspaceSummaries).mockResolvedValue([]);
    vi.mocked(listConversationMetas).mockResolvedValue([
      {
        id: "chat-1",
        title: "Random PNG",
        summary: "A generated image",
        folderId: null,
        pinned: true,
        lastModified: 1,
        settings: { model: { id: "test-model", name: "Test Model" } },
      },
    ]);
    vi.mocked(listFolders).mockResolvedValue([
      { id: "topic-1", name: "Work", pinned: false },
    ]);
    vi.mocked(searchMessages).mockResolvedValue([
      {
        messageId: "message-1",
        conversationId: "chat-1",
        conversationTitle: "Random PNG",
        folderId: null,
        role: "user",
        createdAt: 1,
        snippet: "create a random png",
      },
    ]);
    vi.mocked(getRecentMessageExcerpts).mockResolvedValue([]);
  });

  it("exposes the expected tool set", () => {
    expect(META_TOOL_DEFINITIONS.map((tool) => tool.function.name)).toEqual([
      "list_chats",
      "list_topics",
      "get_chat",
      "search_messages",
      "list_memories",
      "get_user_settings",
      "list_e2ee_keys",
      "test_mcp_server",
      "agent_health",
      "list_mcp_tools",
      "list_workspaces",
      "list_agents",
      "check_agents",
      "list_agent_sessions",
      "get_agent_history",
      "list_agent_files",
      "list_recent_agent_files",
      "search_all",
      "get_whats_new",
      "read_agent_file",
      "fetch_agent_file",
      "list_models",
      "list_personas",
      "list_tutorials",
      "start_tutorial",
      "start_use_case",
    ]);
  });

  it("reports pinned state and timestamps for workspaces and agents", async () => {
    vi.mocked(listWorkspaceSummaries).mockResolvedValue([
      {
        id: "ws-1",
        name: "Research",
        pinned: true,
        createdAt: Date.UTC(2025, 0, 2),
        lastModified: Date.UTC(2025, 0, 3),
        agentIds: [],
        conversationIds: [],
        sourceCount: 2,
      },
    ]);
    agentMocks.agents = [
      {
        id: "agent-1",
        name: "Research agent",
        serverUrl: "http://127.0.0.1:9000",
        local: true,
        pinned: false,
        createdAt: Date.UTC(2025, 1, 1),
        updatedAt: Date.UTC(2025, 1, 2),
      },
    ];
    const run = createMetaToolRunner(context);

    const workspaces = await run("list_workspaces");
    expect(workspaces).toContain("pinned: yes");
    expect(workspaces).toContain("created: 2025-01-02T00:00:00.000Z");
    expect(workspaces).toContain("modified: 2025-01-03T00:00:00.000Z");

    const agents = await run("list_agents");
    expect(agents).toContain("pinned: no");
    expect(agents).toContain("created: 2025-02-01T00:00:00.000Z");
    expect(agents).toContain("modified: 2025-02-02T00:00:00.000Z");
  });

  it("reports each encryption key's last sealed test", async () => {
    const run = createMetaToolRunner({
      ...context,
      userSettings: {
        ...context.userSettings,
        e2ee_keys: [
          {
            id: "node-a",
            name: "Node A",
            publicKey: "abc",
            testedAt: "2026-01-01T00:00:00.000Z",
            testedModels: ["test-model"],
          },
          { id: "node-b", name: "Node B", publicKey: "def" },
        ],
        e2ee_models: { "test-model": "node-a" },
      },
    });

    const result = await run("list_e2ee_keys");

    expect(result).toContain("test: tested passing for test-model");
    expect(result).toContain("test: not tested");
  });

  it("lists configured agents with link ids", async () => {
    agentMocks.agents = [
      {
        id: "agent-1",
        name: "Research agent",
        serverUrl: "http://127.0.0.1:9000",
        sessionId: "session-1",
        local: true,
      },
    ];
    const run = createMetaToolRunner(context);
    const result = await run("list_agents");
    expect(result).toContain("id: agent-1");
    expect(result).toContain("name: Research agent");
    expect(result).toContain("mode: local");
  });

  it("reads an agent history and files through its OpenCode connection", async () => {
    agentMocks.agents = [
      {
        id: "agent-1",
        name: "Research agent",
        serverUrl: "http://127.0.0.1:9000",
        sessionId: "session-1",
      },
    ];
    agentMocks.messages.mockResolvedValue([
      { id: "m1", type: "user", text: "Find the report" },
      {
        id: "m2",
        type: "assistant",
        content: [{ type: "text", text: "I found it." }],
      },
    ]);
    agentMocks.files.mockResolvedValue([
      { path: "report.md", type: "file", size: 12 },
    ]);
    const run = createMetaToolRunner(context);

    await expect(run("get_agent_history", { agent: "agent-1" })).resolves.toContain(
      "Find the report",
    );
    await expect(
      run("list_agent_files", { agent: "agent-1", path: "" }),
    ).resolves.toContain("report.md");
    await expect(
      run("read_agent_file", { agent: "agent-1", path: "report.md" }),
    ).resolves.toBe("hello");
  });

  it("checks all configured agents", async () => {
    agentMocks.agents = [
      {
        id: "agent-1",
        name: "Research agent",
        serverUrl: "http://127.0.0.1:9000",
        sessionId: "session-1",
      },
    ];
    agentMocks.status.mockResolvedValue({
      "session-1": { type: "busy" },
    });
    const run = createMetaToolRunner(context);

    const result = await run("check_agents");
    expect(result).toContain("Research agent: connected");
    expect(result).toContain("active session: session-1 — working");
  });

  it("returns current settings, models, memories, and personas", async () => {
    const run = createMetaToolRunner(context);

    await expect(run("list_memories")).resolves.toContain("Remember the milk");
    await expect(run("list_memories")).resolves.toContain(
      "group: Work",
    );
    await expect(run("list_memories")).resolves.toContain(
      "This chat's effective memory group: Work",
    );
    await expect(run("get_user_settings")).resolves.toContain("Default model: Test Model");
    await expect(run("get_user_settings")).resolves.toContain(
      "Memory groups: Default (1 memories), Work (1 memories)",
    );
    await expect(run("get_user_settings")).resolves.toContain(
      "Default memory group: Work",
    );
    await expect(run("list_models")).resolves.toContain("Other Model");
    await expect(run("list_personas")).resolves.toContain("writing/editor.json");
  });

  it("returns live conversation, topic, and message data", async () => {
    const run = createMetaToolRunner(context);

    await expect(run("list_chats")).resolves.toContain("Random PNG");
    await expect(run("list_topics")).resolves.toContain("Work");
    await expect(run("search_messages", { query: "png" })).resolves.toContain(
      "create a random png",
    );
  });

  it("starts tutorials and use cases from their ids", async () => {
    const run = createMetaToolRunner(context);
    const tutorialId = Object.keys(featureGuides)[0];
    const useCaseId = Object.keys(useCases)[0];
    const events = [];
    const onTutorial = (event) => events.push(["tutorial", event.detail]);
    const onUseCase = (event) => events.push(["useCase", event.detail]);
    window.addEventListener("chatai:start-feature-guide", onTutorial);
    window.addEventListener("chatai:start-use-case", onUseCase);

    await expect(run("start_tutorial", { id: tutorialId })).resolves.toContain("Started");
    await expect(run("start_use_case", { id: useCaseId })).resolves.toContain("Started");
    await expect(run("start_tutorial", { id: "does-not-exist" })).resolves.toBe(
      "Feature guide not found or unavailable in this deployment.",
    );

    window.removeEventListener("chatai:start-feature-guide", onTutorial);
    window.removeEventListener("chatai:start-use-case", onUseCase);
    expect(events).toEqual([
      ["tutorial", { featureId: tutorialId }],
      ["useCase", { useCaseId }],
    ]);
  });

  it("lists the configured tutorials and use cases", async () => {
    const run = createMetaToolRunner(context);
    const result = await run("list_tutorials");
    expect(result).toContain(Object.keys(featureGuides)[0]);
    expect(result).toContain(Object.keys(useCases)[0]);
  });

  it("only offers tour tools when the deployment renders tours", () => {
    const names = (tutorials) =>
      getMetaToolDefinitions(tutorials).map((tool) => tool.function.name);

    expect(names(true)).toEqual(META_TOOL_DEFINITIONS.map((tool) => tool.function.name));
    expect(names(false)).toContain("list_chats");
    expect(names(false)).toContain("get_user_settings");
    expect(names(false)).not.toContain("list_tutorials");
    expect(names(false)).not.toContain("start_tutorial");
    expect(names(false)).not.toContain("start_use_case");
  });
});
