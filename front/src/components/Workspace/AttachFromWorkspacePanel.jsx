import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Document,
  Folder,
} from "@carbon/icons-react";

import { useAttachments } from "../../hooks/useAttachments";
import { useToast } from "../../hooks/useToast";
import {
  addFileReference,
  useWorkspace,
  useWorkspaceMounts,
  useWorkspaceSources,
} from "../../db/workspaceDb";
import { getSourceNode } from "../../db/workspaceVfs";
import { useWorkspaceProviders } from "../../workspace/useWorkspaceProviders";
import {
  createWorkspaceRootProvider,
  workspaceRootSourceId,
} from "../../workspace/workspaceRoot";
import { joinPath, normalizePath } from "../../workspace/paths";

const readAll = async (stream) => {
  const reader = stream.getReader();
  const chunks = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      length += value.length;
    }
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data;
};

const entryKey = (entry) =>
  entry.mount
    ? `mount:${entry.mount.id}`
    : `${entry.sourceId}:${entry.path}`;

function TreeRow({ entry, depth, loadChildren, onAttach, attaching }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isDir = entry.kind === "dir";

  const toggle = async () => {
    if (!isDir) {
      void onAttach(entry);
      return;
    }
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (children !== null) return;
    setLoading(true);
    setError("");
    try {
      setChildren(await loadChildren(entry));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={!isDir && attaching}
        title={entry.name}
        className="flex w-full items-center gap-1 rounded-md py-0.5 pr-1 text-left text-[11px] text-base-content hover:bg-base-200 disabled:opacity-60"
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        {isDir ? (
          open ? (
            <ChevronDown size={12} className="shrink-0 text-base-content/50" />
          ) : (
            <ChevronRight size={12} className="shrink-0 text-base-content/50" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {isDir ? (
          <Folder size={13} className="shrink-0 text-accent" />
        ) : (
          <Document size={13} className="shrink-0 text-base-content/50" />
        )}
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      </button>
      {isDir && open && (
        <div>
          {loading && (
            <div
              className="py-0.5 text-[10px] text-base-content/40"
              style={{ paddingLeft: 18 + depth * 12 }}
            >
              …
            </div>
          )}
          {!loading && error && (
            <div
              className="py-0.5 text-[10px] text-error"
              style={{ paddingLeft: 18 + depth * 12 }}
            >
              {error}
            </div>
          )}
          {!loading &&
            children?.map((child) => (
              <TreeRow
                key={entryKey(child)}
                entry={child}
                depth={depth + 1}
                loadChildren={loadChildren}
                onAttach={onAttach}
                attaching={attaching}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceAttachmentSection({
  workspaceId,
  localState,
  setLocalState,
  onClose,
}) {
  const { t } = useTranslation();
  const workspace = useWorkspace(workspaceId);
  const sources = useWorkspaceSources(workspaceId);
  const mounts = useWorkspaceMounts(workspaceId);
  const { providers } = useWorkspaceProviders(sources);
  const rootProvider = useMemo(
    () => createWorkspaceRootProvider(workspaceId),
    [workspaceId],
  );
  const { addAttachments } = useAttachments();
  const { notifyError } = useToast();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [attaching, setAttaching] = useState(false);

  const listProvider = useCallback(async (provider, path) => {
    if (provider.status !== "connected") await provider.connect();
    const page = await provider.list(path);
    return page.entries.map((entry) => ({ ...entry, provider }));
  }, []);

  const listRoot = useCallback(
    async (path) => {
      const local = await listProvider(rootProvider, path);
      const prefix = path === "/" ? "/" : `${path}/`;
      const virtual = new Map();
      for (const mount of mounts) {
        const mountPath = normalizePath(mount.path);
        if (mountPath === path || !mountPath.startsWith(prefix)) continue;
        const rest = mountPath.slice(prefix.length);
        const first = rest.split("/")[0];
        if (!first || local.some((entry) => entry.name === first)) continue;
        if (virtual.has(first)) continue;
        const entryPath = joinPath(path, first);
        const isMountRoot = mountPath === entryPath;
        virtual.set(first, {
          sourceId: isMountRoot
            ? mount.sourceId
            : workspaceRootSourceId(workspaceId),
          path: isMountRoot ? mount.sourcePath : entryPath,
          name: first,
          kind: "dir",
          mount: isMountRoot ? mount : undefined,
          provider: isMountRoot ? providers.get(mount.sourceId) : undefined,
        });
      }
      return [...local, ...virtual.values()];
    },
    [listProvider, rootProvider, mounts, providers, workspaceId],
  );

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError("");
    void listRoot("/")
      .then((next) => {
        if (!cancelled) setEntries(next);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listRoot]);

  const loadChildren = useCallback(
    (entry) => {
      if (entry.provider) {
        return listProvider(
          entry.provider,
          entry.mount ? entry.mount.sourcePath : entry.path,
        );
      }
      return listRoot(entry.path);
    },
    [listProvider, listRoot],
  );

  const handleAttach = async (entry) => {
    if (!entry.provider || attaching) return;
    setAttaching(true);
    try {
      if (entry.provider.status !== "connected") await entry.provider.connect();
      const bytes = await readAll(await entry.provider.read(entry.path));
      const file = new File([bytes], entry.name, {
        type: entry.mime || "",
      });
      await addAttachments({
        localState,
        setLocalState,
        selectedFiles: [file],
      });
      const node = await getSourceNode(entry.sourceId, entry.path);
      if (node && localState.id) {
        await addFileReference({
          conversationId: localState.id,
          workspaceId,
          sourceId: entry.sourceId,
          nodeId: node.id,
          name: entry.name,
          path: entry.path,
        });
      }
      onClose?.();
    } catch (reason) {
      notifyError(
        reason instanceof Error ? reason.message : String(reason),
      );
    } finally {
      setAttaching(false);
    }
  };

  if (!workspace) return null;

  return (
    <section className="space-y-1" aria-label={workspace.name}>
      <p className="flex items-center gap-1 text-xs font-medium text-base-content">
        <Folder size={13} className="text-accent" />
        <span className="truncate">{workspace.name}</span>
      </p>
      {error ? (
        <p className="px-1 text-[11px] text-error">{error}</p>
      ) : entries === null ? (
        <p className="px-1 text-[11px] text-base-content/50">
          {t("workspace.attach_from_workspace_loading")}
        </p>
      ) : entries.length === 0 ? (
        <p className="px-1 text-[11px] text-base-content/50">
          {t("workspace.empty_folder")}
        </p>
      ) : (
        <WorkspaceTree
          entries={entries}
          loadChildren={loadChildren}
          onAttach={handleAttach}
          attaching={attaching}
        />
      )}
    </section>
  );
}

function WorkspaceTree({ entries, ...props }) {
  return (
    <div className="flex flex-col gap-0.5">
      {entries.map((entry) => (
        <TreeRow key={entryKey(entry)} entry={entry} depth={0} {...props} />
      ))}
    </div>
  );
}

export default function AttachFromWorkspacePanel({
  workspaceIds,
  localState,
  setLocalState,
  onClose,
}) {
  const { t } = useTranslation();

  return (
    <div className="w-full space-y-3">
      <div>
        <p className="text-sm font-medium">
          {t("workspace.attach_from_workspace")}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-base-content/60">
          {t("workspace.attach_from_workspace_hint")}
        </p>
      </div>
      {workspaceIds.map((workspaceId) => (
        <WorkspaceAttachmentSection
          key={workspaceId}
          workspaceId={workspaceId}
          localState={localState}
          setLocalState={setLocalState}
          onClose={onClose}
        />
      ))}
    </div>
  );
}
