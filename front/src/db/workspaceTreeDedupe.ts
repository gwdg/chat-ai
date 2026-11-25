import type { Table } from "dexie";
import type {
  WorkspaceBlobRow,
  WorkspaceFileReferenceRow,
  WorkspaceNodeRow,
} from "./dbTypes";

/**
 * The three tables that describe a workspace tree. Both the Dexie upgrade
 * transaction and the live VFS pass them in, so the collapse logic exists once.
 */
export type WorkspaceTreeTables = {
  nodes: Table<WorkspaceNodeRow, string>;
  blobs: Table<WorkspaceBlobRow, string>;
  refs: Table<WorkspaceFileReferenceRow, string>;
};

const compareIds = (a: WorkspaceNodeRow, b: WorkspaceNodeRow) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Keeps one row per `sourceId` + `path` and removes the rest.
 *
 * A synced workspace used to write its tree under a derived id instead of
 * reusing the row already at that path, so the same file was listed twice. New
 * duplicates are prevented in `applyWorkspaceBundle`; this repairs the rows a
 * database already holds, and it is the backstop for any other stray pair.
 *
 * The keeper is, in order: a row that still holds bytes (so a file never loses
 * its content), a row the caller just wrote (`prefer`), a file over a directory,
 * then the lowest id — which is the row `getSourceNode` reads, so a listing and
 * a lookup keep naming the same entry. Every deleted row's blob goes with it,
 * and a chat attachment that pointed at a deleted row is repointed at the keeper
 * instead of becoming unreadable.
 *
 * Returns the number of rows it removed.
 */
export async function collapseDuplicateWorkspaceNodes(
  tables: WorkspaceTreeTables,
  options: { sourceId?: string; prefer?: Iterable<string> } = {},
): Promise<number> {
  const { nodes: nodesTable, blobs: blobsTable, refs: refsTable } = tables;
  const rows: WorkspaceNodeRow[] = options.sourceId
    ? await nodesTable.where("sourceId").equals(options.sourceId).toArray()
    : await nodesTable.toArray();

  const groups = new Map<string, WorkspaceNodeRow[]>();
  for (const row of rows) {
    if (!row?.path) continue;
    // A path is only unique inside one source; two sources can mount the same
    // path and must keep their own rows.
    const key = `${row.sourceId}\u0000${row.path}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const duplicates = Array.from(groups.values()).filter(
    (group) => group.length > 1,
  );
  if (!duplicates.length) return 0;

  const ids = duplicates.reduce<string[]>((all, group) => {
    for (const row of group) all.push(row.id);
    return all;
  }, []);
  const blobs = await blobsTable.bulkGet(ids);
  const withBlob = new Set<string>();
  blobs.forEach((blob, index) => {
    if (blob) withBlob.add(ids[index]);
  });
  const prefer = new Set(options.prefer ?? []);

  const compareKeepers = (a: WorkspaceNodeRow, b: WorkspaceNodeRow) => {
    const blob = Number(withBlob.has(b.id)) - Number(withBlob.has(a.id));
    if (blob) return blob;
    const preferred = Number(prefer.has(b.id)) - Number(prefer.has(a.id));
    if (preferred) return preferred;
    const kind = Number(b.kind === "file") - Number(a.kind === "file");
    if (kind) return kind;
    return compareIds(a, b);
  };

  let removed = 0;
  for (const group of duplicates) {
    group.sort(compareKeepers);
    const keeper = group[0];
    const extraIds = group.slice(1).map((row) => row.id);
    await nodesTable.bulkDelete(extraIds);
    await blobsTable.bulkDelete(extraIds);
    const references = await refsTable.where("nodeId").anyOf(extraIds).toArray();
    for (const reference of references) {
      await refsTable.update(reference.id, {
        nodeId: keeper.id,
        sourceId: keeper.sourceId,
      });
    }
    removed += extraIds.length;
  }
  return removed;
}
