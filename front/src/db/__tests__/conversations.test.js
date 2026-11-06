import { beforeEach, describe, expect, it } from "vitest";
import {
  assignConversationToFolder,
  createConversation,
  createFolder,
  db,
  ensureFolder,
  getConversation,
  getConversationMeta,
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
