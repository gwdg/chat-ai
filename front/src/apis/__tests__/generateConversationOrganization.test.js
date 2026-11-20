import { beforeEach, describe, expect, it, vi } from "vitest";
import generateConversationOrganization from "../generateConversationOrganization";
import { createBackendClient } from "../openaiClient";

vi.mock("../openaiClient", () => ({
  createBackendClient: vi.fn(),
}));

const create = vi.fn();

const chunk = (delta) => ({ choices: [{ delta }] });

const conversations = [
  { id: "c1", title: "Sprint notes", folderId: null },
  { id: "c2", title: "Tax documents", folderId: null },
];

const answer = {
  assessment: "Two unrelated chats.",
  tree: [
    {
      topic_id: "",
      name: "Admin",
      color: "rose",
      icon: "💼",
      conversation_ids: ["c2"],
    },
  ],
  titles: [],
  deletions: [],
};

async function* streamOf(items) {
  for (const item of items) yield item;
}

describe("generateConversationOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_TITLE_GENERATION_MODEL", "test-model");
    vi.mocked(createBackendClient).mockReturnValue({
      chat: { completions: { create } },
    });
  });

  it("streams the answer and parses the JSON", async () => {
    const json = JSON.stringify(answer);
    create.mockImplementation(async (params) => {
      expect(params.stream).toBe(true);
      return streamOf([
        chunk({ content: json.slice(0, 20) }),
        chunk({ content: json.slice(20) }),
      ]);
    });

    const result = await generateConversationOrganization({
      conversations,
      folders: [],
      language: "en",
    });

    expect(result.assessment).toBe("Two unrelated chats.");
    expect(result.tree).toHaveLength(1);
    expect(create.mock.calls[0][0].extra_body.guided_json).toBeTruthy();
  });

  it("reports the word count of the arriving answer", async () => {
    const json = JSON.stringify(answer);
    const reports = [];
    create.mockImplementation(async () =>
      streamOf([
        chunk({ content: json.slice(0, 10) }),
        chunk({ content: json.slice(10) }),
      ]),
    );

    await generateConversationOrganization({
      conversations,
      folders: [],
      language: "en",
      onProgress: (progress) => reports.push(progress),
    });

    const words = json.trim().split(/\s+/).length;
    expect(reports.length).toBeGreaterThan(1);
    expect(reports.at(-1).words).toBe(words);
    expect(reports.at(-1).chars).toBe(json.length);
  });

  it("counts reasoning separately while the answer is still empty", async () => {
    const reports = [];
    create.mockImplementation(async () =>
      streamOf([
        chunk({ reasoning: "thinking about the chats" }),
        chunk({ content: JSON.stringify(answer) }),
      ]),
    );

    await generateConversationOrganization({
      conversations,
      folders: [],
      language: "en",
      onProgress: (progress) => reports.push(progress),
    });

    expect(reports[0]).toMatchObject({ words: 0, reasoningWords: 4 });
    expect(reports.at(-1).words).toBeGreaterThan(0);
  });

  it("falls back to a non-streamed request when the stream is empty", async () => {
    create.mockImplementation(async (params) => {
      if (params.stream) return streamOf([]);
      return { choices: [{ message: { content: JSON.stringify(answer) } }] };
    });

    const result = await generateConversationOrganization({
      conversations,
      folders: [],
      language: "en",
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].stream).toBe(false);
    expect(result.tree).toHaveLength(1);
  });

  it("throws when the model answers without a tree", async () => {
    create.mockImplementation(async () =>
      streamOf([chunk({ content: '{"assessment":"nope"}' })]),
    );

    await expect(
      generateConversationOrganization({ conversations, folders: [], language: "en" }),
    ).rejects.toThrow("invalid organization");
  });

  it("returns an empty result without calling the model for no conversations", async () => {
    const result = await generateConversationOrganization({
      conversations: [],
      folders: [],
      language: "en",
    });

    expect(create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ analyzedCount: 0, totalCount: 0, tree: [] });
  });
});
