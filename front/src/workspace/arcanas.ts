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
 * The service's own explanation for a failed file, or null.
 *
 * `list_files` stores the reason in `status` ("Failed: conversion: …"), so the
 * badge can stay short while the row shows why the attempt failed. The prefix
 * is dropped because the badge already says "Failed"; the rest is the service's
 * wording and is not translated.
 */
export function arcanaFailureReason(status: string): string | null {
  if (!status || status === "stored" || isArcanaIndexed(status)) return null;
  return status.replace(/^failed:\s*/i, "").trim() || status;
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
 * Bumped when a caller abandons an in-flight read.
 *
 * A read can only be dropped while it is still running, so the number it was
 * started with is what tells its answer apart from the current state.
 */
let listGeneration = 0;

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
 *
 * `fresh` starts a new read even while one is running and drops that older
 * answer. Every write (public read, description) uses it: a list read that
 * started before the write carries the value the write replaced, so adopting
 * it would paint the old flag — and the old chat link — back.
 */
export function refreshArcanas({
  fresh = false,
}: { fresh?: boolean } = {}): Promise<RagCollection[]> {
  if (fresh) {
    listGeneration += 1;
    inflight = null;
  }
  if (inflight) return inflight;
  const generation = listGeneration;
  setState({ loading: true, error: null });
  const request = (async () => {
    try {
      const provider = arcanasProvider();
      // An explicit read (after a create, or the retry button) must not be
      // answered from the provider's short cache.
      provider.invalidateCollections();
      const collections = await provider.listCollections();
      // An older read answered after this one replaced it: its list is the one
      // the write (or the newer read) already superseded.
      if (generation !== listGeneration) return state.collections;
      setState({ collections, loaded: true, loading: false, error: null });
      loadStatuses(collections);
      return collections;
    } catch (error) {
      if (generation !== listGeneration) return state.collections;
      setState({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
      // The cached rows stay; only an error banner is added.
      return state.collections;
    } finally {
      if (inflight === request) inflight = null;
    }
  })();
  inflight = request;
  return request;
}

/** Force the next `useArcanas` to load again (after a service came back). */
export function retryArcanas(): void {
  setState({ loaded: false });
  void refreshArcanas({ fresh: true });
}

/**
 * Read the collection list.
 *
 * `enabled` gates the automatic first read: the sidebar passes false until the
 * health probe confirms the service, so a deployment without saia-rag does not
 * fire a request that can only fail. The state itself stays shared, so a list
 * that was read on another page is still returned.
 */
export function useArcanas(enabled = true): ArcanasState {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (enabled && !current.loaded && !inflight) void refreshArcanas();
  }, [current.loaded, enabled]);
  return current;
}

/** The path segment a collection is addressed by in this UI. */
export const arcanaDisplayName = ragCollectionDisplayName;

/**
 * Announced after the Arcana chat changed a collection.
 *
 * The chat talks to the service directly, so the page cannot see the write
 * itself; the manager reloads on this event instead of the two components
 * sharing their row state.
 */
export const ARCANA_FILES_CHANGED_EVENT = "chatai:arcana-files-changed";

/**
 * The page that opens a collection.
 *
 * The route carries the reference (`owner/name`, `/` percent-encoded), because
 * a plain name is ambiguous between two people's collections.
 */
export function arcanaPagePath(
  collection: RagCollection,
  options: { tab?: "files" | "search" | "share"; upload?: boolean } = {},
): string {
  const params = new URLSearchParams();
  if (options.upload) params.set("upload", "1");
  if (options.tab && options.tab !== "files") params.set("tab", options.tab);
  const query = params.toString();
  return `/arcana/${encodeURIComponent(collection.collection)}${
    query ? `?${query}` : ""
  }`;
}
