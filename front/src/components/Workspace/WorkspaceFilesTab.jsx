import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Add, TrashCan } from "@carbon/icons-react";

import { useConversationList } from "../../db";
import {
  useWorkspaceChats,
  useWorkspaceMounts,
  useWorkspaceSources,
} from "../../db/workspaceDb";
import { useModal } from "../../modals/ModalContext";
import WorkspaceRootBrowser from "./WorkspaceRootBrowser";
import { chatFolderLabel } from "../../workspace/chatFolderName";
import { listWorkspaceRoot } from "../../workspace/listWorkspaceRoot";
import { joinPath } from "../../workspace/paths";
import { uploadLocalFiles } from "../../workspace/upload";
import {
  createWorkspaceRootProvider,
  emptyStream,
} from "../../workspace/workspaceRoot";

const errorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

export default function WorkspaceFilesTab({ workspaceId }) {
  const { t } = useTranslation();
  const { openModal, confirmAction } = useModal();
  const sources = useWorkspaceSources(workspaceId);
  const mounts = useWorkspaceMounts(workspaceId);
  useWorkspaceChats(workspaceId);
  const conversations = useConversationList() || [];
  const rootProvider = useMemo(
    () => (workspaceId ? createWorkspaceRootProvider(workspaceId) : null),
    [workspaceId],
  );

  const [rootPath, setRootPath] = useState("/");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef(null);
  const rootRequestRef = useRef(0);

  useEffect(() => {
    rootRequestRef.current += 1;
    setRootPath("/");
    setEntries([]);
    setError("");
    setLoading(false);
  }, [workspaceId]);

  const loadRoot = useCallback(async () => {
    const request = ++rootRequestRef.current;
    if (!rootProvider) {
      setEntries([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await listWorkspaceRoot({
        rootProvider,
        workspaceId,
        mounts,
        path: rootPath,
      });
      if (request !== rootRequestRef.current) return;
      setEntries(next);
    } catch (event) {
      if (request !== rootRequestRef.current) return;
      setError(errorMessage(event));
      setEntries([]);
    } finally {
      if (request === rootRequestRef.current) setLoading(false);
    }
  }, [rootProvider, workspaceId, mounts, rootPath]);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot]);

  const entryBadge = (entry) => {
    if (entry.local) return t("workspace.storage_badge_browser");
    const exact = mounts.find((mount) => mount.path === entry.path);
    const mount =
      exact ??
      mounts
        .filter(
          (candidate) =>
            entry.path === candidate.path ||
            entry.path.startsWith(
              `${candidate.path.replace(/\/+$/, "")}/`,
            ),
        )
        .sort((a, b) => b.path.length - a.path.length)[0];
    if (!mount) return undefined;
    const source = sources.find((item) => item.id === mount.sourceId);
    switch (source?.kind) {
      case "local":
        return t("workspace.storage_badge_device");
      case "arcana":
      case "arcana-filesystem":
        return t("workspace.storage_badge_arcana");
      case "mcp":
        return t("workspace.storage_badge_mcp");
      case "agent":
        return t("workspace.storage_badge_agent");
      case "chat":
      case "browser":
        return t("workspace.storage_badge_browser");
      default:
        return undefined;
    }
  };

  const createEntry = (kind) => {
    openModal("workspaceCreateEntry", {
      kind,
      path: rootPath,
      onCreate: async (name) => {
        if (!rootProvider) return;
        await rootProvider.connect();
        const path = joinPath(rootPath, name);
        if (kind === "dir") {
          await rootProvider.mkdir(path);
        } else {
          await rootProvider.write(path, emptyStream(), { overwrite: false });
        }
        await loadRoot();
      },
    });
  };

  const triggerUpload = () => uploadInputRef.current?.click();

  const uploadFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!rootProvider || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      await uploadLocalFiles(rootProvider, rootPath, files, (file, failure) =>
        setError(`${file.name}: ${errorMessage(failure)}`),
      );
      await loadRoot();
    } finally {
      setUploading(false);
    }
  };

  const deleteEntry = async (entry) => {
    if (!rootProvider) return;
    try {
      await rootProvider.connect();
      await rootProvider.remove(entry.path, {
        recursive: entry.kind === "dir",
      });
      await loadRoot();
    } catch (event) {
      setError(errorMessage(event));
    }
  };

  const requestDeleteEntry = (entry) => {
    confirmAction(
      {
        warningKey: "warn_workspace_file_delete",
        messageKey:
          entry.kind === "dir"
            ? "workspace.delete_folder_confirm"
            : "workspace.delete_file_confirm",
        confirmKey: "common.delete",
        danger: true,
      },
      () => void deleteEntry(entry),
    );
  };

  const entryActions = (entry) => {
    if (!entry.local || entry.mount) return null;
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          requestDeleteEntry(entry);
        }}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/40 transition hover:bg-error/10 hover:text-error"
        title={t("common.delete")}
        aria-label={t("common.delete")}
      >
        <TrashCan size={12} />
      </button>
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-x-hidden">
      <div className="flex flex-wrap items-center gap-1 px-1 pb-1">
        <button
          type="button"
          data-guide="workspace-add-source"
          onClick={() => openModal("workspaceAddSource", { workspaceId })}
          className="btn btn-xs"
        >
          <Add size={14} />
          {t("workspace.add_source")}
        </button>
      </div>
      <WorkspaceRootBrowser
        path={rootPath}
        rootPath="/"
        breadcrumbs={[]}
        entries={entries}
        loading={loading}
        error={error}
        onNavigate={setRootPath}
        onRetry={() => void loadRoot()}
        onOpen={(entry) => {
          if (entry.mount) return;
          if (entry.kind === "dir") setRootPath(entry.path);
        }}
        onUpload={triggerUpload}
        uploading={uploading}
        onNewFolder={() => createEntry("dir")}
        onNewFile={() => createEntry("file")}
        onRefresh={() => void loadRoot()}
        displayName={(entry) =>
          chatFolderLabel(entry.path, { sources, conversations })
        }
        entryBadge={entryBadge}
        entryActions={entryActions}
        emptyHint={t("workspace.root_empty_hint")}
      />
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={uploadFiles}
      />
    </div>
  );
}
