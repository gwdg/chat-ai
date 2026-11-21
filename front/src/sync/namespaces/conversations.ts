import {
  createConversation,
  deleteConversation,
  ensureFolder,
  getConversation,
  getConversationMeta,
  getFolder,
  listConversationMetas,
  loadFile,
  saveFileReady,
  updateConversation,
} from "../../db";
import type { ApplyContext, LocalRecord, RemoteRecord, SyncNamespace } from "../types";
import { hashPayload } from "../canonical";
import { setConversationPersonaForSync } from "../../db/syncAdapters";
import { AssetCollector, MAX_SYNC_FILE_BYTES } from "./assets";

/**
 * Conversations are the unit of sync. A record carries the whole chat —
 * messages keep their ids, so an append on another device is recognisable as an
 * append — and every attachment becomes a content-addressed asset instead of
 * base64 inside the record.
 *
 * `META_CHAT_ID` is excluded like `getExportData()` excludes it: it is derived
 * from the other chats and would otherwise fight itself on every device.
 */
const META_CHAT_ID = "meta-chat";

const CONFLICT_SUFFIX = " (conflict copy)";

type Serialized = { payload: any; assets: any[]; skipped: string[] };

async function serializeConversation(
  conversation: any,
): Promise<Serialized> {
  const collector = new AssetCollector();
  const messages: any[] = [];

  for (const message of conversation.messages ?? []) {
    const content: any[] = [];
    for (const item of message.content ?? []) {
      if (item?.type === "text") {
        content.push({ type: "text", text: String(item.text ?? "") });
        continue;
      }
      if (item?.type === "form" && item.form) {
        content.push({ type: "form", form: item.form });
        continue;
      }
      if (item?.type === "file" && item.fileId) {
        const file = await loadFile(item.fileId).catch(() => null);
        if (!file) {
          // No bytes here: the item is left out instead of being pushed as a
          // placeholder. A placeholder would be dropped on the other device and
          // make the two payloads differ, so every sync would push again.
          collector.skip(`${item.name || "file"} (missing on this device)`);
          continue;
        }
        if (file.size > MAX_SYNC_FILE_BYTES) {
          collector.skip(`${file.name || "file"} (${file.size} bytes)`);
          continue;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const sha256 = collector.add(bytes, file.name || "file");
        if (!sha256) {
          continue;
        }
        content.push({
          type: "file",
          sha256,
          name: file.name,
          mime: file.type,
          size: file.size,
        });
      }
    }
    messages.push({
      id: message.id,
      idx: message.idx,
      role: message.role,
      createdAt: message.createdAt,
      // The store normalises a missing feedback object to `{}`; hashing `{}` and
      // `undefined` differently would re-push every pulled message.
      feedback:
        message.feedback && Object.keys(message.feedback).length
          ? message.feedback
          : undefined,
      content,
    });
  }

  const folder = conversation.folderId
    ? await getFolder(conversation.folderId).catch(() => null)
    : null;

  const payload = {
    id: conversation.id,
    title: conversation.title ?? "Untitled Chat",
    createdAt: conversation.createdAt,
    folderId: conversation.folderId ?? null,
    folderName: folder?.name ?? null,
    persona: conversation.persona ?? null,
    settings: conversation.settings ?? {},
    hasFirstPrompt: conversation.hasFirstPrompt === true,
    messages,
  };

  return {
    payload,
    assets: collector.take(),
    skipped: collector.takeSkipped(),
  };
}

export function createConversationsNamespace(): SyncNamespace {
  let skipped: string[] = [];

  const applyRecord = async (
    remote: RemoteRecord,
    ctx: ApplyContext,
    overrides: { id?: string; title?: string } = {},
  ) => {
    const payload = remote.payload ?? {};
    const id = overrides.id ?? payload.id ?? remote.id;
    const title = overrides.title ?? payload.title ?? "Untitled Chat";
    const files = new Map<string, string>();

    const messages: any[] = [];
    for (const message of payload.messages ?? []) {
      const content: any[] = [];
      for (const item of message.content ?? []) {
        if (item?.type === "text") {
          content.push({ type: "text", text: String(item.text ?? "") });
          continue;
        }
        if (item?.type === "form" && item.form) {
          content.push({ type: "form", form: item.form });
          continue;
        }
        if (item?.type !== "file" || !item.sha256) continue;
        let fileId = files.get(item.sha256);
        if (!fileId) {
          const bytes = await ctx.readAsset(item.sha256);
          if (bytes) {
            const file = new File([bytes], item.name || "file", {
              type: item.mime || "application/octet-stream",
            });
            fileId = await saveFileReady(id, file);
            files.set(item.sha256, fileId);
          }
        }
        if (fileId) content.push({ type: "file", fileId });
        else skipped.push(`${item.name || "file"} (missing on the server)`);
      }
      messages.push({
        id: message.id,
        idx: message.idx,
        role: message.role,
        createdAt: message.createdAt,
        feedback:
          message.feedback && Object.keys(message.feedback).length
            ? message.feedback
            : undefined,
        content,
      });
    }

    const folderName = payload.folderName;
    let folderId: string | null = payload.folderId ?? null;
    if (folderId && !(await getFolder(folderId))) {
      folderId = folderName ? await ensureFolder(folderName, folderId) : null;
    } else if (!folderId && folderName) {
      folderId = await ensureFolder(folderName);
    }

    const existing = await getConversationMeta(id);
    if (!existing) {
      await createConversation({
        id,
        title,
        settings: payload.settings ?? {},
        messages,
        folderId,
        hasFirstPrompt: payload.hasFirstPrompt === true,
        persona: payload.persona ?? null,
        createdAt: payload.createdAt,
      });
      return;
    }
    await updateConversation(
      id,
      {
        title,
        settings: payload.settings ?? existing.settings,
        messages,
        folderId,
        hasFirstPrompt: payload.hasFirstPrompt === true,
      },
      true,
    );
    // `updateConversation` does not carry the persona, but the record does.
    if ((existing.persona ?? null) !== (payload.persona ?? null)) {
      await setConversationPersonaForSync(id, payload.persona ?? null);
    }
  };

  return {
    name: "conversations",
    async list(): Promise<LocalRecord[]> {
      skipped = [];
      const metas = (await listConversationMetas()).filter(
        (meta) => !meta.isMetaChat && meta.id !== META_CHAT_ID,
      );
      const records: LocalRecord[] = [];
      for (const meta of metas) {
        const conversation = await getConversation(meta.id);
        if (!conversation) continue;
        const { payload, assets, skipped: localSkipped } =
          await serializeConversation(conversation);
        skipped.push(...localSkipped.map((name) => `${conversation.title}: ${name}`));
        records.push({
          namespace: "conversations",
          id: conversation.id,
          hash: hashPayload(payload),
          payload,
          assets,
          title: payload.title,
        });
      }
      return records;
    },
    async apply(remote, ctx) {
      await applyRecord(remote, ctx);
    },
    async remove(id: string) {
      await deleteConversation(id);
    },
    /**
     * A remote message list that starts with every local message id is an
     * append, not a divergence: the chat continued on another device. Replacing
     * locally costs nothing, because nothing local is outside the new list.
     */
    extends(local: any, remote: any) {
      const localMessages = local?.messages ?? [];
      const remoteMessages = remote?.messages ?? [];
      if (remoteMessages.length < localMessages.length) return false;
      for (let i = 0; i < localMessages.length; i += 1) {
        if (localMessages[i]?.id !== remoteMessages[i]?.id) return false;
      }
      return true;
    },
    async duplicate(remote, ctx) {
      const title = `${remote.payload?.title ?? "Chat"}${CONFLICT_SUFFIX}`;
      await applyRecord(remote, ctx, {
        id: crypto.randomUUID?.() ?? `${remote.id}-conflict-${Date.now()}`,
        title,
      });
    },
    titleOf(payload: any) {
      return String(payload?.title ?? "Chat");
    },
    takeSkipped() {
      const out = skipped;
      skipped = [];
      return out;
    },
  };
}
