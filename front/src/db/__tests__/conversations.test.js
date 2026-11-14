import { beforeEach, describe, expect, it } from "vitest";
import {
  assignConversationToFolder,
  createConversation,
  createFolder,
  db,
  ensureFolder,
  getConversation,
  getConversationMeta,
  getLastModifiedConversationMeta,
  loadFile,
  saveFileReady,
  searchMessages,
  updateConversation,
} from "../index";

const settings = {
  model: { id: "test-model", name: "Test Model" },
  temperature: 0.5,
  top_p: 0.5,
  tools: {},
};

const clearDB = () =>
  db.transaction(
    "rw",
    [db.conversations, db.messages, db.content_items, db.files_meta, db.files_data, db.folders],
    async () => {
      await Promise.all([
        db.conversations.clear(),
        db.messages.clear(),
        db.content_items.clear(),
        db.files_meta.clear(),
        db.files_data.clear(),
        db.folders.clear(),
      ]);
    },
  );

describe("conversation persistence", () => {
  beforeEach(async () => {
    await clearDB();
  });

  it("creates and hydrates a conversation", async () => {
    await createConversation({
      id: "chat-1",
      title: "Hello",
      settings,
      messages: [
        {
          idx: 0,
          role: "user",
          content: [{ type: "text", text: "hello world" }],
        },
      ],
    });

    const conversation = await getConversation("chat-1");
    expect(conversation.title).toBe("Hello");
    expect(conversation.messages[0].content[0].text).toBe("hello world");
  });

  it("rejects stale writes and accepts current lastModified", async () => {
    await createConversation({
      id: "chat-1",
      title: "Old",
      settings,
      messages: [],
    });
    const meta = await getConversationMeta("chat-1");

    const stale = await updateConversation("chat-1", {
      title: "Stale",
      settings,
      messages: [],
      lastModified: meta.lastModified - 1,
    });
    expect(stale).toBe(-1);

    const current = await updateConversation("chat-1", {
      title: "New",
      settings,
      messages: [],
      lastModified: meta.lastModified,
    });
    expect(current).not.toBe(-1);
    expect((await getConversationMeta("chat-1")).title).toBe("New");
  });

  it("returns a conflict for a missing conversation instead of throwing", async () => {
    const result = await updateConversation("missing-chat", {
      title: "Missing",
      settings,
      messages: [],
      lastModified: 0,
    });
    expect(result).toBe(-1);
  });

  it("does not let an empty snapshot erase stored messages", async () => {
    await createConversation({
      id: "chat-1",
      title: "Keep me",
      settings,
      messages: [
        {
          idx: 0,
          role: "user",
          content: [{ type: "text", text: "important message" }],
        },
      ],
    });
    const meta = await getConversationMeta("chat-1");

    const result = await updateConversation("chat-1", {
      title: "Keep me",
      settings,
      messages: [],
      lastModified: meta.lastModified,
    });

    expect(result).toBe(-1);
    const conversation = await getConversation("chat-1");
    expect(conversation.messages).toHaveLength(1);
    expect(conversation.messages[0].content[0].text).toBe("important message");
  });

  it("protects stored messages even when the stale empty write is forced", async () => {
    await createConversation({
      id: "chat-1",
      title: "Keep me",
      settings,
      messages: [
        {
          idx: 0,
          role: "user",
          content: [{ type: "text", text: "important message" }],
        },
      ],
    });

    const result = await updateConversation(
      "chat-1",
      { title: "Keep me", settings, messages: [] },
      true,
    );

    expect(result).toBe(-1);
    const conversation = await getConversation("chat-1");
    expect(conversation.messages).toHaveLength(1);
  });

  it("allows an empty snapshot when no messages are stored", async () => {
    await createConversation({ id: "chat-1", title: "Empty", settings, messages: [] });
    const meta = await getConversationMeta("chat-1");

    const result = await updateConversation("chat-1", {
      title: "Renamed",
      settings,
      messages: [],
      lastModified: meta.lastModified,
    });

    expect(result).not.toBe(-1);
    expect((await getConversationMeta("chat-1")).title).toBe("Renamed");
  });

  it("lets forced writes bypass a stale lastModified", async () => {
    await createConversation({
      id: "chat-1",
      title: "Original",
      settings,
      messages: [
        {
          idx: 0,
          role: "user",
          content: [{ type: "text", text: "hello" }],
        },
      ],
    });
    const meta = await getConversationMeta("chat-1");

    const result = await updateConversation(
      "chat-1",
      {
        title: "Forced",
        settings,
        messages: [
          {
            idx: 0,
            role: "user",
            content: [{ type: "text", text: "hello" }],
          },
        ],
        lastModified: meta.lastModified - 1,
      },
      true,
    );

    expect(result).not.toBe(-1);
    expect((await getConversationMeta("chat-1")).title).toBe("Forced");
  });

  it("returns the most recent conversation and skips the meta chat", async () => {
    await createConversation({ id: "older", title: "Older", settings, messages: [] });
    await createConversation({ id: "newer", title: "Newer", settings, messages: [] });
    await createConversation({
      id: "meta-chat",
      title: "Meta",
      settings,
      messages: [],
      isMetaChat: true,
    });
    await db.conversations.update("older", { lastModified: 100 });
    await db.conversations.update("newer", { lastModified: 200 });
    await db.conversations.update("meta-chat", { lastModified: 300 });

    const latest = await getLastModifiedConversationMeta();
    expect(latest.id).toBe("newer");
  });

  it("falls back to createdAt and lastOpenedAt when lastModified is missing", async () => {
    const base = {
      title: "Chat",
      settings,
      messageCount: 0,
      folderId: null,
      hasFirstPrompt: false,
    };
    await db.conversations.put({
      ...base,
      id: "created-only",
      createdAt: 500,
      lastOpenedAt: 100,
    });
    await db.conversations.put({
      ...base,
      id: "opened-only",
      lastOpenedAt: 400,
    });
    await db.conversations.put({
      ...base,
      id: "modified",
      createdAt: 1,
      lastModified: 300,
      lastOpenedAt: 1,
    });

    const latest = await getLastModifiedConversationMeta();
    expect(latest.id).toBe("created-only");
  });

  it("searches message contents", async () => {
    await createConversation({
      id: "chat-1",
      title: "Search",
      settings,
      messages: [
        {
          idx: 0,
          role: "user",
          content: [{ type: "text", text: "needle in a haystack" }],
        },
      ],
    });

    const results = await searchMessages("needle");
    expect(results.some((match) => match.conversationId === "chat-1")).toBe(true);
  });

  it("creates topics once and assigns conversations", async () => {
    await createConversation({ id: "chat-1", title: "Chat", settings, messages: [] });
    const folderId = await createFolder("Work");
    const sameId = await ensureFolder("Work");

    expect(sameId).toBe(folderId);
    await assignConversationToFolder("chat-1", folderId);
    expect((await getConversationMeta("chat-1")).folderId).toBe(folderId);
  });

  it("stores and loads file bytes", async () => {
    await createConversation({ id: "chat-1", title: "Files", settings, messages: [] });
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const fileId = await saveFileReady(
      "chat-1",
      new File([bytes], "image.png", { type: "image/png" }),
    );

    const file = await loadFile(fileId);
    expect(file.name).toBe("image.png");
    expect(file.type).toBe("image/png");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
  });
});
