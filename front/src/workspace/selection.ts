import type { WorkspaceFileEntry } from "../db/dbTypes";

/**
 * A drag or a row action on an entry that belongs to the current multi-select
 * carries the whole selection; an entry outside it acts on itself.
 *
 * Paths are only unique inside a source, so the source id is part of the
 * comparison.
 */
export function entriesForAction(
  entry: WorkspaceFileEntry,
  selected: WorkspaceFileEntry[],
): WorkspaceFileEntry[] {
  if (selected.length === 0) return [entry];
  const isSelected = selected.some(
    (candidate) =>
      candidate.path === entry.path && candidate.sourceId === entry.sourceId,
  );
  return isSelected ? selected : [entry];
}
