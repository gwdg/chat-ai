import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Chat, ChevronLeft, ChevronRight, Folder, Time } from "@carbon/icons-react";

import { useConversationList, useFolderList } from "../db";
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
import { UNSORTED_TOPIC_ID } from "../components/Sidebar/TopicList";
import { topicColor } from "../components/Sidebar/topicColors";
import { isTopicIconId, topicIcon } from "../components/Sidebar/topicIcons";

function sortByRecent(first: ConversationRow, second: ConversationRow) {
  const firstTime = first.lastModified ?? first.createdAt ?? 0;
  const secondTime = second.lastModified ?? second.createdAt ?? 0;
  return secondTime - firstTime;
}

export default function TopicMasterPage() {
  const { topicId = "" } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
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

  const emoji = topic?.icon && !isTopicIconId(topic.icon) ? topic.icon : null;
  const TopicIcon = topic ? topicIcon(topic) : Folder;
  const unsortedHex = isDark ? "#94A3B8" : "#64748B";
  const colorHex = topic ? topicColor(topic).hex : isUnsorted ? unsortedHex : undefined;

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr]">
      <div className="min-w-0 overflow-hidden">
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
              <header className="border-b border-base-300 bg-base-100 px-4 py-3">
                <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/chat")}
                    aria-label={t("topic_view.back_to_chats")}
                    className="btn btn-ghost btn-sm btn-circle md:hidden"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-base-200"
                    style={colorHex ? { color: colorHex } : undefined}
                  >
                    {emoji ? (
                      <span aria-hidden="true" className="text-lg leading-none">
                        {emoji}
                      </span>
                    ) : isUnsorted ? (
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: unsortedHex }}
                      />
                    ) : (
                      <TopicIcon
                        size={20}
                        className={colorHex ? undefined : "text-base-content/60"}
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-base font-semibold text-base-content">
                      {topicName}
                    </h1>
                    <p className="text-xs text-base-content/70">
                      {t("topic_view.chat_count", {
                        count: topicConversations.length,
                      })}
                    </p>
                  </div>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
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
