import { deleteFolder, listFolders } from "../../db";
import { hashPayload } from "../canonical";
import type { LocalRecord, RemoteRecord, SyncNamespace } from "../types";
import { upsertFolder } from "../../db/syncAdapters";

/**
 * Topics ("folders" in the database, see AGENTS.md §4.4). They are small and
 * referenced by conversations, so they travel with them; a conversation that
 * arrives before its topic creates the topic itself.
 */
export function createFoldersNamespace(): SyncNamespace {
  return {
    name: "folders",
    async list(): Promise<LocalRecord[]> {
      const folders = await listFolders();
      return folders.map((folder) => {
        const payload = {
          id: folder.id,
          name: folder.name,
          icon: folder.icon ?? null,
          color: folder.color ?? null,
          pinned: folder.pinned === true,
          sortOrder: folder.sortOrder ?? null,
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt ?? folder.createdAt,
        };
        return {
          namespace: "folders",
          id: folder.id,
          hash: hashPayload(payload),
          payload,
          title: folder.name,
        };
      });
    },
    async apply(record: RemoteRecord) {
      await upsertFolder(record.payload);
    },
    async remove(id: string) {
      await deleteFolder(id);
    },
    titleOf(payload: any) {
      return String(payload?.name ?? "Topic");
    },
  };
}
