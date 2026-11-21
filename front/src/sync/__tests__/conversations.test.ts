import { describe, expect, it } from "vitest";

import {
  createConversation,
  deleteConversation,
  getConversation,
  loadFile,
  saveFileReady,
  updateConversation,
} from "../../db";
import { getDefaultSettings } from "../../utils/conversationUtils";
import { hashPayload } from "../canonical";
import { createConversationsNamespace } from "../namespaces/conversations";

/**
 * Round trip through the real IndexedDB schema: serialize a conversation (with
 * a message id and an attachment), delete it, then apply the sealed-shaped
 * remote record and check that both came back.
 */
const settings = getDefaultSettings({});

const remoteOf = (record: any) => ({
  namespace: record.namespace,
  id: record.id,
  rev: 1,
  hash: record.hash,
  payload: record.payload,
  deviceId: "dev-a",
});

const assetReader = (record: any) => async (sha256: string) =>
  record.assets.find((asset: any) => asset.sha256 === sha256)?.bytes ?? null;

describe("conversations namespace", () => {
  it("round-trips messages, ids and attachments", async () => {
    const id = "sync-conversation-round-trip";
    await createConversation({ id, title: "Sync me", settings, messages: [] });
    const fileId = await saveFileReady(
      id,
      new File([new TextEncoder().encode("hello sync")], "note.txt", {
        type: "text/plain",
      }),
    );
    await updateConversation(
      id,
      {
        title: "Sync me",
        messages: [
          {
            id: "m-user",
            idx: 0,
            role: "user",
            content: [{ type: "text", text: "hello" }],
            createdAt: 1,
          },
          {
            id: "m-assistant",
            idx: 1,
            role: "assistant",
            content: [
              { type: "text", text: "hi" },
              { type: "file", fileId },
            ],
            createdAt: 2,
          },
        ],
      },
      true,
    );

    const namespace = createConversationsNamespace();
    const records = await namespace.list();
    const record: any = records.find((entry) => entry.id === id);
    expect(record).toBeTruthy();
    expect(record.hash).toBe(hashPayload(record.payload));
    expect(record.payload.title).toBe("Sync me");
    expect(record.payload.messages.map((message: any) => message.id)).toEqual([
      "m-user",
      "m-assistant",
    ]);

    const fileItem = record.payload.messages[1].content.find(
      (item: any) => item.type === "file",
    );
    expect(fileItem.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(record.assets).toHaveLength(1);
    expect(new TextDecoder().decode(record.assets[0].bytes)).toBe("hello sync");

    await deleteConversation(id);
    expect(await getConversation(id)).toBeNull();

    await namespace.apply(remoteOf(record), {
      now: Date.now(),
      deviceId: "dev-b",
      readAsset: assetReader(record),
    });

    const restored = await getConversation(id);
    expect(restored?.title).toBe("Sync me");
    expect(restored?.messages.map((message: any) => message.id)).toEqual([
      "m-user",
      "m-assistant",
    ]);
    expect(restored?.messages[0].content).toEqual([
      { type: "text", text: "hello" },
    ]);

    const restoredFile = restored?.messages[1].content.find(
      (item: any) => item.type === "file",
    );
    expect(restoredFile?.fileId).toBeTruthy();
    const file = await loadFile(restoredFile!.fileId);
    expect(file?.name).toBe("note.txt");
    expect(await file!.text()).toBe("hello sync");

    await deleteConversation(id);
  });

  it("serializes the same payload after applying its own record", async () => {
    const id = "sync-conversation-stable";
    const createdAt = 1_700_000_000_000;
    await createConversation({ id, title: "Stable", settings, messages: [], createdAt });
    const fileId = await saveFileReady(
      id,
      new File([new TextEncoder().encode("stable bytes")], "stable.txt", {
        type: "text/plain",
      }),
    );
    await updateConversation(
      id,
      {
        title: "Stable",
        messages: [
          {
            id: "m1",
            idx: 0,
            role: "user",
            content: [{ type: "text", text: "hello" }],
            createdAt: 1,
          },
          {
            id: "m2",
            idx: 1,
            role: "assistant",
            content: [{ type: "file", fileId }],
            createdAt: 2,
          },
        ],
      },
      true,
    );

    const namespace = createConversationsNamespace();
    const before: any = (await namespace.list()).find((record) => record.id === id);
    expect(before).toBeTruthy();
    expect(before.payload.createdAt).toBe(createdAt);

    await deleteConversation(id);
    await namespace.apply(remoteOf(before), {
      now: Date.now(),
      deviceId: "dev-b",
      readAsset: assetReader(before),
    });

    // A pull must not look like an edit: no lastModified/feedback/persona
    // drift may change the hash, or every device would push in a loop.
    const after: any = (await namespace.list()).find((record) => record.id === id);
    expect(after.hash).toBe(before.hash);
    expect(after.payload.createdAt).toBe(createdAt);
    expect(after.payload.persona).toBeNull();
    expect(after.payload.messages[0].feedback).toBeUndefined();

    await deleteConversation(id);
  });

  it("leaves out a file whose bytes are missing instead of a placeholder", async () => {
    const id = "sync-conversation-missing-file";
    await createConversation({ id, title: "Missing", settings, messages: [] });
    await updateConversation(
      id,
      {
        title: "Missing",
        messages: [
          {
            id: "m1",
            idx: 0,
            role: "user",
            content: [{ type: "file", fileId: "does-not-exist" }],
            createdAt: 1,
          },
        ],
      },
      true,
    );

    const namespace = createConversationsNamespace();
    const record: any = (await namespace.list()).find((entry) => entry.id === id);
    expect(record.payload.messages[0].content).toEqual([]);
    expect(namespace.takeSkipped?.().join(" ")).toMatch(/missing on this device/i);

    await deleteConversation(id);
  });

  it("treats an appended remote message list as a fast-forward", () => {    const namespace = createConversationsNamespace();
    const local = { messages: [{ id: "a" }, { id: "b" }] };
    const appended = { messages: [{ id: "a" }, { id: "b" }, { id: "c" }] };

    expect(namespace.extends?.(local, appended)).toBe(true);
    expect(
      namespace.extends?.(local, { messages: [{ id: "a" }, { id: "x" }] }),
    ).toBe(false);
    expect(namespace.extends?.(local, { messages: [{ id: "a" }] })).toBe(false);
  });

  it("keeps the Meta chat out of the archive", async () => {
    const id = "meta-chat";
    await createConversation({
      id,
      title: "Meta",
      settings,
      messages: [],
      isMetaChat: true,
    });

    const records = await createConversationsNamespace().list();
    expect(records.some((record) => record.id === "meta-chat")).toBe(false);

    await deleteConversation(id);
  });

  it("titles the conflict copy with the documented suffix", async () => {
    const id = "sync-conversation-conflict";
    await createConversation({ id, title: "Original", settings, messages: [] });
    const namespace = createConversationsNamespace();
    const record: any = (await namespace.list()).find((entry) => entry.id === id);
    expect(record).toBeTruthy();

    await namespace.duplicate?.(remoteOf({ ...record, payload: { ...record.payload, title: "Remote" } }), {
      now: Date.now(),
      deviceId: "dev-b",
      readAsset: async () => null,
    });

    const metas = await import("../../db").then((db) => db.listConversationMetas());
    const copy = metas.find((meta) => meta.title === "Remote (conflict copy)");
    expect(copy).toBeTruthy();
    await deleteConversation(id);
    if (copy) await deleteConversation(copy.id);
  });
});
