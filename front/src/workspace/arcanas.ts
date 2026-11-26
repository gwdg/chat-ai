import { useEffect, useSyncExternalStore } from "react";

import {
  ragCollectionDisplayName,
  SaiaRagProvider,
} from "./providers/saiaRag";
import type { RagCollection, RagFile } from "./providers/saiaRag";

/**
 * The Arcanas sidebar section and its manager dialog share one connection and
 * one collection list.
 *
 * Every page mounts its own sidebar, and a second `SaiaRagProvider` would mean
 * a second MCP handshake per page change. The module-level provider keeps the
 * session, and the module-level state keeps the list, so a remounted sidebar
 * paints the rows it already had instead of flashing an empty list (the same
 * problem `Sidebar/sidebarScroll.ts` solves for the scroll offset).
 *
 * The list is read through `useSyncExternalStore`, so the sidebar and an open
 * manager update together after a create, delete or upload.
 */

const SOURCE_ID = "arcanas-sidebar";

/**
 * How much of a collection is searchable.
 *
 * `stored` files are uploaded but not indexed yet, and a failed file is not
 * indexed either, so every non-`indexed` status counts as pending. The sidebar
 * paints this as one dot, which is why it has to be a single word rather than a
 * pair of counts.
 */
export type ArcanaIndexStatus = "current" | "pending" | "partial";

export type ArcanasState = {
  collections: RagCollection[];
  /** Keyed by the collection's storage name (`collection.collection`). */
  statuses: Record<string, ArcanaIndexStatus>;
  loading: boolean;
  /** At least one listing has completed; a remount does not refetch. */
  loaded: boolean;
  error: string | null;
};

/**
 * Did this file go through the index?
 *
 * The service stores the splitter's own wording in `status` ("Success",
 * "Success,2 errors", "File doesn't contain relevant data"), not the single
 * word `indexed`; an empty status is read as `indexed` by `list_files`. Only
 * `stored` means "not indexed yet", and a failure means the attempt is over
 * without a usable index.
 */
export function isArcanaIndexed(status: string): boolean {
  return status !== "stored" && !/fail|error/i.test(status);
}

/**
 * Classify a collection from its file rows.
 *
 * No files is `current`: there is nothing waiting to be indexed. All indexed is
 * `current`, nothing indexed is `pending`, anything in between is `partial`.
 */
export function classifyArcanaFiles(files: RagFile[]): ArcanaIndexStatus {
  if (files.length === 0) return "current";
  const indexed = files.filter((file) => isArcanaIndexed(file.status)).length;
  if (indexed === files.length) return "current";
  return indexed === 0 ? "pending" : "partial";
}

let provider: SaiaRagProvider | null = null;

/** The one provider the Arcanas UI uses. */
export function arcanasProvider(): SaiaRagProvider {
  if (!provider) provider = new SaiaRagProvider(SOURCE_ID);
  return provider;
}

let state: ArcanasState = {
  collections: [],
  statuses: {},
  loading: false,
  loaded: false,
  error: null,
};

const listeners = new Set<() => void>();

const setState = (patch: Partial<ArcanasState>) => {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => state;

let inflight: Promise<RagCollection[]> | null = null;
let statusGeneration = 0;

/**
 * Read every collection's file list to classify its index.
 *
 * The rows paint first and the dots fill in afterwards: one `list_files` call
 * per collection is not worth delaying the sidebar. A newer pass invalidates an
 * older one, so a slow answer cannot overwrite the current state.
 */
function loadStatuses(collections: RagCollection[]): void {
  const generation = ++statusGeneration;
  void Promise.all(
    collections.map(async (collection) => {
      try {
        const files = await arcanasProvider().listFiles(
          ragCollectionDisplayName(collection),
          { includeTags: false },
        );
        return [collection.collection, classifyArcanaFiles(files)] as const;
      } catch {
        return null;
      }
    }),
  ).then((rows) => {
    if (generation !== statusGeneration) return;
    const statuses: Record<string, ArcanaIndexStatus> = {};
    for (const row of rows) {
      if (row) statuses[row[0]] = row[1];
    }
    setState({ statuses });
  });
}

/** Re-read the index state of the collections already listed. */
export function refreshArcanaStatuses(): void {
  if (state.collections.length) loadStatuses(state.collections);
}

/** Record one collection's state without re-reading the others. */
export function updateArcanaStatus(
  collection: string,
  status: ArcanaIndexStatus,
): void {
  if (state.statuses[collection] === status) return;
  setState({ statuses: { ...state.statuses, [collection]: status } });
}

/**
 * Read the collection list. Concurrent callers share one request, and a
 * failure keeps the rows that were already known: a service that blinks must
 * not empty the section.
 */
export function refreshArcanas(): Promise<RagCollection[]> {
  if (inflight) return inflight;
  setState({ loading: true, error: null });
  inflight = (async () => {
    try {
      const collections = await arcanasProvider().listCollections();
      setState({ collections, loaded: true, loading: false, error: null });
      loadStatuses(collections);
      return collections;
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
      // The cached rows stay; only an error banner is added.
      return state.collections;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Force the next `useArcanas` to load again (after a service came back). */
export function retryArcanas(): void {
  inflight = null;
  setState({ loaded: false });
  void refreshArcanas();
}

export function useArcanas(): ArcanasState {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (!current.loaded && !inflight) void refreshArcanas();
  }, [current.loaded]);
  return current;
}

/** The path segment a collection is addressed by in this UI. */
export const arcanaDisplayName = ragCollectionDisplayName;
