import { useEffect, useSyncExternalStore } from "react";

import {
  ragCollectionDisplayName,
  SaiaRagProvider,
} from "./providers/saiaRag";
import type { RagCollection } from "./providers/saiaRag";

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

export type ArcanasState = {
  collections: RagCollection[];
  loading: boolean;
  /** At least one listing has completed; a remount does not refetch. */
  loaded: boolean;
  error: string | null;
};

let provider: SaiaRagProvider | null = null;

/** The one provider the Arcanas UI uses. */
export function arcanasProvider(): SaiaRagProvider {
  if (!provider) provider = new SaiaRagProvider(SOURCE_ID);
  return provider;
}

let state: ArcanasState = {
  collections: [],
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
