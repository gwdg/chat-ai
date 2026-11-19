import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { useSelector } from "react-redux";
import { Chat, ChevronRight, Time, TrashCan } from "@carbon/icons-react";

import { useConversationList } from "../db";
import type { ConversationRow } from "../db/dbTypes";
import { useAgents } from "../agents/agentStore";
import { workspaceSessionIds } from "../agents/workspaceAgentSessions";
import {
  deleteWorkspace,
  removeOrphanWorkspaceAgents,
  seedWorkspaceAgentSessions,
  syncAgentFilesSources,
  syncChatStorageSources,
  useWorkspace,
  useWorkspaceAgents,
  useWorkspaceAgentSessionLinks,
  useWorkspaceChats,
  updateWorkspace,
} from "../db/workspaceDb";
import { useModal } from "../modals/ModalContext";
import { useToast } from "../hooks/useToast";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { getDefaultConversation } from "../utils/conversationUtils";
import { formatRelativeTime } from "../utils/conversationDates";
import {
  selectConversationSummaries,
  selectUserSettings,
} from "../Redux/reducers/userSettingsReducer";

import AnnouncementBar from "../components/Header/AnnouncementBar";
import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import Header from "../components/Header/Header";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import MetaChangesPanel from "../components/Meta/MetaChangesPanel";
import WorkspaceAgentPanel from "../components/Workspace/WorkspaceAgentPanel";
import WorkspaceComposer from "../components/Workspace/WorkspaceComposer";
import WorkspaceStorageTree from "../components/Workspace/WorkspaceStorageTree";
import IconColorPicker from "../components/Sidebar/IconColorPicker";
import { isTopicIconId, topicIconById } from "../components/Sidebar/topicIcons";
import {
  topicColor,
  topicColorById,
  withAlpha,
} from "../components/Sidebar/topicColors";

function sortByRecent(first: ConversationRow, second: ConversationRow) {
  const firstTime = first.lastModified ?? first.createdAt ?? 0;
  const secondTime = second.lastModified ?? second.createdAt ?? 0;
  return secondTime - firstTime;
}

export default function WorkspacePage() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { confirmAction } = useModal();
  const { notifyError } = useToast();
  const userSettings = useSelector(selectUserSettings);
  const showSummaries = useSelector(selectConversationSummaries);
  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();

  const workspace = useWorkspace(workspaceId);
  const workspaceChats = useWorkspaceChats(workspaceId);
  const workspaceAgentLinks = useWorkspaceAgents(workspaceId);
  const sessionLinks = useWorkspaceAgentSessionLinks();
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

  const sortedChats = useMemo(
    () => [...attachedChats].sort(sortByRecent),
    [attachedChats],
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

  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconDraft, setIconDraft] = useState("");
  const [colorDraft, setColorDraft] = useState("");
  const iconPickerRef = useRef<HTMLDivElement | null>(null);
  const iconPickerSnapshotRef = useRef<{
    icon: string;
    color: string;
  } | null>(null);

  useEffect(() => {
    if (!workspace) return;
    setIconDraft(workspace.icon ?? topicIconById(workspace.icon).id);
    setColorDraft(workspace.color ?? topicColor(workspace).id);
  }, [workspace?.id, workspace?.icon, workspace?.color]);

  useEffect(() => {
    if (!iconPickerOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        iconPickerRef.current &&
        !iconPickerRef.current.contains(event.target as Node)
      ) {
        setIconPickerOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIconPickerOpen(false);
    };
    const id = setTimeout(
      () => document.addEventListener("mousedown", onPointerDown),
      0,
    );
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [iconPickerOpen]);

  const [draftState, setDraftState] = useState(() =>
    getDefaultConversation(userSettings, null),
  );

  useEffect(() => {
    // Switching workspaces starts with a fresh composer instead of carrying
    // the previous workspace's draft text and settings over.
    setDraftState(getDefaultConversation(userSettings, null));
    // Only react to workspace changes; composer edits must not reset themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  useEffect(() => {
    void removeOrphanWorkspaceAgents(agents.map((agent) => agent.id));
  }, [agents]);

  // Old workspaces had no session links. Seed each attached agent once with its active
  // session so the workspace does not start out empty.
  useEffect(() => {
    if (!workspaceId || attachedAgents.length === 0) return;
    void seedWorkspaceAgentSessions(workspaceId, attachedAgents);
  }, [workspaceId, attachedAgents]);

  useEffect(() => {
    if (!workspaceId) return;
    // Reconcile agent-files sources with the workspace links on show and whenever the
    // agent list changes: attach creates the source, detach or deleting an agent removes it.
    void syncAgentFilesSources(workspaceId, agents);
  }, [workspaceId, agents, attachedAgents]);

  useEffect(() => {
    if (!workspaceId) return;
    // Same for the chat folders: every attached chat shows its own tree at /chats/<id>, and the
    // label follows the chat title. Old links get their source here.
    void syncChatStorageSources(workspaceId, attachedChats);
  }, [workspaceId, attachedChats]);

  const whatsNewScope = useMemo(() => {
    const sessionIds: Record<string, string[]> = {};
    for (const agent of attachedAgents) {
      sessionIds[agent.id] = [
        ...workspaceSessionIds(sessionLinks, workspaceId, agent.id),
      ];
    }
    return {
      agentIds: attachedAgents.map((agent) => agent.id),
      sessionIds,
      conversationIds: attachedChats.map((chat) => chat.id),
    };
  }, [attachedAgents, attachedChats, sessionLinks, workspaceId]);

  const workspaceTabs = useMemo(
    () => [
      {
        id: "files",
        label: t("workspace.files_tab"),
        content: (
          <WorkspaceStorageTree
            workspaceId={workspaceId}
            className="min-h-0 min-w-0"
          />
        ),
      },
      {
        id: "agents",
        label: t("meta_chat.agents_tab"),
        content: (
          <WorkspaceAgentPanel workspaceId={workspaceId} framed={false} />
        ),
      },
    ],
    [t, workspaceId],
  );

  const workspaceMissing = workspaceSettled && !workspace;
  const selectedIconId =
    iconDraft || workspace?.icon || topicIconById(workspace?.icon).id;
  const selectedColorId =
    colorDraft || workspace?.color || (workspace ? topicColor(workspace).id : "");
  const selectedColorHex = topicColorById(selectedColorId).hex;
  const workspaceEmoji =
    selectedIconId && !isTopicIconId(selectedIconId) ? selectedIconId : null;
  const WorkspaceIcon = topicIconById(selectedIconId).Icon;

  const chooseIcon = (icon: string) => {
    setIconDraft(icon);
    if (workspace) void updateWorkspace(workspace.id, { icon });
  };

  const chooseColor = (color: string) => {
    setColorDraft(color);
    if (workspace) void updateWorkspace(workspace.id, { color });
  };

  const toggleIconPicker = () => {
    if (!iconPickerOpen && workspace) {
      iconPickerSnapshotRef.current = {
        icon: selectedIconId,
        color: selectedColorId,
      };
    }
    setIconPickerOpen((open) => !open);
  };

  const cancelIconPicker = () => {
    const snapshot = iconPickerSnapshotRef.current;
    if (snapshot) {
      if (snapshot.icon !== selectedIconId) chooseIcon(snapshot.icon);
      if (snapshot.color !== selectedColorId) chooseColor(snapshot.color);
    }
    setIconPickerOpen(false);
  };

  const deleteCurrentWorkspace = () => {
    if (!workspace) return;
    confirmAction(
      {
        warningKey: "warn_workspace_delete",
        messageKey: "workspace.delete_confirm",
        confirmKey: "workspace.delete_workspace",
        danger: true,
      },
      async () => {
        try {
          await deleteWorkspace(workspace.id);
          navigate("/");
        } catch (error) {
          notifyError(
            error instanceof Error ? error.message : String(error),
            undefined,
          );
        }
      },
    );
  };

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
            <div className="flex min-h-0 min-w-0 flex-1 gap-2">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <header className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
                  <div ref={iconPickerRef} className="relative shrink-0">
                    <button
                      type="button"
                      data-testid="workspace-header-icon"
                      onClick={toggleIconPicker}
                      title={t("folders.choose_icon")}
                      aria-label={t("folders.choose_icon")}
                      aria-expanded={iconPickerOpen}
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: withAlpha(selectedColorHex, 0.16),
                        color: selectedColorHex,
                      }}
                    >
                      {workspaceEmoji ? (
                        <span
                          aria-hidden="true"
                          className="text-2xl leading-none"
                        >
                          {workspaceEmoji}
                        </span>
                      ) : (
                        <WorkspaceIcon size={24} />
                      )}
                    </button>
                    {iconPickerOpen && (
                      <div className="absolute left-0 top-full z-30 mt-2 w-80 rounded-xl border border-base-300 bg-base-100 p-2 shadow-lg">
                        <IconColorPicker
                          icon={selectedIconId}
                          color={selectedColorId}
                          onIconChange={chooseIcon}
                          onColorChange={chooseColor}
                          onCancel={cancelIconPicker}
                          onDone={() => setIconPickerOpen(false)}
                          testIdPrefix="workspace-header"
                        />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-base font-semibold">
                      {workspace.name}
                    </h1>
                    <p className="text-xs text-base-content/70">
                      {t("workspace.chat_count", {
                        count: attachedChats.length,
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={deleteCurrentWorkspace}
                    title={t("workspace.delete_workspace")}
                    aria-label={t("workspace.delete_workspace")}
                    className="btn btn-ghost btn-sm btn-square shrink-0"
                  >
                    <TrashCan size={18} />
                  </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
                    {sortedChats.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-base-100 text-base-content/40 shadow-sm">
                          <Chat size={22} />
                        </div>
                        <h2 className="text-base font-semibold text-base-content">
                          {t("workspace.empty_title")}
                        </h2>
                        <p className="max-w-sm text-sm text-base-content/70">
                          {t("workspace.empty_body")}
                        </p>
                      </div>
                    ) : (
                      sortedChats.map((conversation) => {
                        const summary = showSummaries
                          ? (conversation.summary ?? "").trim()
                          : "";
                        const modified = formatRelativeTime(
                          conversation.lastModified ?? conversation.createdAt,
                          i18n.language,
                        );
                        return (
                          <button
                            key={conversation.id}
                            type="button"
                            onClick={() =>
                              navigate(`/chat/${conversation.id}`)
                            }
                            className="group flex w-full items-center gap-3 rounded-2xl border border-base-300 bg-base-100 px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/60">
                              <Chat size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-base-content">
                                {conversation.title ||
                                  t("conversation.untitled")}
                              </span>
                              {summary && (
                                <span className="mt-0.5 block truncate text-xs text-base-content/70">
                                  {summary}
                                </span>
                              )}
                              <span className="mt-1 flex items-center gap-1 text-[11px] text-base-content/70">
                                <Time size={12} />
                                {t("folders.modified", { date: modified })}
                              </span>
                            </span>
                            <ChevronRight
                              size={16}
                              className="shrink-0 text-base-content/40 transition-transform group-hover:translate-x-0.5"
                            />
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="shrink-0 px-1.5 pb-1">
                  <div className="mx-auto w-full max-w-3xl">
                    <WorkspaceComposer
                      workspaceId={workspaceId}
                      workspaceName={workspace.name}
                      draftState={draftState}
                      setDraftState={setDraftState}
                      userData={userData}
                      modelsData={modelsData}
                    />
                  </div>
                </div>
              </div>

              <MetaChangesPanel
                userSettings={userSettings}
                scope={whatsNewScope}
                scopeKey={workspaceId}
                tabs={workspaceTabs}
              >
                {null}
              </MetaChangesPanel>
            </div>
          ) : null}
        </main>

        <CollapsibleFooter className="row-start-3 col-span-full md:row-start-2 md:col-start-1 md:col-end-3" />
      </div>
    </div>
  );
}
