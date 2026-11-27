import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkspaceSourceRow } from "../db/dbTypes";
import { updateSource } from "../db/workspaceDb";
import { createProvider } from "./providers";
import type { FileProvider } from "./providers/types";
import { WorkspaceError } from "./providers/types";

const signature = (source: WorkspaceSourceRow) =>
  `${source.id}|${source.kind}|${source.readOnly === true ? "ro" : "rw"}|${JSON.stringify(source.config ?? {})}`;

/**
 * One provider per connected source, shared by every hook instance.
 *
 * A workspace dialog mounts the same source in several places at once (the
 * Sources rail, the source browser and the storage tree), and each of those
 * connects it. For saia-rag that connect is a network round trip that lists
 * every collection, so three instances meant three concurrent reads and the
 * click that opened a drive waited for whichever one it happened to join.
 * Sharing the instance means one connect and one provider-side cache for the
 * whole page.
 */
type SharedEntry = {
  key: string;
  sourceId: string;
  signature: string;
  source: WorkspaceSourceRow;
  provider: FileProvider;
  refs: number;
  /** Bumped when `reconnect` swaps the provider, so a late answer is ignored. */
  epoch: number;
  connecting?: Promise<void>;
};

const entries = new Map<string, SharedEntry>();
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of [...listeners]) listener();
};

const statusFor = (error: unknown) => {
  const code = error instanceof WorkspaceError ? error.code : "PROVIDER_ERROR";
  return code === "PERMISSION_DENIED" ? "needs-permission" : "error";
};

const connectEntry = (entry: SharedEntry) => {
  if (entry.connecting) return entry.connecting;
  const epoch = entry.epoch;
  let promise: Promise<void> | undefined;
  promise = (async () => {
    const stillWanted = () =>
      entries.get(entry.key) === entry && entry.epoch === epoch;
    try {
      await entry.provider.connect();
      if (!stillWanted()) return;
      await updateSource(entry.source.id, {
        status: "connected",
        capabilities: entry.provider.capabilities,
        error: undefined,
      });
    } catch (error) {
      if (!stillWanted()) return;
      await updateSource(entry.source.id, {
        status: statusFor(error),
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => {});
    } finally {
      if (entry.connecting === promise) entry.connecting = undefined;
      notify();
    }
  })();
  entry.connecting = promise;
  return promise;
};

const acquire = (source: WorkspaceSourceRow) => {
  const key = signature(source);
  const existing = entries.get(key);
  if (existing) {
    existing.refs += 1;
    return existing;
  }
  const entry: SharedEntry = {
    key,
    sourceId: source.id,
    signature: key,
    source,
    provider: createProvider(source),
    refs: 1,
    epoch: 0,
  };
  entries.set(key, entry);
  notify();
  void connectEntry(entry);
  return entry;
};

const release = (key: string) => {
  const entry = entries.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entries.delete(key);
  entry.provider.close?.();
  notify();
};

const sameProviders = (
  left: Map<string, FileProvider>,
  right: Map<string, FileProvider>,
) => {
  if (left.size !== right.size) return false;
  for (const [id, provider] of left) {
    if (right.get(id) !== provider) return false;
  }
  return true;
};

export function useWorkspaceProviders(sources: WorkspaceSourceRow[]) {
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const ownedRef = useRef<Set<string>>(new Set());
  const [providers, setProviders] = useState<Map<string, FileProvider>>(
    () => new Map(),
  );

  const publish = useCallback(() => {
    const current = new Map(
      sourcesRef.current.map((source) => [source.id, signature(source)]),
    );
    const next = new Map<string, FileProvider>();
    for (const key of ownedRef.current) {
      const entry = entries.get(key);
      if (!entry) continue;
      // A stale signature is still held by another hook; the fresh key wins.
      const wanted = current.get(entry.sourceId);
      if (wanted && wanted !== entry.signature) continue;
      next.set(entry.sourceId, entry.provider);
    }
    setProviders((previous) => (sameProviders(previous, next) ? previous : next));
  }, []);

  const reconcile = useCallback(() => {
    const wanted = new Map<string, WorkspaceSourceRow>();
    for (const source of sourcesRef.current) {
      wanted.set(signature(source), source);
    }
    for (const key of [...ownedRef.current]) {
      if (wanted.has(key)) continue;
      ownedRef.current.delete(key);
      release(key);
    }
    for (const [key, source] of wanted) {
      if (ownedRef.current.has(key)) continue;
      ownedRef.current.add(key);
      acquire(source);
    }
    publish();
  }, [publish]);

  useEffect(() => {
    listeners.add(publish);
    publish();
    return () => {
      listeners.delete(publish);
    };
  }, [publish]);

  useEffect(() => {
    reconcile();
  }, [sources, reconcile]);

  useEffect(
    () => () => {
      for (const key of ownedRef.current) release(key);
      ownedRef.current.clear();
    },
    [],
  );

  const reconnect = useCallback(
    async (sourceId: string) => {
      const key = [...ownedRef.current].find(
        (candidate) => entries.get(candidate)?.sourceId === sourceId,
      );
      const entry = key ? entries.get(key) : undefined;
      if (!key || !entry) return;
      if ("requestAccess" in entry.provider) {
        try {
          await (
            entry.provider as unknown as {
              requestAccess: () => Promise<void>;
            }
          ).requestAccess();
          await updateSource(sourceId, {
            status: "connected",
            capabilities: entry.provider.capabilities,
            error: undefined,
          });
          notify();
          return;
        } catch (error) {
          await updateSource(sourceId, {
            status: "needs-permission",
            error: error instanceof Error ? error.message : String(error),
          }).catch(() => {});
        }
      }
      // Replace in place so every hook that holds this source sees the new
      // instance, instead of only the one that asked for the reconnect.
      entry.provider.close?.();
      entry.provider = createProvider(entry.source);
      entry.epoch += 1;
      entry.connecting = undefined;
      notify();
      await connectEntry(entry);
    },
    [],
  );

  return { providers, reconnect };
}
