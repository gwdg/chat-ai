import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collapseDuplicateWorkspaceNodesUpgrade } from "../index";
import { workspaceBrowserStorageId } from "../../workspace/browserStorage";

const SCHEMA = {
  workspace_nodes: "id, sourceId, path, [sourceId+path], [sourceId+parentPath]",
  workspace_blobs: "id, sourceId",
  workspace_file_references: "id, conversationId, workspaceId, sourceId, nodeId",
};

const created = [];
let counter = 0;

const newDbName = () => {
  const name = `workspace-tree-dedupe-${counter++}`;
  created.push(name);
  return name;
};

const fileNode = (id, sourceId, path) => ({
  id,
  sourceId,
  path,
  parentPath: "/",
  name: path.split("/").pop(),
  kind: "file",
  size: 5,
});

const seed = async (name) => {
  const db = new Dexie(name);
  db.version(1).stores(SCHEMA);
  await db.open();
  const sourceA = workspaceBrowserStorageId("ws-a");
  const sourceB = workspaceBrowserStorageId("ws-b");
  await db.table("workspace_nodes").bulkAdd([
    fileNode("a-one", sourceA, "/notes.txt"),
    fileNode("a-two", sourceA, "/notes.txt"),
    fileNode("b-one", sourceB, "/notes.txt"),
  ]);
  await db.table("workspace_blobs").bulkAdd([
    { id: "a-two", sourceId: sourceA, data: new Uint8Array([1, 2, 3]) },
    { id: "b-one", sourceId: sourceB, data: new Uint8Array([4, 5]) },
  ]);
  await db.table("workspace_file_references").add({
    id: "ref-1",
    conversationId: "chat-1",
    workspaceId: "ws-a",
    sourceId: sourceA,
    nodeId: "a-one",
    createdAt: 1,
  });
  db.close();
  return name;
};

const openUpgraded = async (name) => {
  const db = new Dexie(name);
  db.version(1).stores(SCHEMA);
  db.version(2).stores({}).upgrade(collapseDuplicateWorkspaceNodesUpgrade);
  await db.open();
  return db;
};

describe("workspace tree dedupe migration", () => {
  beforeEach(() => {
    created.length = 0;
  });

  afterEach(async () => {
    await Promise.all(created.map((name) => Dexie.delete(name)));
    created.length = 0;
  });

  it("keeps one row per path, the copy that holds the bytes", async () => {
    const db = await openUpgraded(await seed(newDbName()));
    const sourceA = workspaceBrowserStorageId("ws-a");

    const rows = await db
      .table("workspace_nodes")
      .where("sourceId")
      .equals(sourceA)
      .toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("a-two");
    expect(await db.table("workspace_blobs").get("a-two")).toBeTruthy();
    expect(await db.table("workspace_blobs").get("a-one")).toBeUndefined();

    // The chat's attachment follows the row that stayed.
    const reference = await db
      .table("workspace_file_references")
      .get("ref-1");
    expect(reference.nodeId).toBe("a-two");

    // Another source at the same path is a different entry and keeps its row.
    const rowsB = await db
      .table("workspace_nodes")
      .where("sourceId")
      .equals(workspaceBrowserStorageId("ws-b"))
      .toArray();
    expect(rowsB.map((row) => row.id)).toEqual(["b-one"]);

    db.close();
  });

  it("leaves a database without duplicates alone", async () => {
    const name = newDbName();
    const seeded = new Dexie(name);
    seeded.version(1).stores(SCHEMA);
    await seeded.open();
    await seeded
      .table("workspace_nodes")
      .add(fileNode("only", workspaceBrowserStorageId("ws-a"), "/a.txt"));
    seeded.close();

    const db = await openUpgraded(name);
    expect(await db.table("workspace_nodes").count()).toBe(1);
    db.close();
  });
});
