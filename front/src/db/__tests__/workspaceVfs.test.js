import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "../index";
import {
  collapseDuplicateNodes,
  getSourceNode,
  listSourceNodes,
  removeSourcePath,
  sourceUsage,
} from "../workspaceVfs";

const SOURCE = "workspace-browser:ws-dedupe";

const reset = async () => {
  await db.workspace_nodes.clear();
  await db.workspace_blobs.clear();
  await db.workspace_file_references.clear();
};

const fileRow = (id, path, extra = {}) => ({
  id,
  sourceId: SOURCE,
  path,
  parentPath: path.slice(0, path.lastIndexOf("/")) || "/",
  name: path.split("/").pop(),
  kind: "file",
  size: 5,
  ...extra,
});

const dirRow = (id, path) => ({
  id,
  sourceId: SOURCE,
  path,
  parentPath: path.slice(0, path.lastIndexOf("/")) || "/",
  name: path.split("/").pop(),
  kind: "dir",
});

const blobRow = (id, bytes = [1, 2, 3, 4, 5]) => ({
  id,
  sourceId: SOURCE,
  data: new Uint8Array(bytes),
});

const seedDuplicateFile = async () => {
  await db.workspace_nodes.bulkAdd([
    fileRow("node-a", "/notes.txt"),
    fileRow("node-b", "/notes.txt"),
  ]);
  await db.workspace_blobs.bulkAdd([blobRow("node-a"), blobRow("node-b")]);
};

describe("workspace VFS duplicate rows", () => {
  beforeEach(reset);
  afterEach(reset);

  it("lists a path once and looks up the same row", async () => {
    await seedDuplicateFile();

    const listed = await listSourceNodes(SOURCE, "/");
    expect(listed).toHaveLength(1);
    expect(listed[0].path).toBe("/notes.txt");

    const lookedUp = await getSourceNode(SOURCE, "/notes.txt");
    // A listing that shows one row and a lookup that picks another would make
    // every write land on the invisible duplicate.
    expect(lookedUp?.id).toBe(listed[0].id);
  });

  it("counts a duplicated file's bytes once", async () => {
    await seedDuplicateFile();
    expect(await sourceUsage(SOURCE)).toBe(5);
  });

  it("removes a duplicated file without reading the second row as a child", async () => {
    await seedDuplicateFile();

    await expect(
      removeSourcePath(SOURCE, "/notes.txt", false),
    ).resolves.toBeUndefined();

    expect(
      await db.workspace_nodes.where("sourceId").equals(SOURCE).count(),
    ).toBe(0);
    expect(await db.workspace_blobs.where("sourceId").equals(SOURCE).count()).toBe(
      0,
    );
  });

  it("still refuses to remove a non-empty folder without recursion", async () => {
    await db.workspace_nodes.bulkAdd([
      dirRow("docs", "/Docs"),
      fileRow("doc-a", "/Docs/a.md"),
    ]);

    await expect(removeSourcePath(SOURCE, "/Docs", false)).rejects.toThrow(
      "Directory is not empty",
    );
    await removeSourcePath(SOURCE, "/Docs", true);
    expect(
      await db.workspace_nodes.where("sourceId").equals(SOURCE).count(),
    ).toBe(0);
  });

  it("collapses duplicates onto the row that holds the bytes and repoints references", async () => {
    await db.workspace_nodes.bulkAdd([
      fileRow("node-a", "/notes.txt"),
      fileRow("node-b", "/notes.txt"),
    ]);
    // Only the second row kept bytes; a plain "lowest id" keeper would leave an
    // empty file behind.
    await db.workspace_blobs.add(blobRow("node-b"));
    await db.workspace_file_references.add({
      id: "ref-1",
      conversationId: "chat-1",
      workspaceId: "ws-dedupe",
      sourceId: SOURCE,
      nodeId: "node-a",
      createdAt: 1,
    });

    expect(await collapseDuplicateNodes(SOURCE)).toBe(1);

    const rows = await db.workspace_nodes.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("node-b");
    expect(await db.workspace_blobs.get("node-b")).toBeTruthy();
    expect(await db.workspace_blobs.get("node-a")).toBeUndefined();

    const reference = await db.workspace_file_references.get("ref-1");
    expect(reference?.nodeId).toBe("node-b");
  });

  it("keeps the preferred row when both duplicates hold bytes", async () => {
    await seedDuplicateFile();

    expect(await collapseDuplicateNodes(SOURCE, ["node-b"])).toBe(1);

    const rows = await db.workspace_nodes.toArray();
    expect(rows.map((row) => row.id)).toEqual(["node-b"]);
  });

  it("never collapses rows of two different sources at the same path", async () => {
    await db.workspace_nodes.bulkAdd([
      fileRow("node-a", "/notes.txt"),
      { ...fileRow("node-b", "/notes.txt"), sourceId: "workspace-browser:ws-2" },
    ]);
    await db.workspace_blobs.bulkAdd([
      blobRow("node-a"),
      { ...blobRow("node-b"), sourceId: "workspace-browser:ws-2" },
    ]);

    expect(await collapseDuplicateNodes(SOURCE)).toBe(0);
    expect(await db.workspace_nodes.count()).toBe(2);
  });
});
