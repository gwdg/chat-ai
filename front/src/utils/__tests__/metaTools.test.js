import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createMetaToolRunner,
  META_TOOL_DEFINITIONS,
} from "../metaTools";
import {
  getRecentMessageExcerpts,
  listConversationMetas,
  listFolders,
  searchMessages,
} from "../../db";
import { featureGuides } from "../../config/featureGuides";
import { useCases } from "../../config/useCases";

vi.mock("../../db", () => ({
  listConversationMetas: vi.fn(),
  listFolders: vi.fn(),
  searchMessages: vi.fn(),
  getRecentMessageExcerpts: vi.fn(),
  getConversationMeta: vi.fn(),
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
    memories: [],
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
  memories: [{ text: "Remember the milk" }, { text: "Call Alice" }],
};

describe("Meta chat local tools", () => {
  beforeEach(() => {
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
      "list_models",
      "list_personas",
      "list_tutorials",
      "start_tutorial",
      "start_use_case",
    ]);
  });

  it("returns current settings, models, memories, and personas", async () => {
    const run = createMetaToolRunner(context);

    await expect(run("list_memories")).resolves.toContain("Remember the milk");
    await expect(run("get_user_settings")).resolves.toContain("Default model: Test Model");
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
      "Feature guide not found.",
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
});
