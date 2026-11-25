import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { useSelector } from "react-redux";
import { ArrowLeft } from "@carbon/icons-react";

import { useConversationList } from "../db";
import type { ConversationRow } from "../db/dbTypes";
import { useAgents } from "../agents/agentStore";
import {
  syncAgentFilesSources,
  syncChatStorageSources,
  useWorkspace,
  useWorkspaceAgents,
  useWorkspaceChats,
} from "../db/workspaceDb";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { getDefaultConversation } from "../utils/conversationUtils";
import { selectUserSettings } from "../Redux/reducers/userSettingsReducer";

import AnnouncementBar from "../components/Header/AnnouncementBar";
import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import Header from "../components/Header/Header";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import PageKindHeader from "../components/Others/PageKindHeader";
import WorkspaceStorageTree from "../components/Workspace/WorkspaceStorageTree";
import { WorkspacePreviewPane } from "../components/Workspace/WorkspaceRightPanel";
import { isTopicIconId, topicIconById } from "../components/Sidebar/topicIcons";
import { topicColor } from "../components/Sidebar/topicColors";

const SPLIT_STORAGE_KEY = "chatai.workspaceFiles.split";
const DEFAULT_SPLIT = 0.5;
const MIN_SPLIT = 0.2;
const MAX_SPLIT = 0.8;
const SPLIT_KEYBOARD_STEP = 0.04;

function clampSplit(value: number) {
  return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, value));
}

function readStoredSplit() {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    if (raw === null || raw.trim() === "") return DEFAULT_SPLIT;
    const stored = Number(raw);
    if (Number.isFinite(stored)) return clampSplit(stored);
  } catch {
    // Per-viewer convenience only; ignore blocked storage.
  }
  return DEFAULT_SPLIT;
}

function storeSplit(value: number) {
  try {
    localStorage.setItem(SPLIT_STORAGE_KEY, String(value));
  } catch {
    // Per-viewer convenience only; ignore blocked storage.
  }
}

/**
 * The workspace's files as a page of their own: the same tree the workspace
 * page and the Manage Workspace dialog show, with a preview beside it. The
 * split between them defaults to half and is adjustable (drag, arrow keys or
 * double-click to reset), so the whole width is available to whichever side is
 * being read. Every file action (upload, new file, new folder, detach)
 * therefore opens its dialog over a page instead of over a dialog.
 */
export default function WorkspaceFilesPage() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const userSettings = useSelector(selectUserSettings);
  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();

  const workspace = useWorkspace(workspaceId);
  const workspaceChats = useWorkspaceChats(workspaceId);
  const workspaceAgentLinks = useWorkspaceAgents(workspaceId);
  const conversations = useConversationList() ?? [];
  const agents = useAgents();

  const attachedChats = useMemo<ConversationRow[]>(
    () =>
      workspaceChats
        .map((link) =>
          conversations.find(
            (conversation) => conversation.id === link.conversationId,
          ),
        )
        .filter((conversation): conversation is ConversationRow =>
          Boolean(conversation),
        ),
    [workspaceChats, conversations],
  );

  const attachedAgents = useMemo(
    () =>
      workspaceAgentLinks
        .map((link) => agents.find((agent) => agent.id === link.agentId))
        .filter(Boolean),
    [workspaceAgentLinks, agents],
  );

  // A direct URL load sees no workspace row for a frame. Do not flash the
  // "not found" panel during that initial read.
  const [workspaceSettled, setWorkspaceSettled] = useState(false);
  const loadedWorkspaceId = workspace?.id;
  useEffect(() => {
    if (loadedWorkspaceId) {
      setWorkspaceSettled(true);
      return;
    }
    const timeout = setTimeout(() => setWorkspaceSettled(true), 400);
    return () => clearTimeout(timeout);
  }, [loadedWorkspaceId]);

  // The tree reads derived sources, so a direct load has to reconcile them the
  // same way the workspace page does.
  useEffect(() => {
    if (!workspaceId) return;
    void syncAgentFilesSources(workspaceId, agents);
  }, [workspaceId, agents, attachedAgents]);

  useEffect(() => {
    if (!workspaceId) return;
    void syncChatStorageSources(workspaceId, attachedChats);
  }, [workspaceId, attachedChats]);

  const [draftState, setDraftState] = useState(() =>
    getDefaultConversation(userSettings, null),
  );

  useEffect(() => {
    // Switching workspaces restarts the header/sidebar draft with a clean chat.
    setDraftState(getDefaultConversation(userSettings, null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // One file preview at a time. A new read replaces the previous one, so its
  // object URL is released instead of leaking.
  const [preview, setPreview] = useState(null);
  const previewKeyRef = useRef(0);
  const releaseRef = useRef(null);

  const showPreview = useCallback((request) => {
    if (!request) return;
    if (request.loading) {
      previewKeyRef.current += 1;
      releaseRef.current?.();
      releaseRef.current = null;
    } else if (request.release) {
      releaseRef.current?.();
      releaseRef.current = request.release;
    }
    setPreview({ ...request, key: previewKeyRef.current });
  }, []);

  const closePreview = useCallback(() => {
    releaseRef.current?.();
    releaseRef.current = null;
    setPreview(null);
  }, []);

  useEffect(
    () => () => {
      releaseRef.current?.();
      releaseRef.current = null;
    },
    [],
  );

  // The preview sits on the right, so `split` is its share of the wide layout.
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [split, setSplit] = useState(readStoredSplit);
  const splitPercent = Math.round(split * 1000) / 10;

  const commitSplit = useCallback((next: number) => {
    const clamped = clampSplit(next);
    setSplit(clamped);
    storeSplit(clamped);
  }, []);

  const handleSplitPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (!rect.width) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture?.(event.pointerId);
    let latest = split;
    const move = (moveEvent: PointerEvent) => {
      latest = clampSplit(1 - (moveEvent.clientX - rect.left) / rect.width);
      setSplit(latest);
    };
    const finish = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      document.body.style.userSelect = "";
      storeSplit(latest);
    };
    document.body.style.userSelect = "none";
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  };

  const handleSplitKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step =
        event.key === "ArrowLeft" ? SPLIT_KEYBOARD_STEP : -SPLIT_KEYBOARD_STEP;
      commitSplit(split + step);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      commitSplit(MIN_SPLIT);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      commitSplit(MAX_SPLIT);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commitSplit(DEFAULT_SPLIT);
    }
  };

  const workspaceMissing = workspaceSettled && !workspace;
  const iconId = workspace?.icon ?? topicIconById(undefined).id;
  const WorkspaceIcon = topicIconById(iconId).Icon;
  const workspaceEmoji =
    iconId && !isTopicIconId(iconId) ? iconId : null;
  const workspaceColor = workspace ? topicColor(workspace).hex : undefined;

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr]">
      <div className="min-w-0 overflow-x-clip">
        <AnnouncementBar />
        <Header
          className="md:hidden"
          localState={draftState}
          setLocalState={setDraftState}
          modelsData={modelsData}
          userData={userData}
        />
      </div>

      <div className="grid grid-cols-1 grid-rows-[1fr_auto] gap-y-1 overflow-hidden bg-base-200 md:grid-cols-[auto_1fr] md:grid-rows-[1fr_auto] md:gap-x-2 md:pt-1">
        <SidebarWrapper
          localState={draftState}
          setLocalState={setDraftState}
          userData={userData}
          modelsData={modelsData}
        />

        <main className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">
          {workspaceMissing ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 text-center shadow-sm">
                <h1 className="text-base font-semibold text-base-content">
                  {t("workspace.not_found")}
                </h1>
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="btn btn-primary btn-sm mt-4"
                >
                  {t("topic_view.back_to_chats")}
                </button>
              </div>
            </div>
          ) : workspace ? (
            <>
              <PageKindHeader
                kind="workspace"
                leading={
                  <button
                    type="button"
                    data-guide="workspace-files-back"
                    onClick={() => navigate(`/workspace/${workspaceId}`)}
                    title={t("workspace.back_to_workspace")}
                    aria-label={t("workspace.back_to_workspace")}
                    className="btn btn-ghost btn-sm btn-square shrink-0"
                  >
                    <ArrowLeft size={18} />
                  </button>
                }
                title={workspace.name}
                kindLabel={t("workspace.kind")}
                countLabel={t("workspace.file_manager")}
                iconColor={workspaceColor}
                iconLabel={t("workspace.kind")}
                iconExpanded={false}
                iconTestId="workspace-files-header-icon"
                icon={
                  workspaceEmoji ? (
                    <span aria-hidden="true" className="text-lg leading-none">
                      {workspaceEmoji}
                    </span>
                  ) : (
                    <WorkspaceIcon size={20} />
                  )
                }
              />

              <div
                ref={splitContainerRef}
                data-testid="workspace-files-body"
                style={{ "--files-split": `${splitPercent}%` } as CSSProperties}
                className="flex min-h-0 flex-1 gap-2 px-2 pb-2 pt-1"
              >
                <div
                  className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 ${
                    preview ? "hidden md:flex" : "flex"
                  }`}
                >
                  <WorkspaceStorageTree
                    workspaceId={workspaceId}
                    className="min-h-0 flex-1"
                    showTitle={false}
                    onPreview={showPreview}
                  />
                </div>
                {preview && (
                  <aside
                    data-testid="workspace-files-preview"
                    className="relative flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 md:w-[var(--files-split)] md:shrink-0"
                  >
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={t("workspace.resize_files_split")}
                      aria-valuemin={Math.round(MIN_SPLIT * 100)}
                      aria-valuemax={Math.round(MAX_SPLIT * 100)}
                      aria-valuenow={Math.round(split * 100)}
                      tabIndex={0}
                      data-guide="workspace-files-split"
                      onPointerDown={handleSplitPointerDown}
                      onKeyDown={handleSplitKeyDown}
                      onDoubleClick={() => commitSplit(DEFAULT_SPLIT)}
                      className="absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize touch-none md:block after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-primary after:opacity-0 after:transition-opacity hover:after:opacity-60 focus-visible:outline-none focus-visible:after:opacity-100"
                    />
                    <WorkspacePreviewPane
                      request={preview}
                      onClose={closePreview}
                    />
                  </aside>
                )}
              </div>
            </>
          ) : null}
        </main>

        <CollapsibleFooter className="row-start-3 col-span-full md:row-start-2 md:col-start-1 md:col-end-3" />
      </div>
    </div>
  );
}
