import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Chat, ChevronLeft, ChevronRight, Folder, Time } from "@carbon/icons-react";

import {
  setFolderColor,
  setFolderIcon,
  useConversationList,
  useFolderList,
} from "../db";
import type { ConversationRow, FolderRow } from "../db/dbTypes";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { getDefaultConversation } from "../utils/conversationUtils";
import { formatRelativeTime } from "../utils/conversationDates";
import {
  selectConversationSummaries,
  selectUserSettings,
} from "../Redux/reducers/userSettingsReducer";
import { selectDarkMode } from "../Redux/reducers/interfaceSettingsSlice";

import AnnouncementBar from "../components/Header/AnnouncementBar";
import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import Header from "../components/Header/Header";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import TopicComposer from "../components/TopicMaster/TopicComposer";
import PageKindHeader from "../components/Others/PageKindHeader";
import FloatingTrashButton from "../components/Others/FloatingTrashButton";
import { useModal } from "../modals/ModalContext";
import { UNSORTED_TOPIC_ID } from "../components/Sidebar/TopicList";
import IconColorPicker from "../components/Sidebar/IconColorPicker";
import {
  withAlpha,
  topicColor,
  topicColorById,
} from "../components/Sidebar/topicColors";
import { isTopicIconId, topicIconById } from "../components/Sidebar/topicIcons";

function sortByRecent(first: ConversationRow, second: ConversationRow) {
  const firstTime = first.lastModified ?? first.createdAt ?? 0;
  const secondTime = second.lastModified ?? second.createdAt ?? 0;
  return secondTime - firstTime;
}

export default function TopicMasterPage() {
  const { topicId = "" } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { openModal } = useModal();
  const userSettings = useSelector(selectUserSettings);
  const showSummaries = useSelector(selectConversationSummaries);
  const isDark = useSelector(selectDarkMode);
  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();

  const folders = useFolderList() ?? [];
  const conversations = useConversationList() ?? [];

  const isUnsorted = topicId === UNSORTED_TOPIC_ID;
  const topic = useMemo<FolderRow | null>(
    () => folders.find((folder) => folder.id === topicId) ?? null,
    [folders, topicId],
  );

  // The same dialog the sidebar's topic menu opens, so the wording matches; the
  // page leaves the topic once it is gone.
  const deleteCurrentTopic = () => {
    if (!topic) return;
    openModal("deleteFolder", {
      folderId: topic.id,
      folderName: topic.name,
      onDeleted: () => navigate("/chat"),
    });
  };

  // A direct URL load sees an empty `useFolderList()` for a frame. Do not
  // flash a "topic not found" panel during that initial read.
  const [foldersSettled, setFoldersSettled] = useState(false);
  useEffect(() => {
    if (folders.length > 0) {
      setFoldersSettled(true);
      return;
    }
    const timeout = setTimeout(() => setFoldersSettled(true), 400);
    return () => clearTimeout(timeout);
  }, [folders.length]);

  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconDraft, setIconDraft] = useState("");
  const [colorDraft, setColorDraft] = useState("");
  const iconPickerRef = useRef<HTMLDivElement | null>(null);
  const iconPickerSnapshotRef = useRef<{
    icon: string;
    color: string;
  } | null>(null);

  useEffect(() => {
    if (!topic) return;
    setIconDraft(topic.icon ?? topicIconById(topic.icon).id);
    setColorDraft(topic.color ?? topicColor(topic).id);
  }, [topic?.id, topic?.icon, topic?.color]);

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

  const topicConversations = useMemo(() => {
    const knownTopicIds = new Set(folders.map((folder) => folder.id));
    const matching = isUnsorted
      ? conversations.filter(
          (conversation) =>
            !conversation.folderId ||
            !knownTopicIds.has(conversation.folderId),
        )
      : conversations.filter(
          (conversation) => conversation.folderId === topicId,
        );
    return [...matching].sort(sortByRecent);
  }, [conversations, folders, isUnsorted, topicId]);

  const folderId = isUnsorted ? null : topicId;
  const [draftState, setDraftState] = useState(() =>
    getDefaultConversation(userSettings, folderId),
  );

  useEffect(() => {
    // Switching topics starts with a fresh composer instead of carrying the
    // previous topic's draft text and settings over.
    setDraftState(getDefaultConversation(userSettings, folderId));
    // Only react to topic changes; composer edits must not reset themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const topicName = isUnsorted
    ? t("folders.uncategorized")
    : topic?.name ?? t("topic_view.loading");
  const topicMissing = !isUnsorted && foldersSettled && !topic;

  const selectedIconId =
    iconDraft || topic?.icon || topicIconById(topic?.icon).id;
  const selectedColorId =
    colorDraft || topic?.color || (topic ? topicColor(topic).id : "");
  const emoji =
    selectedIconId && !isTopicIconId(selectedIconId) ? selectedIconId : null;
  const TopicIcon = topicIconById(selectedIconId).Icon;
  const unsortedHex = isDark ? "#94A3B8" : "#64748B";
  const colorHex = isUnsorted
    ? unsortedHex
    : topic
      ? topicColorById(selectedColorId).hex
      : undefined;

  const chooseIcon = (icon: string) => {
    setIconDraft(icon);
    if (folderId) void setFolderIcon(folderId, icon);
  };

  const chooseColor = (color: string) => {
    setColorDraft(color);
    if (folderId) void setFolderColor(folderId, color);
  };

  const toggleIconPicker = () => {
    if (!iconPickerOpen && topic) {
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
          {topicMissing ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-base-200 text-base-content/60">
                  <Folder size={22} />
                </div>
                <h1 className="text-base font-semibold text-base-content">
                  {t("topic_view.missing_topic")}
                </h1>
                <p className="mt-1 text-sm text-base-content/60">
                  {t("topic_view.missing_topic_body")}
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/chat")}
                  className="btn btn-primary btn-sm mt-4"
                >
                  {t("topic_view.back_to_chats")}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Delete floats over the top-right corner, where a chat floats Close Chat. */}
              {topic && !isUnsorted && (
                <div className="absolute right-2 top-2 z-20">
                  <FloatingTrashButton
                    label={t("folders.delete_title")}
                    onClick={deleteCurrentTopic}
                    testId="topic-page-delete"
                  />
                </div>
              )}
              <PageKindHeader
                kind="topic"
                title={topicName}
                kindLabel={t("topic_view.kind")}
                countLabel={t("topic_view.chat_count", {
                  count: topicConversations.length,
                })}
                iconColor={colorHex ?? unsortedHex}
                iconLabel={t("folders.choose_icon")}
                iconExpanded={iconPickerOpen}
                onIconClick={
                  isUnsorted || !topic ? undefined : toggleIconPicker
                }
                iconTestId="topic-header-icon"
                icon={
                  isUnsorted ? (
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: withAlpha(
                          unsortedHex,
                          isDark ? 0.7 : 0.5,
                        ),
                      }}
                    />
                  ) : emoji ? (
                    <span aria-hidden="true" className="text-lg leading-none">
                      {emoji}
                    </span>
                  ) : (
                    <TopicIcon size={20} />
                  )
                }
                iconMenu={
                  iconPickerOpen && topic ? (
                    <div
                      ref={iconPickerRef}
                      className="absolute left-0 top-full z-30 mt-2 w-80 rounded-xl border border-base-300 bg-base-100 p-2 shadow-lg"
                    >
                      <IconColorPicker
                        icon={selectedIconId}
                        color={selectedColorId}
                        onIconChange={chooseIcon}
                        onColorChange={chooseColor}
                        onCancel={cancelIconPicker}
                        onDone={() => setIconPickerOpen(false)}
                        testIdPrefix="topic-header"
                      />
                    </div>
                  ) : null
                }
                leading={
                  <button
                    type="button"
                    onClick={() => navigate("/chat")}
                    aria-label={t("topic_view.back_to_chats")}
                    className="btn btn-ghost btn-sm btn-circle md:hidden"
                  >
                    <ChevronLeft size={18} />
                  </button>
                }
              />

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
                  {topicConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-base-100 text-base-content/40 shadow-sm">
                        <Chat size={22} />
                      </div>
                      <h2 className="text-base font-semibold text-base-content">
                        {t("topic_view.empty_title")}
                      </h2>
                      <p className="max-w-sm text-sm text-base-content/70">
                        {t("topic_view.empty_body")}
                      </p>
                    </div>
                  ) : (
                    topicConversations.map((conversation) => {
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
                          onClick={() => navigate(`/chat/${conversation.id}`)}
                          className="group flex w-full items-center gap-3 rounded-2xl border border-base-300 bg-base-100 px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/60">
                            <Chat size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-base-content">
                              {conversation.title || t("conversation.untitled")}
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
                  <TopicComposer
                    folderId={folderId}
                    topicName={topicName}
                    draftState={draftState}
                    setDraftState={setDraftState}
                    userData={userData}
                    modelsData={modelsData}
                  />
                </div>
              </div>
            </>
          )}
        </main>

        <CollapsibleFooter className="row-start-3 col-span-full md:row-start-2 md:col-start-1 md:col-end-3" />
      </div>
    </div>
  );
}
