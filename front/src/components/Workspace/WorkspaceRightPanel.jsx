import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { loadFile } from "../../db";
import { useFilePreview } from "../../context/FilePreviewContext";
import { useConversationFilePreview } from "../../hooks/useConversationFilePreview";
import { useToast } from "../../hooks/useToast";
import { downloadBlob } from "../../utils/download";
import MetaChangesPanel from "../Meta/MetaChangesPanel";
import { useWorkspaceList } from "../../db/workspaceDb";
import WorkspacePreviewTab from "./WorkspacePreviewTab";
import WorkspaceStorageTree from "./WorkspaceStorageTree";

const sectionHeading =
  "mb-1 truncate px-1 text-[10px] font-semibold uppercase tracking-wider text-base-content/45";

/**
 * The workspace's right-hand column: What's new, Files, Preview.
 *
 * A workspace page and a chat attached to that workspace render this same
 * component, so the column is identical in both places. A chat may belong to
 * more than one workspace; then each workspace gets its own tree and agent
 * panel under a heading with its name.
 */
function WorkspaceFilesTab({ workspaceIds, names, onPreview }) {
  if (workspaceIds.length === 1) {
    return (
      <WorkspaceStorageTree
        workspaceId={workspaceIds[0]}
        className="min-h-0 min-w-0 flex-1"
        showTitle={false}
        onPreview={onPreview}
      />
    );
  }
  // Several workspaces share this tab, so each tree gets its name as a grey uppercase heading and
  // a hairline above it — the only thing that tells the sections apart.
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      {workspaceIds.map((workspaceId, index) => (
        <section key={workspaceId} className="min-w-0">
          {index > 0 && <div className="mb-2 h-px bg-base-300" />}
          <h3 className={sectionHeading} data-testid="files-workspace-heading">
            {names.get(workspaceId) ?? ""}
          </h3>
          <WorkspaceStorageTree
            workspaceId={workspaceId}
            className="min-h-0 min-w-0"
            showTitle={false}
            onPreview={onPreview}
          />
        </section>
      ))}
    </div>
  );
}

// Below md the panel is hidden by CSS, so it must not claim the preview — the
// docked chat preview keeps working on narrow screens exactly as before.
const useWidePanel = () => {
  const [wide, setWide] = useState(
    () =>
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);
  return wide;
};

/**
 * The Preview tab: one place that shows whatever file was clicked last, whether it
 * came from the Files tree (already read) or from a chat attachment (a stored file
 * id the tab resolves itself).
 */
export function WorkspacePreviewPane({ request, onClose, onBack }) {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const isChatFile = Boolean(request?.fileId);
  const chatPreview = useConversationFilePreview(
    request?.fileId,
    request?.name,
  );

  if (!request) {
    return null;
  }

  const preview = isChatFile
    ? { ...chatPreview, loading: !chatPreview.loaded }
    : request;

  const download = async (entry) => {
    if (!isChatFile) {
      if (preview.url) {
        const link = document.createElement("a");
        link.href = preview.url;
        link.download = entry.name;
        link.click();
        return;
      }
      if (typeof preview.text === "string") {
        downloadBlob(
          new Blob([preview.text], {
            type: entry.mime || "text/plain;charset=utf-8",
          }),
          entry.name,
        );
      }
      return;
    }
    try {
      const complete = await loadFile(request.fileId);
      if (!complete) {
        notifyError(t("file_preview.save_failed"));
        return;
      }
      downloadBlob(complete, complete.name || entry.name);
    } catch (reason) {
      console.error("Download failed:", reason);
      notifyError(t("file_preview.save_failed"));
    }
  };

  return (
    <WorkspacePreviewTab
      key={request.key ?? request.fileId ?? chatPreview.entry?.name}
      preview={preview}
      onClose={onClose}
      onBack={onBack}
      onDownload={download}
      showPdfHint={isChatFile}
      resetKey={request.key ?? request.fileId ?? chatPreview.entry.name}
    />
  );
}

export default function WorkspaceRightPanel({
  workspaceIds,
  userSettings,
  scope,
  scopeKey,
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    preview: filePreview,
    openFilePreview,
    closeFilePreview,
    registerPreviewHost,
  } = useFilePreview();
  const wide = useWidePanel();
  // Entering a workspace, or one of its chats, lands on the Files tab: that is what
  // the workspace is for. What's New stays one click away in the strip.
  const [activeTab, setActiveTab] = useState("files");
  // The tab a file was opened from, so the chevron can put the user back there.
  const [originTab, setOriginTab] = useState("files");
  // A click in the sidebar asks for the panel, not just the files: the intent rides
  // on the router state of the selection that brought the user here.
  const openOnArrive = Boolean(location.state?.openWorkspacePanel);
  const [expandSignal, setExpandSignal] = useState(openOnArrive ? 1 : 0);
  const arrivalRef = useRef(location.key);
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  const workspaces = useWorkspaceList() ?? [];

  // Moving to another chat keeps this component mounted, so a later arrival has to put
  // the panel back on Files and unfold it on its own; the mount above already did.
  useEffect(() => {
    if (arrivalRef.current === location.key || !openOnArrive) return;
    arrivalRef.current = location.key;
    setActiveTab("files");
    setOriginTab("files");
    setExpandSignal((value) => value + 1);
  }, [location.key, openOnArrive]);

  // The intent is spent on the arrival it rode in with: a reload or a Back must not
  // unfold the panel again over a rail the user folded themselves.
  useEffect(() => {
    if (!openOnArrive) return;
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: { ...(location.state ?? {}), openWorkspacePanel: false },
    });
  }, [location.key, openOnArrive, navigate]);

  const ids = useMemo(
    () => [...new Set((workspaceIds ?? []).filter(Boolean))],
    [workspaceIds],
  );
  const names = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace.name])),
    [workspaces],
  );

  // Newest click wins: switch to the Preview tab whenever a file arrives.
  useEffect(() => {
    if (!filePreview?.key) return;
    const previous = activeTabRef.current;
    if (previous && previous !== "preview") setOriginTab(previous);
    setActiveTab("preview");
  }, [filePreview?.key]);

  // Back only leaves the Preview tab — the file stays open so the tab is still there to return to.
  const backToOrigin = useCallback(() => {
    setActiveTab(originTab);
  }, [originTab]);

  // The X closes the file itself, which is what removes the tab.
  const closePreview = useCallback(() => {
    closeFilePreview();
    setActiveTab(originTab);
  }, [closeFilePreview, originTab]);

  // Without a file there is no Preview tab, so nothing may stay selected on it.
  useEffect(() => {
    if (!filePreview && activeTab === "preview") setActiveTab(originTab);
  }, [filePreview, activeTab, originTab]);

  // The panel only hosts the preview while it is actually on screen.
  useLayoutEffect(() => {
    if (!ids.length || !wide) return undefined;
    return registerPreviewHost();
  }, [ids.length, wide, registerPreviewHost]);

  const tabs = useMemo(() => {
    const list = [
      {
        id: "files",
        label: t("workspace.files_tab"),
        content: (
          <WorkspaceFilesTab
            workspaceIds={ids}
            names={names}
            onPreview={openFilePreview}
          />
        ),
        contentClassName: ids.length === 1 ? "flex flex-col" : undefined,
      },
    ];
    // The tab only exists while there is a file in it.
    if (filePreview) {
      list.push({
        id: "preview",
        label: t("workspace.preview_tab"),
        content: (
          <WorkspacePreviewPane
            request={filePreview}
            onClose={closePreview}
            onBack={backToOrigin}
          />
        ),
        contentClassName: "flex flex-col",
      });
    }
    return list;
  }, [
    ids,
    names,
    t,
    openFilePreview,
    filePreview,
    backToOrigin,
    closePreview,
  ]);

  if (!ids.length) return null;

  return (
    <MetaChangesPanel
      userSettings={userSettings}
      scope={scope}
      scopeKey={scopeKey}
      tabs={tabs}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      revealSignal={filePreview?.key ?? 0}
      expandSignal={expandSignal}
    />
  );
}
