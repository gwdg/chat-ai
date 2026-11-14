import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkspaceSourceRow } from "../db/dbTypes";
import { updateSource } from "../db/workspaceDb";
import { createProvider } from "./providers";
import type { FileProvider } from "./providers/types";
import { WorkspaceError } from "./providers/types";

const signature = (source: WorkspaceSourceRow) =>
  `${source.id}|${source.kind}|${source.readOnly === true ? "ro" : "rw"}|${JSON.stringify(source.config ?? {})}`;

export function useWorkspaceProviders(sources: WorkspaceSourceRow[]) {
  const providersRef = useRef<Map<string, FileProvider>>(new Map());
  const signaturesRef = useRef<Map<string, string>>(new Map());
  const [providers, setProviders] = useState<Map<string, FileProvider>>(new Map());
  const connectingRef = useRef<Set<string>>(new Set());

  const publish = useCallback(() => {
    setProviders(new Map(providersRef.current));
  }, []);

  const connect = useCallback(
    async (source: WorkspaceSourceRow) => {
      if (connectingRef.current.has(source.id)) return;
      connectingRef.current.add(source.id);
      const provider = createProvider(source);
      providersRef.current.set(source.id, provider);
      signaturesRef.current.set(source.id, signature(source));
      publish();
      try {
        await provider.connect();
        await updateSource(source.id, {
          status: "connected",
          capabilities: provider.capabilities,
          error: undefined,
        });
      } catch (error) {
        const code = error instanceof WorkspaceError ? error.code : "PROVIDER_ERROR";
        const status =
          code === "PERMISSION_DENIED"
            ? "needs-permission"
            : code === "AUTH_EXPIRED"
              ? "error"
              : "error";
        await updateSource(source.id, {
          status,
          error: error instanceof Error ? error.message : String(error),
        }).catch(() => {});
      } finally {
        connectingRef.current.delete(source.id);
        publish();
      }
    },
    [publish],
  );

  useEffect(() => {
    const wanted = new Set(sources.map(signature));
    for (const [id, provider] of providersRef.current) {
      const source = sources.find((item) => item.id === id);
      if (!source) {
        provider.close?.();
        providersRef.current.delete(id);
        signaturesRef.current.delete(id);
        continue;
      }
      if (signaturesRef.current.get(id) !== signature(source)) {
        provider.close?.();
        providersRef.current.delete(id);
        signaturesRef.current.delete(id);
      }
    }
    for (const source of sources) {
      if (providersRef.current.has(source.id)) continue;
      if (!wanted.has(signature(source))) continue;
      void connect(source);
    }
    publish();
    return () => {
      // Providers stay alive across source status updates; page unmount closes them.
    };
  }, [sources, connect, publish]);

  useEffect(
    () => () => {
      for (const provider of providersRef.current.values()) provider.close?.();
      providersRef.current.clear();
      signaturesRef.current.clear();
    },
    [],
  );

  const reconnect = useCallback(
    async (sourceId: string) => {
      const provider = providersRef.current.get(sourceId);
      const source = sources.find((item) => item.id === sourceId);
      if (!source) return;
      if (provider && "requestAccess" in provider) {
        try {
          await (provider as unknown as { requestAccess: () => Promise<void> }).requestAccess();
          await updateSource(sourceId, {
            status: "connected",
            capabilities: provider.capabilities,
            error: undefined,
          });
          publish();
          return;
        } catch (error) {
          await updateSource(sourceId, {
            status: "needs-permission",
            error: error instanceof Error ? error.message : String(error),
          }).catch(() => {});
        }
      }
      providersRef.current.delete(sourceId);
      await connect(source);
    },
    [connect, publish, sources],
  );

  return { providers, reconnect };
}
