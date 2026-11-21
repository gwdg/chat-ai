import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "../index";
import { applyWorkspaceBundle } from "../syncAdapters";
import { listSourceNodes } from "../workspaceVfs";
import { workspaceBrowserStorageId } from "../../workspace/browserStorage";

const WORKSPACE = "ws-sync";
const SOURCE = workspaceBrowserStorageId(WORKSPACE);

const reset = async () => {
  await db.workspaces.clear();
  await db.workspace_nodes.clear();
  await db.workspace_blobs.clear();
  await db.workspace_file_references.clear();
};

const node = (id, path, extra = {}) => ({
  id,
  sourceId: SOURCE,
  path,
  parentPath: "/",
  name: path.split("/").pop(),
  kind: "file",
  size: 5,
  ...extra,
});

const seed = async (nodes, blobs) => {
  await db.workspace_nodes.bulkAdd(nodes);
  await db.workspace_blobs.bulkAdd(
    blobs.map(([id, bytes]) => ({
      id,
      sourceId: SOURCE,
      data: new Uint8Array(bytes),
    })),
  );
};

const bundle = (tree) => ({
  workspace: {
    id: WORKSPACE,
    name: "Synced",
    createdAt: 1,
    lastModified: 1,
  },
  sources: [],
  mounts: [],
  chats: [],
  agents: [],
  sessions: [],
  tree,
});

const fileEntry = (path, bytes, extra = {}) => ({
  path,
  kind: "file",
  mime: "text/plain",
  data: new Uint8Array(bytes),
  ...extra,
});

const nodeIdsAt = async (path) =>
  (
    await db.workspace_nodes
      .where("[sourceId+path]")
      .equals([SOURCE, path])
      .toArray()
  ).map((row) => row.id);

describe("applying a synced workspace bundle", () => {
  beforeEach(reset);
  afterEach(reset);

  it("reuses the row already at that path instead of adding a second one", async () => {
    await seed([node("local-row", "/notes.txt")], [["local-row", [9]]]);
    await db.workspace_file_references.add({
      id: "ref-1",
      conversationId: "chat-1",
      workspaceId: WORKSPACE,
      sourceId: SOURCE,
      nodeId: "local-row",
      createdAt: 1,
    });

    await applyWorkspaceBundle(bundle([fileEntry("/notes.txt", [1, 2])]));

    expect(await nodeIdsAt("/notes.txt")).toEqual(["local-row"]);
    expect(
      new Uint8Array((await db.workspace_blobs.get("local-row")).data),
    ).toEqual(new Uint8Array([1, 2]));
    expect((await db.workspace_file_references.get("ref-1"))?.nodeId).toBe(
      "local-row",
    );
    expect(await listSourceNodes(SOURCE, "/")).toHaveLength(1);
  });

  it("stays at one row when the same bundle is applied twice", async () => {
    await applyWorkspaceBundle(bundle([fileEntry("/notes.txt", [1])]));
    const firstId = (await nodeIdsAt("/notes.txt"))[0];

    await applyWorkspaceBundle(bundle([fileEntry("/notes.txt", [1])]));

    expect(await nodeIdsAt("/notes.txt")).toEqual([firstId]);
    expect(
      await db.workspace_nodes.where("sourceId").equals(SOURCE).count(),
    ).toBe(1);
    expect(await db.workspace_blobs.count()).toBe(1);
  });

  it("collapses the two rows an earlier pull left at one path", async () => {
    // What the old apply did: a derived id next to the local row, both with bytes.
    await seed(
      [node("node-a", "/notes.txt"), node("node-b", "/notes.txt")],
      [
        ["node-a", [9]],
        ["node-b", [9]],
      ],
    );

    await applyWorkspaceBundle(bundle([fileEntry("/notes.txt", [1, 2, 3])]));

    const ids = await nodeIdsAt("/notes.txt");
    expect(ids).toHaveLength(1);
    expect(
      new Uint8Array((await db.workspace_blobs.get(ids[0])).data),
    ).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("keeps a pull from turning a local file into a folder", async () => {
    await seed([node("local-row", "/docs")], [["local-row", [1]]]);

    await applyWorkspaceBundle(bundle([{ path: "/docs", kind: "dir" }]));

    const rows = await db.workspace_nodes.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("file");
  });

  it("keeps the local bytes when the record carries only the file's shape", async () => {
    await seed([node("local-row", "/big.bin")], [["local-row", [7, 7]]]);

    await applyWorkspaceBundle(
      bundle([{ path: "/big.bin", kind: "file", missing: true }]),
    );

    expect(await nodeIdsAt("/big.bin")).toEqual(["local-row"]);
    expect(
      new Uint8Array((await db.workspace_blobs.get("local-row")).data),
    ).toEqual(new Uint8Array([7, 7]));
  });
});
