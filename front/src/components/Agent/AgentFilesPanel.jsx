import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GitBranch } from "lucide-react";

import WorkspaceRootBrowser from "../Workspace/WorkspaceRootBrowser";
import {
  findOpencodeFiles,
  listOpencodeFiles,
  readOpencodeFile,
  runOpencodeShellAndWait,
  writeOpencodeFile,
} from "../../apis/opencodeAgents";
import { useToast } from "../../hooks/useToast";
import { formatGitLog, GIT_LOG_MARKER } from "../../utils/gitLog";

const toRootEntry = (sourceId, item) => {
  const path = String(item?.path ?? "").replace(/\/+$/, "");
  const name = path.split("/").filter(Boolean).pop() ?? path;
  return {
    sourceId,
    path,
    name,
    kind: item?.type === "directory" ? "dir" : "file",
    local: false,
  };
};

const joinRelative = (dir, name) => (dir ? `${dir}/${name}` : name);
const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;
const POLL_INTERVAL = 5000;

export default function AgentFilesPanel({
  agent,
  onOpenFile,
  onShowText,
  workspaces = [],
  workspaceId = null,
  workspaceName = "",
  bridgeStatus = "off",
  bridgeError = "",
  bridgeWritable = false,
  bridgeMcp = false,
  onWorkspaceChange,
  onBridgeWritableChange,
  onBridgeMcpChange,
}) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState([]);
  const [gitAvailable, setGitAvailable] = useState(false);
  const [gitLoading, setGitLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const uploadInputRef = useRef(null);
  const requestRef = useRef(0);
  const pollingRef = useRef(false);

  const load = useCallback(
    async (nextPath, { silent = false } = {}) => {
      const requestId = ++requestRef.current;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const rows = await listOpencodeFiles(agent, nextPath);
        if (requestId !== requestRef.current) return;
        setEntries(rows.map((row) => toRootEntry(agent.id, row)));
        if (silent) setError("");
      } catch (reason) {
        if (requestId !== requestRef.current) return;
        if (!silent) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setEntries([]);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [agent],
  );

  useEffect(() => {
    setPath("");
    setCreatingFile(false);
    setNewFileName("");
    void load("");
  }, [agent.id, load]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (
        cancelled ||
        pollingRef.current ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      pollingRef.current = true;
      try {
        await load(path, { silent: true });
      } finally {
        pollingRef.current = false;
      }
    };
    const timer = window.setInterval(poll, POLL_INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [path, load]);

  const breadcrumbs = useMemo(() => {
    const parts = path.split("/").filter(Boolean);
    const items = [];
    let current = "";
    for (const part of parts) {
      current = joinRelative(current, part);
      items.push({ label: part, path: current });
    }
    return items;
  }, [path]);

  const navigate = (nextPath) => {
    setPath(nextPath);
    void load(nextPath);
  };

  const uploadFiles = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setUploading(true);
    let uploaded = 0;
    for (const file of files) {
      try {
        await writeOpencodeFile(
          agent,
          joinRelative(path, file.name),
          file,
          file.type || "application/octet-stream",
        );
        uploaded += 1;
      } catch (reason) {
        notifyError(
          `${file.name}: ${
            reason instanceof Error ? reason.message : String(reason)
          }`,
        );
      }
    }
    if (uploaded > 0) {
      notifySuccess(t("workspace.upload_success", { count: uploaded }));
      await load(path);
    }
    setUploading(false);
  };

  const createFile = async () => {
    const name = newFileName.trim();
    if (!name) return;
    try {
      await writeOpencodeFile(
        agent,
        joinRelative(path, name),
        new Blob([], { type: "text/plain" }),
        "text/plain",
      );
      setCreatingFile(false);
      setNewFileName("");
      await load(path);
    } catch (reason) {
      notifyError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const search = async () => {
    const value = query.trim();
    if (!value) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const rows = await findOpencodeFiles(agent, value, 100);
      setSearchResults(rows.map((row) => toRootEntry(agent.id, row)));
    } catch (reason) {
      notifyError(reason instanceof Error ? reason.message : String(reason));
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setSearchResults(null);
  };

  const onOpen = (entry) => {
    if (entry.kind === "dir") {
      clearSearch();
      navigate(entry.path);
      return;
    }
    onOpenFile?.(entry);
  };

  useEffect(() => {
    let cancelled = false;
    setGitAvailable(false);
    void readOpencodeFile(agent, `${joinRelative(path, ".git")}/HEAD`)
      .then(() => {
        if (!cancelled) setGitAvailable(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [agent, path]);

  const isGitRepo =
    gitAvailable ||
    entries.some((entry) => entry.kind === "dir" && entry.name === ".git");

  const readTextFile = async (filePath) => {
    const { blob } = await readOpencodeFile(agent, filePath);
    return blob.text();
  };

  const showGitLog = async () => {
    const gitPath = joinRelative(path, ".git");
    const previewEntry = {
      sourceId: agent.id,
      path: gitPath,
      name: `${path || agent.name} · ${t("workspace.git_log")}`,
      kind: "file",
      local: false,
    };
    const openGitFile = (filePath) => {
      const relativePath = String(filePath).replace(/^\.\/+/, "");
      onOpenFile?.({
        sourceId: agent.id,
        path: joinRelative(path, relativePath),
        name: relativePath.split("/").filter(Boolean).pop() ?? relativePath,
        kind: "file",
        local: false,
      });
    };
    setGitLoading(true);
    try {
      let text = "";
      try {
        const command = `git --no-pager -C ${shellQuote(path || ".")} log --stat --decorate --date=short --pretty=format:'%n━━━ %h %d ━━━%nDate:   %ad%nAuthor: %an%n%n    %s%n' -n 20 # ${GIT_LOG_MARKER}`;
        text = await runOpencodeShellAndWait(
          agent,
          agent.sessionId,
          command,
          20000,
        );
      } catch {}
      if (!text.trim()) {
        let raw;
        try {
          raw = await readTextFile(`${gitPath}/logs/HEAD`);
        } catch {
          const head = (await readTextFile(`${gitPath}/HEAD`)).trim();
          const branch = head.replace(/^ref:\s*/, "");
          if (!branch) throw new Error(t("workspace.git_log_empty"));
          raw = await readTextFile(`${gitPath}/logs/${branch}`);
        }
        text = formatGitLog(raw);
      }
      onShowText?.(previewEntry, text || t("workspace.git_log_empty"), "", {
        onOpenPath: openGitFile,
      });
    } catch (reason) {
      onShowText?.(
        previewEntry,
        "",
        reason instanceof Error ? reason.message : String(reason),
        { onOpenPath: openGitFile },
      );
    } finally {
      setGitLoading(false);
    }
  };

  const bridgeBadge =
    bridgeStatus === "online"
      ? "badge-success"
      : bridgeStatus === "connecting"
        ? "badge-warning"
        : bridgeStatus === "off"
          ? "badge-ghost"
          : "badge-error";

  const newFileEditor = creatingFile ? (
    <div className="flex items-center gap-1 border-b border-base-300 px-2 py-1.5">
      <input
        autoFocus
        value={newFileName}
        onChange={(event) => setNewFileName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void createFile();
          }
          if (event.key === "Escape") setCreatingFile(false);
        }}
        placeholder={t("workspace.file_name_placeholder")}
        className="input input-xs input-bordered min-w-0 flex-1"
      />
      <button
        type="button"
        className="btn btn-xs btn-accent"
        onClick={() => void createFile()}
        disabled={!newFileName.trim()}
      >
        {t("common.add")}
      </button>
    </div>
  ) : null;

  return (
    <div
      data-guide="agent-files"
      className="hidden w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm md:flex"
    >
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={uploadFiles}
      />
      <div className="space-y-1 border-b border-base-300 p-2">
        <div className="flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wider text-base-content/50">
            {t("agents.bridge.title")}
          </span>
          {workspaceId && (
            <span className={`badge badge-xs ${bridgeBadge}`}>
              {t(`agents.bridge.status_${bridgeStatus}`)}
            </span>
          )}
        </div>
        <select
          value={workspaceId ?? ""}
          onChange={(event) => onWorkspaceChange?.(event.target.value)}
          aria-label={t("agents.bridge.workspace")}
          className="select select-bordered select-xs w-full"
        >
          <option value="">{t("agents.bridge.none")}</option>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
        {workspaceId && (
          <>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={bridgeWritable}
                  onChange={(event) =>
                    onBridgeWritableChange?.(event.target.checked)
                  }
                />
                {t("agents.bridge.writable")}
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={bridgeMcp}
                  onChange={(event) =>
                    onBridgeMcpChange?.(event.target.checked)
                  }
                />
                {t("agents.bridge.mcp")}
              </label>
            </div>
            <p className="text-[10px] leading-snug text-warning">
              {t("agents.bridge.keep_open")}
            </p>
            {workspaceName && (
              <p className="truncate text-[10px] text-base-content/50">
                {workspaceName}
              </p>
            )}
            {bridgeError && (
              <p className="break-words text-[10px] text-error">
                {bridgeError}
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-1 border-b border-base-300 px-2 py-1.5">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!event.target.value.trim()) setSearchResults(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void search();
            }
            if (event.key === "Escape") clearSearch();
          }}
          placeholder={t("agents.search_files")}
          aria-label={t("agents.search_files")}
          className="input input-xs input-bordered min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={searching || !query.trim()}
          className="btn btn-xs btn-ghost"
        >
          {searching ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            t("agents.search")
          )}
        </button>
        {searchResults && (
          <button
            type="button"
            onClick={clearSearch}
            className="btn btn-xs btn-ghost"
          >
            {t("common.close")}
          </button>
        )}
      </div>
      {searchResults ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {searchResults.length === 0 ? (
            <p className="p-2 text-xs text-base-content/60">
              {t("agents.no_search_results")}
            </p>
          ) : (
            <div className="space-y-0.5">
              {searchResults.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  onClick={() => onOpen(entry)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content hover:bg-base-200"
                >
                  <span className="min-w-0 flex-1 truncate">{entry.path}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
      <WorkspaceRootBrowser
        path={path}
        rootPath=""
        breadcrumbs={breadcrumbs}
        entries={entries}
        loading={loading}
        error={error}
        onNavigate={navigate}
        onRetry={() => void load(path)}
        onOpen={onOpen}
        onUpload={() => {
          uploadInputRef.current.value = null;
          uploadInputRef.current.click();
        }}
        uploading={uploading}
        uploadDisabled={uploading}
        onNewFile={() => setCreatingFile((current) => !current)}
        onRefresh={() => void load(path)}
        toolbarInfo={
          isGitRepo ? (
            <button
              type="button"
              onClick={() => void showGitLog()}
              disabled={gitLoading}
              className="btn btn-ghost btn-xs"
              title={t("workspace.git_log")}
              aria-label={t("workspace.git_log")}
            >
              {gitLoading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <GitBranch size={14} />
              )}
              {t("workspace.git_log")}
            </button>
          ) : undefined
        }
        parentOf={(current) =>
          current.includes("/")
            ? current.slice(0, current.lastIndexOf("/"))
            : ""
        }
        newFileEditor={newFileEditor}
        dataGuide="workspace-files"
      />
      )}
    </div>
  );
}
