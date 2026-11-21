import { db, newId } from "./index";
import type { WorkspaceNodeRow } from "./dbTypes";
import { collapseDuplicateWorkspaceNodes } from "./workspaceTreeDedupe";
import { baseName, joinPath, normalizePath, parentPath } from "../workspace/paths";

const sortNodes = (a: WorkspaceNodeRow, b: WorkspaceNodeRow) =>
  Number(b.kind === "dir") - Number(a.kind === "dir") ||
  a.name.localeCompare(b.name);

const compareIds = (a: WorkspaceNodeRow, b: WorkspaceNodeRow) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * One row per path. A synced tree used to be written under a derived id next to
 * the row that was already there, and the duplicate is only removed by
 * `collapseDuplicateNodes`. Reading must not depend on that cleanup having run:
 * a listing would otherwise show the same file twice. The lowest id wins, which
 * is what `getSourceNode` (and therefore every write) picks.
 */
const dedupeByPath = (rows: WorkspaceNodeRow[]): WorkspaceNodeRow[] => {
  const seen = new Set<string>();
  const unique: WorkspaceNodeRow[] = [];
  for (const row of rows.slice().sort(compareIds)) {
    if (seen.has(row.path)) continue;
    seen.add(row.path);
    unique.push(row);
  }
  return unique;
};

export async function listSourceNodes(
  sourceId: string,
  path: string,
): Promise<WorkspaceNodeRow[]> {
  const parent = normalizePath(path);
  const rows = await db.workspace_nodes
    .where("[sourceId+parentPath]")
    .equals([sourceId, parent])
    .toArray();
  return dedupeByPath(rows).sort(sortNodes);
}

export async function getSourceNode(
  sourceId: string,
  path: string,
): Promise<WorkspaceNodeRow | undefined> {
  const normalized = normalizePath(path);
  if (normalized === "/") return undefined;
  const rows = await db.workspace_nodes
    .where("[sourceId+path]")
    .equals([sourceId, normalized])
    .toArray();
  return rows.sort(compareIds)[0];
}

/**
 * Removes the duplicate rows and blobs of one source and points file references
 * at the row that stays. Returns how many rows went away.
 */
export async function collapseDuplicateNodes(
  sourceId: string,
  prefer?: Iterable<string>,
): Promise<number> {
  return db.transaction(
    "rw",
    [db.workspace_nodes, db.workspace_blobs, db.workspace_file_references],
    () =>
      collapseDuplicateWorkspaceNodes(
        {
          nodes: db.workspace_nodes,
          blobs: db.workspace_blobs,
          refs: db.workspace_file_references,
        },
        { sourceId, prefer },
      ),
  );
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
  // Emptiness is about children, not about duplicate rows of the path itself:
  // a second row for the same file must not read as "Directory is not empty".
  const hasChildren = nodes.some((item) =>
    item.path.startsWith(`${normalized}/`),
  );
  if (!recursive && hasChildren) {
    throw new Error("Directory is not empty");
  }
  const affected = nodes.filter(
    (item) =>
      item.path === normalized ||
      (recursive && item.path.startsWith(`${normalized}/`)),
  );
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
  const rows = await db.workspace_nodes
    .where("sourceId")
    .equals(sourceId)
    .toArray();
  return dedupeByPath(rows).reduce(
    (sum, node) => sum + (node.kind === "file" ? node.size ?? 0 : 0),
    0,
  );
}
