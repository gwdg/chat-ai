import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isolateWorkspaceBrowserStorage } from "../index";
import {
  SHARED_BROWSER_STORAGE_ID,
  workspaceBrowserStorageId,
} from "../../workspace/browserStorage";

const SCHEMA = {
  workspaces: "id",
  workspace_nodes: "id, sourceId, path, [sourceId+path], [sourceId+parentPath]",
  workspace_blobs: "id, sourceId",
  workspace_file_references: "id, conversationId, workspaceId, sourceId, nodeId",
};

const created = [];
let counter = 0;

const newDbName = () => {
  const name = `browser-storage-migration-${counter++}`;
  created.push(name);
  return name;
};

const seedSharedTree = async (name) => {
  const db = new Dexie(name);
  db.version(1).stores(SCHEMA);
  await db.open();
  await db.table("workspaces").bulkAdd([
    { id: "ws-a", name: "A", createdAt: 1, lastModified: 1 },
    { id: "ws-b", name: "B", createdAt: 1, lastModified: 1 },
  ]);
  await db.table("workspace_nodes").bulkAdd([
    {
      id: "dir",
      sourceId: SHARED_BROWSER_STORAGE_ID,
      path: "/docs",
      parentPath: "/",
      name: "docs",
      kind: "dir",
    },
    {
      id: "file",
      sourceId: SHARED_BROWSER_STORAGE_ID,
      path: "/docs/a.txt",
      parentPath: "/docs",
      name: "a.txt",
      kind: "file",
      size: 3,
    },
  ]);
  await db.table("workspace_blobs").add({
    id: "file",
    sourceId: SHARED_BROWSER_STORAGE_ID,
    data: new Uint8Array([1, 2, 3]),
  });
  await db.table("workspace_file_references").add({
    id: "ref-a",
    conversationId: "chat-a",
    workspaceId: "ws-a",
    sourceId: SHARED_BROWSER_STORAGE_ID,
    nodeId: "file",
    createdAt: 1,
  });
  db.close();
  return name;
};

const openUpgraded = async (name) => {
  const db = new Dexie(name);
  db.version(1).stores(SCHEMA);
  db.version(2).stores({}).upgrade(isolateWorkspaceBrowserStorage);
  await db.open();
  return db;
};

describe("browser storage isolation migration", () => {
  beforeEach(() => {
    created.length = 0;
  });

  afterEach(async () => {
    await Promise.all(created.map((name) => Dexie.delete(name)));
    created.length = 0;
  });

  it("copies the shared tree into every workspace and remaps references", async () => {
    const db = await openUpgraded(await seedSharedTree(newDbName()));
    const nodes = db.table("workspace_nodes");
    const blobs = db.table("workspace_blobs");
    const references = db.table("workspace_file_references");

    const treeA = workspaceBrowserStorageId("ws-a");
    const treeB = workspaceBrowserStorageId("ws-b");

    const nodesA = await nodes.where("sourceId").equals(treeA).toArray();
    const nodesB = await nodes.where("sourceId").equals(treeB).toArray();
    expect(nodesA.map((node) => node.path).sort()).toEqual([
      "/docs",
      "/docs/a.txt",
    ]);
    expect(nodesB.map((node) => node.path).sort()).toEqual([
      "/docs",
      "/docs/a.txt",
    ]);

    // Each workspace has its own rows and blobs, so writing in one cannot
    // change the other.
    const fileA = nodesA.find((node) => node.kind === "file");
    const fileB = nodesB.find((node) => node.kind === "file");
    expect(fileA.id).not.toBe(fileB.id);
    expect(fileB.id).not.toBe("file");
    expect(new Uint8Array(await blobs.get(fileA.id).then((row) => row.data))).toEqual(
      new Uint8Array([1, 2, 3]),
    );

    // The shared rows are gone.
    expect(
      await nodes.where("sourceId").equals(SHARED_BROWSER_STORAGE_ID).count(),
    ).toBe(0);
    expect(
      await blobs.where("sourceId").equals(SHARED_BROWSER_STORAGE_ID).count(),
    ).toBe(0);

    // The chat reference follows the workspace's copy.
    const reference = await references.get("ref-a");
    expect(reference.sourceId).toBe(treeA);
    expect(reference.nodeId).toBe(fileA.id);

    db.close();
  });

  it("leaves a database without a shared tree untouched", async () => {
    const name = newDbName();
    const seeded = new Dexie(name);
    seeded.version(1).stores(SCHEMA);
    await seeded.open();
    await seeded.table("workspaces").add({
      id: "ws-a",
      name: "A",
      createdAt: 1,
      lastModified: 1,
    });
    seeded.close();

    const db = await openUpgraded(name);
    expect(await db.table("workspace_nodes").count()).toBe(0);
    expect(await db.table("workspace_file_references").count()).toBe(0);
    db.close();
  });
});
