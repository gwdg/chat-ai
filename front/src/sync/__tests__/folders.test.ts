import { describe, expect, it } from "vitest";

import { createFolder, deleteFolder, listFolders } from "../../db";
import { hashPayload } from "../canonical";
import { createFoldersNamespace } from "../namespaces/folders";

/**
 * A topic must hash the same after a pull. The row is rebuilt from the record,
 * so a locally created `createdAt` that differed from the record would make the
 * next `list()` look like an edit and push the topic on every sync.
 */
const remoteOf = (record: any) => ({
  namespace: "folders",
  id: record.id,
  rev: 1,
  hash: record.hash,
  payload: record.payload,
  deviceId: "dev-a",
});

describe("folders namespace", () => {
  it("adopts the record's creation time so its hash is stable", async () => {
    const id = "sync-folder-stable";
    await createFolder("Work", { icon: "folder" }, id);
    const namespace = createFoldersNamespace();
    const local: any = (await namespace.list()).find((entry) => entry.id === id);
    expect(local).toBeTruthy();

    const remote = {
      ...remoteOf(local),
      payload: { ...local.payload, createdAt: 111, updatedAt: 222, name: "Work remote" },
    };
    remote.hash = hashPayload(remote.payload);

    await namespace.apply(remote);

    const applied = (await namespace.list()).find((entry) => entry.id === id);
    expect(applied?.hash).toBe(remote.hash);
    expect((await listFolders()).find((folder) => folder.id === id)?.createdAt).toBe(111);

    await deleteFolder(id);
  });
});
