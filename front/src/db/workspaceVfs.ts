import { db, newId } from "./index";
import type { WorkspaceNodeRow } from "./dbTypes";
import { baseName, joinPath, normalizePath, parentPath } from "../workspace/paths";

const sortNodes = (a: WorkspaceNodeRow, b: WorkspaceNodeRow) =>
  Number(b.kind === "dir") - Number(a.kind === "dir") ||
  a.name.localeCompare(b.name);

export async function listSourceNodes(
  sourceId: string,
  path: string,
): Promise<WorkspaceNodeRow[]> {
  const parent = normalizePath(path);
  const rows = await db.workspace_nodes
    .where("[sourceId+parentPath]")
    .equals([sourceId, parent])
    .toArray();
  return rows.sort(sortNodes);
}

export async function getSourceNode(
  sourceId: string,
  path: string,
): Promise<WorkspaceNodeRow | undefined> {
  const normalized = normalizePath(path);
  if (normalized === "/") return undefined;
  return db.workspace_nodes
    .where("[sourceId+path]")
    .equals([sourceId, normalized])
    .first();
}

export async function ensureSourceDir(
  sourceId: string,
  path: string,
): Promise<void> {
  const normalized = normalizePath(path);
  if (normalized === "/") return;
  const segments = normalized.split("/").filter(Boolean);
  let current = "/";
  for (const segment of segments) {
    current = joinPath(current, segment);
    const existing = await getSourceNode(sourceId, current);
    if (!existing) {
      await db.workspace_nodes.add({
        id: newId(),
        sourceId,
        path: current,
        parentPath: parentPath(current),
        name: segment,
        kind: "dir",
        mtime: new Date().toISOString(),
      });
    }
  }
}

export async function writeSourceFile(
  sourceId: string,
  path: string,
  data: Uint8Array,
  mime?: string,
): Promise<WorkspaceNodeRow> {
  const normalized = normalizePath(path);
  await ensureSourceDir(sourceId, parentPath(normalized));
  const existing = await getSourceNode(sourceId, normalized);
  const node: WorkspaceNodeRow = {
    id: existing?.id ?? newId(),
    sourceId,
    path: normalized,
    parentPath: parentPath(normalized),
    name: baseName(normalized),
    kind: "file",
    size: data.byteLength,
    mtime: new Date().toISOString(),
    mime,
  };
  await db.transaction("rw", [db.workspace_nodes, db.workspace_blobs], async () => {
    await db.workspace_nodes.put(node);
    await db.workspace_blobs.put({
      id: node.id,
      sourceId,
      data,
    });
  });
  return node;
}

export async function removeSourcePath(
  sourceId: string,
  path: string,
  recursive: boolean,
): Promise<void> {
  const normalized = normalizePath(path);
  const node = await getSourceNode(sourceId, normalized);
  if (!node) return;
  const nodes = await db.workspace_nodes.where("sourceId").equals(sourceId).toArray();
  const affected = nodes.filter(
    (item) =>
      item.path === normalized ||
      (recursive && item.path.startsWith(`${normalized}/`)),
  );
  if (!recursive && affected.length > 1) {
    throw new Error("Directory is not empty");
  }
  await db.transaction("rw", [db.workspace_nodes, db.workspace_blobs], async () => {
    const ids = affected.map((item) => item.id);
    await db.workspace_nodes.bulkDelete(ids);
    await db.workspace_blobs.bulkDelete(ids);
  });
}

export async function deleteSourceNodes(sourceId: string): Promise<void> {
  const nodes = await db.workspace_nodes.where("sourceId").equals(sourceId).toArray();
  const ids = nodes.map((item) => item.id);
  await db.transaction("rw", [db.workspace_nodes, db.workspace_blobs], async () => {
    await db.workspace_nodes.bulkDelete(ids);
    await db.workspace_blobs.bulkDelete(ids);
  });
}

export async function getSourceBlob(
  sourceId: string,
  nodeId: string,
): Promise<Uint8Array | undefined> {
  const row = await db.workspace_blobs.get(nodeId);
  return row?.sourceId === sourceId ? row.data : undefined;
}

export async function sourceUsage(sourceId: string): Promise<number> {
  const nodes = await db.workspace_nodes
    .where("sourceId")
    .equals(sourceId)
    .toArray();
  return nodes.reduce(
    (sum, node) => sum + (node.kind === "file" ? node.size ?? 0 : 0),
    0,
  );
}
