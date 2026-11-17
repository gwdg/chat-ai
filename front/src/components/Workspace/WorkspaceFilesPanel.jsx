import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useConversationList } from "../../db";
import {
  useWorkspaceList,
  useWorkspaceMounts,
  useWorkspaceSources,
} from "../../db/workspaceDb";
import { chatFolderLabel } from "../../workspace/chatFolderName";
import { listWorkspaceRoot } from "../../workspace/listWorkspaceRoot";
import { createWorkspaceRootProvider } from "../../workspace/workspaceRoot";
import WorkspaceRootTree from "./WorkspaceRootTree";

const noop = () => {};

function WorkspaceFilesSection({ workspaceId, name, showHeading }) {
  const { t } = useTranslation();
  const sources = useWorkspaceSources(workspaceId);
  const mounts = useWorkspaceMounts(workspaceId);
  const conversations = useConversationList();
  const rootProvider = useMemo(
    () => createWorkspaceRootProvider(workspaceId),
    [workspaceId],
  );
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  const listPath = useCallback(
    (path) =>
      listWorkspaceRoot({ rootProvider, workspaceId, mounts, path }),
    [rootProvider, workspaceId, mounts],
  );

  useEffect(() => {
    let cancelled = false;
    setError("");
    void listPath("/")
      .then((next) => {
        if (!cancelled) setEntries(next);
      })
      .catch((reason) => {
        if (cancelled) return;
        setEntries([]);
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [listPath, sources]);

  const displayName = useCallback(
    (entry) => chatFolderLabel(entry.path, { sources, conversations }),
    [sources, conversations],
  );

  // An untouched workspace still gets the display-only `/chats` directory from
  // listWorkspaceRoot; treat that alone as empty so the panel can say so.
  const isEmpty =
    entries !== null &&
    (entries.length === 0 ||
      (entries.length === 1 &&
        entries[0].path === "/chats" &&
        !entries[0].local &&
        !entries[0].mount &&
        mounts.length === 0));

  return (
    <section className="space-y-1" aria-label={name || workspaceId}>
      {showHeading && (
        <h3 className="truncate text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
          {name || workspaceId}
        </h3>
      )}
      {error ? (
        <p className="text-error text-[11px]">{error}</p>
      ) : entries === null ? null : isEmpty ? (
        <p className="text-[11px] text-base-content/50">
          {t("workspace.source_browser.empty")}
        </p>
      ) : (
        <WorkspaceRootTree
          entries={entries}
          loadChildren={listPath}
          onOpen={noop}
          readOnly
          displayName={displayName}
        />
      )}
    </section>
  );
}

export default function WorkspaceFilesPanel({ workspaceIds }) {
  const workspaces = useWorkspaceList();
  const namesById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace.name])),
    [workspaces],
  );
  const ids = workspaceIds ?? [];

  return (
    <div className="w-full space-y-3">
      {ids.map((workspaceId) => (
        <WorkspaceFilesSection
          key={workspaceId}
          workspaceId={workspaceId}
          name={namesById.get(workspaceId)}
          showHeading={ids.length > 1}
        />
      ))}
    </div>
  );
}
