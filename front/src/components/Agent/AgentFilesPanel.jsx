import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import WorkspaceRootBrowser from "../Workspace/WorkspaceRootBrowser";
import {
  listOpencodeFiles,
  writeOpencodeFile,
} from "../../apis/opencodeAgents";
import { useToast } from "../../hooks/useToast";

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
const POLL_INTERVAL = 5000;

export default function AgentFilesPanel({ agent, onOpenFile }) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
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

  const onOpen = (entry) => {
    if (entry.kind === "dir") {
      navigate(entry.path);
      return;
    }
    onOpenFile?.(entry);
  };

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
        parentOf={(current) =>
          current.includes("/")
            ? current.slice(0, current.lastIndexOf("/"))
            : ""
        }
        newFileEditor={newFileEditor}
        dataGuide="workspace-files"
      />
    </div>
  );
}
