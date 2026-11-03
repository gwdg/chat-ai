import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { TrashCan } from "@carbon/icons-react";

import BaseModal from "../../../modals/BaseModal";
import { useToast } from "../../../hooks/useToast";
import {
  assignConversationToFolder,
  deleteConversation,
  ensureFolder,
  renameFolder,
  setFolderColor,
  setFolderIcon,
  setFolderOrder,
  updateConversationMeta,
} from "../../../db";
import { selectConversationSort } from "../../../Redux/reducers/interfaceSettingsSlice";
import { TOPIC_COLORS, topicColor, topicColorById, withAlpha } from "../topicColors";
import {
  DEFAULT_TOPIC_ICON,
  TOPIC_ICONS,
  isTopicIconId,
  topicIconById,
} from "../topicIcons";
import { getDefaultSettings } from "../../../utils/conversationUtils";
import { sortConversations } from "../../../utils/conversationSort";
import { buildOrganizationProposal } from "../../../utils/conversationOrganizer";
import generateConversationOrganization from "../../../apis/generateConversationOrganization";

export default function OrganizeChatsModal({
  isOpen,
  onClose,
  conversations = [],
  folders = [],
  localState,
  setLocalState,
  notifySuccess,
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { notifyError } = useToast();
  const conversationSort = useSelector(selectConversationSort);
  const defaultModel = getDefaultSettings().model;
  const aiModelName =
    import.meta.env.VITE_TITLE_GENERATION_MODEL ||
    defaultModel?.id ||
    t("sorter.ai_default_model");

  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState("loading");
  const [aiTree, setAiTree] = useState([]);
  const [aiDeletions, setAiDeletions] = useState([]);
  const [aiTitles, setAiTitles] = useState([]);
  const [aiAssessment, setAiAssessment] = useState("");
  const [aiMeta, setAiMeta] = useState(null);
  const [analysisRun, setAnalysisRun] = useState(0);

  const orderedConversations = useMemo(
    () =>
      sortConversations(
        conversations,
        conversationSort,
        t("conversation.untitled", { defaultValue: "Untitled Chat" }),
      ),
    [conversations, conversationSort, t],
  );

  const conversationById = useMemo(
    () => new Map(orderedConversations.map((conv) => [conv.id, conv])),
    [orderedConversations],
  );

  const folderById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  );

  const proposal = useMemo(() => {
    if (aiStatus !== "ready") {
      return {
        topics: [],
        moves: [],
        titles: [],
        topicRenames: [],
        deletions: [],
      };
    }
    return buildOrganizationProposal({
      conversations: orderedConversations,
      folders,
      getCategoryName: (categoryId) => t(`sorter.categories.${categoryId}`),
      aiTree,
      aiDeletions,
      aiTitles,
    });
  }, [
    orderedConversations,
    folders,
    t,
    aiStatus,
    aiTree,
    aiDeletions,
    aiTitles,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    setAiStatus("loading");
    setAiTree([]);
    setAiDeletions([]);
    setAiTitles([]);
    setAiAssessment("");
    setAiMeta(null);

    (async () => {
      try {
        const result = await generateConversationOrganization({
          conversations: orderedConversations,
          folders,
          language: i18n.language,
        });
        if (cancelled) return;
        setAiTree(Array.isArray(result.tree) ? result.tree : []);
        setAiDeletions(
          Array.isArray(result.deletions) ? result.deletions : [],
        );
        setAiTitles(Array.isArray(result.titles) ? result.titles : []);
        setAiAssessment(result.assessment ?? "");
        setAiMeta(result);
        setAiStatus("ready");
      } catch (organizeError) {
        if (cancelled) return;
        console.error("AI conversation organization failed", organizeError);
        setAiTree([]);
        setAiDeletions([]);
        setAiTitles([]);
        setAiAssessment("");
        setAiMeta(null);
        setAiStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, analysisRun]);

  const suggestedTopicName = (topic) => {
    if (topic.folderId) {
      return folderById.get(topic.folderId)?.name ?? t("sorter.existing_topic");
    }
    if (topic.suggestedName?.trim()) return topic.suggestedName.trim();
    if (topic.categoryId) return t(`sorter.categories.${topic.categoryId}`);
    return t("sorter.new_topic");
  };

  const [topicStyles, setTopicStyles] = useState({});
  const [stylePickerTopicKey, setStylePickerTopicKey] = useState(null);
  const [selectedMoves, setSelectedMoves] = useState(() => new Set());
  const [selectedTitles, setSelectedTitles] = useState(() => new Set());
  const [selectedTopicRenames, setSelectedTopicRenames] = useState(
    () => new Set(),
  );
  const [selectedDeletes, setSelectedDeletes] = useState(() => new Set());
  const [topicNames, setTopicNames] = useState({});

  const proposalSignature = useMemo(
    () =>
      [
        ...proposal.topics
          .map(
            (topic) =>
              `${topic.key}:${topic.conversations
                .map((conversation) => conversation.id)
                .sort()
                .join(",")}`,
          )
          .sort(),
        ...proposal.titles
          .map(
            (change) => `title:${change.conversationId}:${change.title}`,
          )
          .sort(),
        ...proposal.topicRenames
          .map(
            (change) => `topic:${change.folderId}:${change.name}`,
          )
          .sort(),
        ...proposal.deletions
          .map(
            (deletion) =>
              `delete:${deletion.conversationId}:${deletion.duplicateOfId ?? ""}`,
          )
          .sort(),
      ].join("|"),
    [proposal.topics, proposal.titles, proposal.topicRenames, proposal.deletions],
  );

  useEffect(() => {
    if (aiStatus === "loading") return;
    setSelectedMoves(
      new Set(proposal.moves.map((move) => move.conversationId)),
    );
    setSelectedTitles(
      new Set(proposal.titles.map((change) => change.conversationId)),
    );
    setSelectedTopicRenames(
      new Set(proposal.topicRenames.map((change) => change.folderId)),
    );
    setSelectedDeletes(new Set());
    setTopicNames(
      Object.fromEntries(
        proposal.topics
          .filter((topic) => !topic.folderId)
          .map((topic) => [topic.key, suggestedTopicName(topic)]),
      ),
    );
    setTopicStyles(
      Object.fromEntries(
        proposal.topics.map((topic) => {
          const folder = topic.folderId
            ? folderById.get(topic.folderId)
            : null;
          const modelColor =
            typeof topic.color === "string" &&
            TOPIC_COLORS.some((option) => option.id === topic.color)
              ? topic.color
              : null;
          const modelIcon =
            typeof topic.icon === "string" ? topic.icon.trim() : "";
          return [
            topic.key,
            {
              color:
                modelColor ||
                (folder
                  ? topicColor(folder).id
                  : TOPIC_COLORS[
                      (topic.order ?? 0) % TOPIC_COLORS.length
                    ].id),
              icon:
                modelIcon || folder?.icon || DEFAULT_TOPIC_ICON.id,
            },
          ];
        }),
      ),
    );
    setStylePickerTopicKey(null);
    setError("");
  }, [proposalSignature, aiStatus]);

  const selectedMoveIds = useMemo(
    () =>
      new Set(
        proposal.moves
          .map((move) => move.conversationId)
          .filter((id) => selectedMoves.has(id)),
      ),
    [proposal.moves, selectedMoves],
  );

  const proposalMoveIds = useMemo(
    () => new Set(proposal.moves.map((move) => move.conversationId)),
    [proposal.moves],
  );

  const selectedTopicRenameIds = useMemo(
    () =>
      proposal.topicRenames
        .map((change) => change.folderId)
        .filter((id) => selectedTopicRenames.has(id)),
    [proposal.topicRenames, selectedTopicRenames],
  );

  const selectedTitleIds = useMemo(
    () =>
      proposal.titles
        .map((change) => change.conversationId)
        .filter((id) => selectedTitles.has(id)),
    [proposal.titles, selectedTitles],
  );

  const selectedDeleteIds = useMemo(
    () =>
      proposal.deletions
        .map((deletion) => deletion.conversationId)
        .filter((id) => selectedDeletes.has(id)),
    [proposal.deletions, selectedDeletes],
  );

  const selectedTopicConversations = useMemo(
    () =>
      proposal.topics
        .map((topic) => ({
          topic,
          conversations: topic.conversations.filter((conv) =>
            selectedMoveIds.has(conv.id),
          ),
        }))
        .filter((entry) => entry.conversations.length > 0),
    [proposal.topics, selectedMoveIds],
  );

  const selectedNewTopicCount = selectedTopicConversations.filter(
    (entry) => !entry.topic.folderId,
  ).length;

  const toggleMove = (conversationId) => {
    setSelectedMoves((previous) => {
      const next = new Set(previous);
      if (next.has(conversationId)) next.delete(conversationId);
      else next.add(conversationId);
      return next;
    });
  };

  const toggleTopicRename = (folderId) => {
    setSelectedTopicRenames((previous) => {
      const next = new Set(previous);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const toggleTitle = (conversationId) => {
    setSelectedTitles((previous) => {
      const next = new Set(previous);
      if (next.has(conversationId)) next.delete(conversationId);
      else next.add(conversationId);
      return next;
    });
  };

  const toggleDelete = (conversationId) => {
    setSelectedDeletes((previous) => {
      const next = new Set(previous);
      if (next.has(conversationId)) next.delete(conversationId);
      else next.add(conversationId);
      return next;
    });
  };

  const handleApply = async () => {
    const hasTopicOrder = proposal.topics.some(
      (topic) => typeof topic.order === "number",
    );
    if (
      !selectedMoveIds.size &&
      !selectedTitleIds.length &&
      !selectedTopicRenameIds.length &&
      !selectedDeleteIds.length &&
      !hasTopicOrder
    ) {
      return;
    }
    setError("");

    for (const entry of selectedTopicConversations) {
      if (entry.topic.folderId) continue;
      if (!(topicNames[entry.topic.key] ?? "").trim()) {
        setError(t("sorter.error_name"));
        return;
      }
    }

    setApplying(true);
    try {
      for (const rename of proposal.topicRenames) {
        if (!selectedTopicRenames.has(rename.folderId)) continue;
        await renameFolder(rename.folderId, rename.name);
      }

      const titleUpdates = new Map(
        proposal.titles
          .filter((change) => selectedTitles.has(change.conversationId))
          .map((change) => [change.conversationId, change.title]),
      );

      for (const [conversationId, title] of titleUpdates) {
        await updateConversationMeta(conversationId, { title });
      }

      const movedTo = new Map();

      for (const entry of selectedTopicConversations) {
        let folderId = entry.topic.folderId;
        if (!folderId) {
          folderId = await ensureFolder(topicNames[entry.topic.key].trim());
        }
        if (!folderId) {
          throw new Error("Topic could not be created");
        }
        if (typeof entry.topic.order === "number") {
          await setFolderOrder(folderId, entry.topic.order);
        }
        const style = topicStyles[entry.topic.key];
        if (style) {
          await setFolderColor(folderId, style.color);
          await setFolderIcon(folderId, style.icon);
        }

        for (const conversation of entry.conversations) {
          await assignConversationToFolder(conversation.id, folderId);
          movedTo.set(conversation.id, folderId);
        }
      }

      for (const topic of proposal.topics) {
        if (!topic.folderId) continue;
        if (typeof topic.order === "number") {
          await setFolderOrder(topic.folderId, topic.order);
        }
        const style = topicStyles[topic.key];
        if (style) {
          await setFolderColor(topic.folderId, style.color);
          await setFolderIcon(topic.folderId, style.icon);
        }
      }

      for (const conversationId of selectedDeleteIds) {
        await deleteConversation(conversationId);
      }

      const currentId = localState?.id;
      if (currentId && selectedDeleteIds.includes(currentId)) {
        navigate("/chat/");
      } else if (
        currentId &&
        (movedTo.has(currentId) || titleUpdates.has(currentId)) &&
        typeof setLocalState === "function"
      ) {
        const folderId = movedTo.has(currentId)
          ? movedTo.get(currentId) ?? null
          : undefined;
        const title = titleUpdates.get(currentId);
        setLocalState((previous) => ({
          ...previous,
          ...(title !== undefined ? { title } : {}),
          ...(folderId !== undefined ? { folderId } : {}),
          flush: true,
        }));
      }

      notifySuccess?.(t("sorter.success"));
      onClose();
    } catch (applyError) {
      console.error("Failed to apply conversation organization", applyError);
      setError(t("sorter.error_generic"));
      notifyError(t("sorter.error_generic"));
    } finally {
      setApplying(false);
    }
  };

  const titleOf = (conversation) =>
    conversation?.title ||
    t("conversation.untitled", { defaultValue: "Untitled Chat" });

  const topicRenameById = useMemo(
    () =>
      new Map(
        proposal.topicRenames.map((change) => [change.folderId, change]),
      ),
    [proposal.topicRenames],
  );

  const titleChangeById = useMemo(
    () =>
      new Map(
        proposal.titles.map((change) => [change.conversationId, change]),
      ),
    [proposal.titles],
  );

  const hasTopicOrder = proposal.topics.some(
    (topic) => typeof topic.order === "number",
  );
  const canApply =
    !applying &&
    aiStatus !== "loading" &&
    (selectedMoveIds.size > 0 ||
      selectedTitleIds.length > 0 ||
      selectedTopicRenameIds.length > 0 ||
      selectedDeleteIds.length > 0 ||
      hasTopicOrder);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="sorter.title"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 text-sm text-base-content">
        <p className="text-base-content">
          {t("sorter.intro")}
        </p>
        <p className="text-xs text-base-content/70">
          {t("sorter.ai_model_note")}
        </p>

        <div className="max-h-[45vh] space-y-4 overflow-y-auto pr-1">
          {aiStatus === "loading" ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-base-300 px-4 py-10 text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              <p className="text-xs text-base-content/70">
                {t("sorter.ai_analyzing", { model: aiModelName })}
              </p>
            </div>
          ) : (
            <>
              {aiStatus === "error" && (
                <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-3 text-xs text-warning">
                  <p>{t("sorter.ai_error")}</p>
                  <button
                    type="button"
                    className="mt-2 cursor-pointer font-medium underline underline-offset-2"
                    onClick={() => setAnalysisRun((run) => run + 1)}
                  >
                    {t("sorter.ai_retry")}
                  </button>
                </div>
              )}
              {aiMeta && aiMeta.totalCount > aiMeta.analyzedCount && (
                <p className="text-xs text-base-content/70">
                  {t("sorter.ai_limited", {
                    analyzed: aiMeta.analyzedCount,
                    total: aiMeta.totalCount,
                  })}
                </p>
              )}
              {aiStatus === "ready" && (
                <>
          {aiAssessment && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/70">
                {t("sorter.assessment_title")}
              </h3>
              <p className="whitespace-pre-line rounded-xl border border-base-300 bg-base-200 px-3 py-2 text-xs leading-relaxed text-base-content">
                {aiAssessment}
              </p>
            </section>
          )}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/70">
                {t("sorter.preview_title")}
              </h3>
              {proposal.moves.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    className="cursor-pointer text-accent hover:underline"
                    onClick={() =>
                      setSelectedMoves(
                        new Set(
                          proposal.moves.map((move) => move.conversationId),
                        ),
                      )
                    }
                  >
                    {t("sorter.select_all_moves")}
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer text-base-content/70 hover:underline dark:text-base-content/50"
                    onClick={() => setSelectedMoves(new Set())}
                  >
                    {t("sorter.deselect_all_moves")}
                  </button>
                </div>
              )}
            </div>

            {proposal.topics.length === 0 ? (
              <p className="rounded-xl border border-dashed border-base-300 px-3 py-4 text-xs text-base-content/70">
                {t("sorter.no_changes")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {proposal.topics.map((topic) => {
                  const style = topicStyles[topic.key] ?? {
                    color: TOPIC_COLORS[0].id,
                    icon: DEFAULT_TOPIC_ICON.id,
                  };
                  const color = topicColorById(style.color);
                  const hasKnownIcon = isTopicIconId(style.icon);
                  const TopicIcon = hasKnownIcon
                    ? topicIconById(style.icon).Icon
                    : null;
                  const rename = topic.folderId
                    ? topicRenameById.get(topic.folderId)
                    : null;
                  const count = topic.conversations.filter((conv) =>
                    selectedMoveIds.has(conv.id),
                  ).length;

                  return (
                    <div
                      key={topic.key}
                      className="rounded-xl border border-base-300 px-2 py-1.5"
                    >
                      <div className="flex items-center gap-2 px-1 py-1 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setStylePickerTopicKey((previous) =>
                              previous === topic.key ? null : topic.key,
                            )
                          }
                          aria-label={t("folders.choose_icon")}
                          title={t("folders.choose_icon")}
                          aria-expanded={stylePickerTopicKey === topic.key}
                          className="flex flex-shrink-0 cursor-pointer items-center justify-center rounded-lg p-1 transition-colors hover:bg-base-200"
                        >
                          {hasKnownIcon && TopicIcon ? (
                            <TopicIcon
                              size={16}
                              style={{ color: color.hex }}
                            />
                          ) : (
                            <span className="text-base leading-none">
                              {style.icon || "💬"}
                            </span>
                          )}
                        </button>

                        {!topic.folderId ? (
                          <input
                            value={topicNames[topic.key] ?? ""}
                            onChange={(event) =>
                              setTopicNames((previous) => ({
                                ...previous,
                                [topic.key]: event.target.value,
                              }))
                            }
                            aria-label={t("sorter.new_topic")}
                            className="min-w-0 flex-1 rounded-lg border border-base-300 bg-base-100 px-2 py-1 text-xs text-base-content focus:outline-none focus:ring-2 focus:ring-accent/40"
                          />
                        ) : rename ? (
                          <span className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="truncate text-[11px] text-base-content/70 line-through dark:text-base-content/50">
                              {rename.previousName}
                            </span>
                            <span className="truncate text-xs font-semibold">
                              {rename.name}
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedTopicRenames.has(
                                rename.folderId,
                              )}
                              onChange={() => toggleTopicRename(rename.folderId)}
                              aria-label={t("sorter.include_topic_rename")}
                              title={t("sorter.include_topic_rename")}
                              className="rounded text-accent focus:ring-accent"
                            />
                          </span>
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                            {suggestedTopicName(topic)}
                          </span>
                        )}

                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          {topic.folderId
                            ? t("sorter.existing_topic")
                            : t("sorter.new_topic")}
                        </span>
                        <span className="text-[11px] text-base-content/70">
                          {count}/{topic.conversations.length}
                        </span>
                      </div>

                      {stylePickerTopicKey === topic.key && (
                        <div className="mb-2 ml-1 rounded-xl border border-base-300 p-2">
                          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-base-content/70">
                            {t("folders.choose_color")}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {TOPIC_COLORS.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() =>
                                  setTopicStyles((previous) => ({
                                    ...previous,
                                    [topic.key]: {
                                      ...style,
                                      color: option.id,
                                    },
                                  }))
                                }
                                aria-label={option.label}
                                aria-pressed={style.color === option.id}
                                title={option.label}
                                className={`h-5 w-5 cursor-pointer rounded-full transition ${
                                  style.color === option.id
                                    ? "ring-2 ring-accent ring-offset-1 dark:ring-offset-bg_dark"
                                    : "hover:scale-110"
                                }`}
                                style={{ backgroundColor: option.hex }}
                              />
                            ))}
                          </div>
                          <div className="mb-1 mt-2 text-[10px] font-medium uppercase tracking-wide text-base-content/70">
                            {t("folders.choose_icon")}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {TOPIC_ICONS.map(({ id, label, Icon }) => {
                              const selected = style.icon === id;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() =>
                                    setTopicStyles((previous) => ({
                                      ...previous,
                                      [topic.key]: {
                                        ...style,
                                        icon: id,
                                      },
                                    }))
                                  }
                                  title={label}
                                  aria-label={label}
                                  aria-pressed={selected}
                                  className={`flex h-8 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                                    selected
                                      ? ""
                                      : "text-base-content/70 hover:bg-base-200"
                                  }`}
                                  style={
                                    selected
                                      ? {
                                          backgroundColor: withAlpha(
                                            color.hex,
                                            0.18,
                                          ),
                                          color: color.hex,
                                        }
                                      : undefined
                                  }
                                >
                                  <Icon size={16} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div
                        className="ml-2 flex flex-col gap-0.5 border-l pl-2"
                        style={{
                          borderColor: withAlpha(color.hex, 0.4),
                        }}
                      >
                        {topic.conversations.map((conversation) => {
                          const titleChange = titleChangeById.get(
                            conversation.id,
                          );
                          return (
                            <div
                              key={conversation.id}
                              className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-base-200"
                            >
                              {proposalMoveIds.has(conversation.id) ? (
                                <input
                                  type="checkbox"
                                  checked={selectedMoveIds.has(conversation.id)}
                                  onChange={() => toggleMove(conversation.id)}
                                  className="rounded text-accent focus:ring-accent"
                                />
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 rounded-full border border-base-300"
                                />
                              )}

                              <span className="min-w-0 flex-1">
                                {titleChange ? (
                                  <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate text-[11px] text-base-content/70 line-through dark:text-base-content/50">
                                      {titleChange.previousTitle ||
                                        titleOf(conversation)}
                                    </span>
                                    <span className="truncate text-xs">
                                      {titleChange.title}
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={selectedTitles.has(
                                        titleChange.conversationId,
                                      )}
                                      onChange={() =>
                                        toggleTitle(titleChange.conversationId)
                                      }
                                      aria-label={t(
                                        "sorter.include_title_change",
                                      )}
                                      title={t("sorter.include_title_change")}
                                      className="rounded text-accent focus:ring-accent"
                                    />
                                  </span>
                                ) : (
                                  <span className="block truncate text-xs">
                                    {titleOf(conversation)}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/70">
                {t("sorter.deletions_title")}
              </h3>
              {proposal.deletions.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    className="cursor-pointer text-error hover:underline"
                    onClick={() =>
                      setSelectedDeletes(
                        new Set(
                          proposal.deletions.map(
                            (deletion) => deletion.conversationId,
                          ),
                        ),
                      )
                    }
                  >
                    {t("sorter.select_all_deletions")}
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer text-base-content/70 hover:underline dark:text-base-content/50"
                    onClick={() => setSelectedDeletes(new Set())}
                  >
                    {t("sorter.deselect_all_deletions")}
                  </button>
                </div>
              )}
            </div>

            {proposal.deletions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-base-300 px-3 py-4 text-xs text-base-content/70">
                {t("sorter.no_deletions")}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-base-content/70">
                  {t("sorter.deletions_hint")}
                </p>
                <div className="divide-y divide-base-300 overflow-hidden rounded-xl border border-base-300">
                  {proposal.deletions.map((deletion) => {
                    const conversation = conversationById.get(
                      deletion.conversationId,
                    );
                    const duplicateOf = deletion.duplicateOfId
                      ? conversationById.get(deletion.duplicateOfId)
                      : null;
                    return (
                      <label
                        key={deletion.conversationId}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-base-200"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDeletes.has(
                            deletion.conversationId,
                          )}
                          onChange={() => toggleDelete(deletion.conversationId)}
                          className="rounded text-error focus:ring-error"
                        />
                        <TrashCan
                          size={14}
                          className="flex-shrink-0 text-error"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs">
                            {titleOf(conversation)}
                          </span>
                          <span className="block text-[11px] text-base-content/70">
                            {deletion.reason === "duplicate"
                              ? deletion.duplicateOfId
                                ? t("sorter.reason_duplicate", {
                                    title: titleOf(duplicateOf),
                                  })
                                : t("sorter.reason_duplicate_generic")
                              : t("sorter.reason_empty")}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
                </>
              )}

            </>
          )}
        </div>

        {error && (
          <p className="text-xs text-error" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 border-t border-base-300 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-base-content/70">
            {aiStatus === "loading" ? (
              <span>{t("sorter.ai_analyzing", { model: aiModelName })}</span>
            ) : (
              <>
                <span>
                  {t("sorter.summary_moves", { count: selectedMoveIds.size })}
                </span>
                <span>
                  {t("sorter.summary_new_topics", {
                    count: selectedNewTopicCount,
                  })}
                </span>
                <span>
                  {t("sorter.summary_titles", {
                    count: selectedTitleIds.length,
                  })}
                </span>
                <span>
                  {t("sorter.summary_topic_renames", {
                    count: selectedTopicRenameIds.length,
                  })}
                </span>
                <span>
                  {t("sorter.summary_deletions", {
                    count: selectedDeleteIds.length,
                  })}
                </span>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="cursor-pointer px-4 py-2 rounded-lg border border-base-300 text-base-content hover:bg-base-200 transition"
              onClick={onClose}
              disabled={applying}
            >
              {t("common.cancel")}
            </button>
            <button
              className="cursor-pointer px-5 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition shadow disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleApply}
              disabled={!canApply}
            >
              {applying ? t("sorter.applying") : t("sorter.apply")}
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
