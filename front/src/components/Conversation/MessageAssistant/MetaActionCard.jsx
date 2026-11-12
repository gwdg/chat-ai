import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  Brain,
  Folder,
  PencilLine,
  Pin,
  Server,
  Settings,
  SlidersHorizontal,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { normalizeMcpUrl } from "../../../agent/mcp";

import {
  assignConversationToFolder,
  ensureFolder,
  getConversationMeta,
  getFolder,
  setConversationPinned,
  setFolderPinned,
  updateConversationMeta,
  useConversationList,
  useFolderList,
} from "../../../db";
import { useToast } from "../../../hooks/useToast";
import {
  importUserSettings,
  selectAllMemories,
  selectUserSettings,
} from "../../../Redux/reducers/userSettingsReducer";

const cloneMcpServers = (servers) => JSON.parse(JSON.stringify(servers ?? []));

const CONVERSATION_TOOL_SETTING_KEYS = new Set([
  "browser_storage",
  "arcana_v2",
]);

const readConversationSetting = (settings, key) =>
  CONVERSATION_TOOL_SETTING_KEYS.has(key)
    ? settings?.tools?.[key]
    : settings?.[key];

const readMcpServers = (settings) => {
  const raw = settings?.mcp_servers;
  if (Array.isArray(raw)) return raw.map((server) => ({ ...server }));
  if (typeof raw === "string" && raw.trim()) {
    return [{ id: raw.trim(), enabled: true }];
  }
  return [];
};

const mcpServerMatches = (server, action) => {
  if (!server || typeof server !== "object") return false;
  if (action.serverScope === "local") {
    if (typeof server.url !== "string") return false;
    const url = normalizeMcpUrl(action.url);
    return !!url && normalizeMcpUrl(server.url) === url;
  }
  return (
    typeof server.id === "string" &&
    typeof server.url !== "string" &&
    server.id.trim() === action.serverId
  );
};

const withAuthorization = (entry, authorization) => {
  const { Authorization, ...rest } = entry.headers ?? {};
  const headers = authorization ? { ...rest, Authorization: authorization } : rest;
  if (Object.keys(headers).length) entry.headers = headers;
  else delete entry.headers;
  return entry;
};

const applyMcpAction = (servers, action) => {
  if (action.serverScope === "local" && !normalizeMcpUrl(action.url)) {
    throw new Error("Invalid MCP server URL");
  }
  const next = servers.map((server) => ({ ...server }));
  const index = next.findIndex((server) => mcpServerMatches(server, action));

  if (action.op === "remove") {
    if (index < 0) throw new Error("MCP server not found");
    next.splice(index, 1);
    return next;
  }

  if (action.op === "add") {
    if (index >= 0) {
      const entry = { ...next[index] };
      if (action.enabled !== undefined) entry.enabled = action.enabled;
      if (action.authorization !== undefined) withAuthorization(entry, action.authorization);
      next[index] = entry;
      return next;
    }
    const entry =
      action.serverScope === "local"
        ? { url: action.url, enabled: action.enabled !== false }
        : { id: action.serverId, enabled: action.enabled !== false };
    if (action.authorization) entry.headers = { Authorization: action.authorization };
    next.push(entry);
    return next;
  }

  if (index < 0) throw new Error("MCP server not found");
  const entry = { ...next[index] };
  if (action.enabled !== undefined) entry.enabled = action.enabled;
  if (action.authorization !== undefined) withAuthorization(entry, action.authorization);
  next[index] = entry;
  return next;
};

export default function MetaActionCard({
  actions,
  localState,
  setLocalState,
  modelsData = [],
  message_index,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { notifySuccess, notifyError } = useToast();
  const conversations = useConversationList() || [];
  const folders = useFolderList() || [];
  const userSettings = useSelector(selectUserSettings);
  const memories = useSelector(selectAllMemories);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState("");
  const previousState = useRef(null);

  const setDecision = (decision) => {
    if (message_index === undefined) return;
    setLocalState?.((prev) => {
      const messages = [...prev.messages];
      const message = messages[message_index];
      if (!message) return prev;
      messages[message_index] = {
        ...message,
        meta: { ...(message.meta || {}), actionDecision: decision },
      };
      return { ...prev, messages, flush: true };
    });
  };

  const conversationById = new Map(
    conversations.map((conversation) => [conversation.id, conversation]),
  );
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const originalTitles = useRef(new Map());

  const settingLabels = {
    memory_mode: "user_settings.chat_preferences.memory.label",
    suggest_user_prompts: "user_settings.chat_preferences.suggestions.label",
    set_title_once:
      "user_settings.chat_preferences.suggestions.title_once.label",
    conversation_summaries: "user_settings.chat_preferences.summaries.label",
    show_timestamps: "user_settings.chat_preferences.messages.timestamps.label",
    send_with_enter: "user_settings.chat_preferences.submission.label",
    html_render_mode: "user_settings.chat_preferences.html_render.label",
    html_load_external:
      "user_settings.chat_preferences.html_render.external_references.label",
    html_sanitization:
      "user_settings.chat_preferences.html_render.sanitization.label",
    render_typst: "user_settings.chat_preferences.typst.label",
    render_latex: "user_settings.chat_preferences.latex.label",
    render_graphviz: "user_settings.chat_preferences.graphviz.label",
    render_vega: "user_settings.chat_preferences.vega.label",
    render_chartjs: "user_settings.chat_preferences.chartjs.label",
    collapse_reasoning_while_streaming:
      "user_settings.chat_preferences.reasoning_streaming.label",
    document_conversion_mode:
      "user_settings.chat_preferences.document_conversion.label",
    timeout: "user_settings.timeout.title",
    temperature: "meta_chat.setting_temperature",
    top_p: "meta_chat.setting_top_p",
    reasoning_effort: "settings.reasoning_effort.title",
    memory_mode_override: "settings.memory_mode.label",
    enable_tools: "settings.tools_title",
    enable_web_search: "settings.label_web_search",
    browser_storage: "settings.label_browser_storage",
    arcana_v2: "settings.label_arcana_v2",
  };

  const formatSettingValue = (key, value) => {
    if (key === "memory_mode") {
      const name = ["none", "recall", "learn"][Number(value)];
      return name
        ? t(`user_settings.chat_preferences.memory.options.${name}.label`, {
            defaultValue: String(value),
          })
        : String(value);
    }
    if (key === "html_render_mode") {
      return t(`user_settings.chat_preferences.html_render.options.${value}.label`, {
        defaultValue: String(value),
      });
    }
    if (key === "html_sanitization") {
      return t(
        `user_settings.chat_preferences.html_render.sanitization.options.${value}.label`,
        { defaultValue: String(value) },
      );
    }
    if (key === "document_conversion_mode") {
      return t(
        `user_settings.chat_preferences.document_conversion.options.${value}.label`,
        { defaultValue: String(value) },
      );
    }
    if (key === "send_with_enter") {
      if (value === null) return t("meta_chat.setting_device_default");
      const name = value ? "enter" : "shift_enter";
      return t(`user_settings.chat_preferences.submission.options.${name}.label`, {
        defaultValue: String(value),
      });
    }
    if (key === "timeout") {
      return `${Math.round(Number(value) / 1000)} ${t(
        "user_settings.timeout.seconds_short",
      )}`;
    }
    if (typeof value === "boolean") {
      return value ? t("meta_chat.setting_on") : t("meta_chat.setting_off");
    }
    return String(value);
  };

  const formatConversationSettingValue = (key, value) => {
    if (key === "model") {
      const modelId = typeof value === "string" ? value : value?.id;
      const model = modelsData.find((item) => item.id === modelId);
      return model?.name || value?.name || modelId || t("settings.default");
    }
    if (key === "memory_mode_override") {
      if (value === "default" || value === undefined) {
        return t("settings.memory_mode.options.default.label");
      }
      const name = ["none", "recall", "learn"][Number(value)];
      return t(`settings.memory_mode.options.${name}.label`, {
        defaultValue: String(value),
      });
    }
    if (key === "reasoning_effort") {
      return value === null || value === undefined
        ? t("settings.default")
        : String(value);
    }
    if (typeof value === "boolean") {
      return value ? t("meta_chat.setting_on") : t("meta_chat.setting_off");
    }
    return String(value);
  };

  const memoryText = (index) =>
    memories[index]?.text ||
    t("meta_chat.memory_item", { index: index + 1 });

  const summaryFor = (action) => {
    if (action.type === "rename") {
      return t("meta_chat.rename_summary", {
        from: titleFor(action.conversationId),
        to: action.title,
      });
    }
    if (action.type === "move") {
      return t("meta_chat.move_summary", {
        title: titleFor(action.conversationId),
        topic: topicFor(action),
      });
    }
    if (action.type === "pin") {
      return t(
        action.pinned ? "meta_chat.pin_summary" : "meta_chat.unpin_summary",
        { title: titleFor(action.conversationId) },
      );
    }
    if (action.type === "pin_topic") {
      return t(
        action.pinned
          ? "meta_chat.pin_topic_summary"
          : "meta_chat.unpin_topic_summary",
        {
          topic:
            folderById.get(action.topicId)?.name || action.topicId,
        },
      );
    }
    if (action.type === "setting") {
      return t("meta_chat.setting_summary", {
        setting: t(settingLabels[action.key] || action.key, {
          defaultValue: action.key,
        }),
        from: formatSettingValue(action.key, userSettings[action.key]),
        to: formatSettingValue(action.key, action.value),
      });
    }
    if (action.type === "conversation_setting") {
      const setting = t(settingLabels[action.key] || action.key, {
        defaultValue: action.key,
      });
      const value = formatConversationSettingValue(action.key, action.value);
      if (action.scope === "all") {
        return t("meta_chat.conversation_setting_all_summary", {
          setting,
          value,
        });
      }
      return t("meta_chat.conversation_setting_summary", {
        setting,
        value,
        title: titleFor(action.conversationId),
      });
    }
    if (action.type === "mcp_server") {
      const target =
        action.scope === "all"
          ? t("meta_chat.mcp_target_all")
          : titleFor(action.conversationId);
      const name =
        action.serverScope === "local" ? action.url : action.serverId;
      return t(
        `meta_chat.mcp_${action.op}_${action.serverScope}_summary`,
        { name, target },
      );
    }
    if (action.type === "add_memory") {
      return t("meta_chat.add_memory_summary", { text: action.text });
    }
    if (action.type === "update_memory") {
      return t("meta_chat.update_memory_summary", {
        from: memoryText(action.index),
        to: action.text,
      });
    }
    if (action.type === "delete_memory") {
      return t("meta_chat.delete_memory_summary", {
        text: memoryText(action.index),
      });
    }
    return t("meta_chat.clear_memories_summary");
  };

  useEffect(() => {
    for (const action of actions) {
      if (originalTitles.current.has(action.conversationId)) continue;
      const conversation = conversationById.get(action.conversationId);
      if (!conversation) continue;
      originalTitles.current.set(
        action.conversationId,
        (conversation.title || "").trim() ||
          t("conversation.untitled", { defaultValue: "Untitled Chat" }),
      );
    }
  }, [actions, conversations, conversationById, t]);

  const titleFor = (conversationId) =>
    originalTitles.current.get(conversationId) ||
    (conversationById.get(conversationId)?.title || "").trim() ||
    t("conversation.untitled", { defaultValue: "Untitled Chat" });

  const topicFor = (action) => {
    if (action.folderId) {
      return (
        folderById.get(action.folderId)?.name ||
        action.folderName ||
        action.folderId
      );
    }
    if (action.folderName) return action.folderName;
    return t("meta_chat.unsorted_topic");
  };

  const handleAccept = async () => {
    if (applying || applied) return;
    setApplying(true);
    setError("");

    try {
      const prepared = [];
      const settingUpdates = {};
      const memoryActions = actions.filter((action) =>
        [
          "add_memory",
          "update_memory",
          "delete_memory",
          "clear_memories",
        ].includes(action.type),
      );
      let updatedMemories = null;

      for (const action of actions) {
        if (action.type === "setting") {
          settingUpdates[action.key] = action.value;
          continue;
        }

        if (action.type === "conversation_setting") {
          continue;
        }

        if (
          [
            "add_memory",
            "update_memory",
            "delete_memory",
            "clear_memories",
          ].includes(action.type)
        ) {
          if (
            (action.type === "update_memory" ||
              action.type === "delete_memory") &&
            (!Number.isInteger(action.index) ||
              action.index < 0 ||
              action.index >= memories.length)
          ) {
            throw new Error("Memory not found");
          }
          continue;
        }

        if (action.type === "pin_topic") {
          const folder =
            folderById.get(action.topicId) ||
            (await getFolder(action.topicId));
          if (!folder) {
            throw new Error("Topic not found");
          }
          prepared.push({
            ...action,
            previousPinned: folder.pinned === true,
          });
          continue;
        }

        const conversation = await getConversationMeta(
          action.conversationId,
        );
        if (!conversation) {
          throw new Error("Conversation not found");
        }

        if (action.type === "rename") {
          prepared.push({
            ...action,
            previousTitle: conversation.title || "",
          });
          continue;
        }

        if (action.type === "pin") {
          prepared.push({
            ...action,
            previousPinned: conversation.pinned === true,
          });
          continue;
        }

        let folderId = action.folderId || null;
        if (folderId) {
          const folder = await getFolder(folderId);
          if (!folder) {
            if (!action.folderName) throw new Error("Topic not found");
            folderId = await ensureFolder(action.folderName);
          }
        } else if (action.folderName) {
          folderId = await ensureFolder(action.folderName);
        }
        prepared.push({
          ...action,
          resolvedFolderId: folderId,
          previousFolderId: conversation.folderId ?? null,
        });
      }

      if (memoryActions.length > 0) {
        if (memoryActions.some((action) => action.type === "clear_memories")) {
          updatedMemories = [];
        } else {
          const deletionIndexes = new Set(
            memoryActions
              .filter((action) => action.type === "delete_memory")
              .map((action) => action.index),
          );
          const updatesByIndex = new Map(
            memoryActions
              .filter((action) => action.type === "update_memory")
              .map((action) => [action.index, action.text]),
          );
          updatedMemories = memories
            .map((memory, index) =>
              updatesByIndex.has(index)
                ? { ...memory, text: updatesByIndex.get(index) }
                : memory,
            )
            .filter((_, index) => !deletionIndexes.has(index));
          for (const action of memoryActions) {
            if (action.type !== "add_memory") continue;
            updatedMemories.push({
              id: `meta-${Date.now()}-${updatedMemories.length}`,
              text: action.text,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      const conversationSettingsPlan = new Map();
      for (const action of actions.filter(
        (item) => item.type === "conversation_setting",
      )) {
        const targets =
          action.scope === "all"
            ? conversations
            : [await getConversationMeta(action.conversationId)];
        if (targets.length === 0) {
          throw new Error("No conversations found");
        }
        for (const conversation of targets) {
          if (!conversation || conversation.isMetaChat) continue;
          const entry = conversationSettingsPlan.get(conversation.id) || {
            id: conversation.id,
            previous: {},
            expected: {},
          };
          let nextValue = action.value;
          if (action.key === "model") {
            const model = modelsData.find(
              (item) => item.id === action.value || item.name === action.value,
            );
            if (!model) throw new Error("Model not found");
            nextValue = model;
          }
          entry.previous[action.key] = readConversationSetting(
            conversation.settings,
            action.key,
          );
          entry.expected[action.key] = nextValue;
          conversationSettingsPlan.set(conversation.id, entry);
        }
      }
      if (
        actions.some((action) => action.type === "conversation_setting") &&
        conversationSettingsPlan.size === 0
      ) {
        throw new Error("No conversations found");
      }

      const mcpPlan = new Map();
      for (const action of actions.filter((item) => item.type === "mcp_server")) {
        const targets =
          action.scope === "all"
            ? conversations
            : [await getConversationMeta(action.conversationId)];
        if (targets.length === 0) {
          throw new Error("No conversations found");
        }
        for (const conversation of targets) {
          if (!conversation || conversation.isMetaChat) continue;
          const entry = mcpPlan.get(conversation.id) || {
            id: conversation.id,
            previous: readMcpServers(conversation.settings),
            expected: readMcpServers(conversation.settings),
          };
          entry.expected = applyMcpAction(entry.expected, action);
          mcpPlan.set(conversation.id, entry);
        }
      }
      if (
        actions.some((action) => action.type === "mcp_server") &&
        mcpPlan.size === 0
      ) {
        throw new Error("No conversations found");
      }

      previousState.current = {
        chats: prepared.map((action) => {
          if (action.type === "rename") {
            return {
              type: "rename",
              conversationId: action.conversationId,
              expectedTitle: action.title,
              previousTitle: action.previousTitle,
            };
          }
          if (action.type === "pin") {
            return {
              type: "pin",
              conversationId: action.conversationId,
              expectedPinned: action.pinned === true,
              previousPinned: action.previousPinned === true,
            };
          }
          if (action.type === "pin_topic") {
            return {
              type: "pin_topic",
              topicId: action.topicId,
              expectedPinned: action.pinned === true,
              previousPinned: action.previousPinned === true,
            };
          }
          return {
            type: "move",
            conversationId: action.conversationId,
            expectedFolderId: action.resolvedFolderId ?? null,
            previousFolderId: action.previousFolderId ?? null,
          };
        }),
        settings: Object.fromEntries(
          Object.entries(settingUpdates).map(([key, expected]) => [
            key,
            { previous: userSettings[key], expected },
          ]),
        ),
        memories: updatedMemories
          ? {
              previous: memories.map((memory) => ({ ...memory })),
              expected: updatedMemories.map((memory) => ({ ...memory })),
            }
          : null,
        conversationSettings: [...conversationSettingsPlan.values()].map(
          (entry) => ({
            id: entry.id,
            previous: { ...entry.previous },
            expected: { ...entry.expected },
          }),
        ),
        mcpServers: [...mcpPlan.values()].map((entry) => ({
          id: entry.id,
          previous: cloneMcpServers(entry.previous),
          expected: cloneMcpServers(entry.expected),
        })),
      };

      for (const action of prepared) {
        if (action.type === "rename") {
          await updateConversationMeta(action.conversationId, {
            title: action.title,
          });
          setLocalState?.((previous) =>
            previous?.id === action.conversationId
              ? { ...previous, title: action.title }
              : previous,
          );
          continue;
        }

        if (action.type === "pin_topic") {
          await setFolderPinned(action.topicId, action.pinned);
          continue;
        }

        if (action.type === "pin") {
          await setConversationPinned(action.conversationId, action.pinned);
          setLocalState?.((previous) =>
            previous?.id === action.conversationId
              ? { ...previous, pinned: action.pinned }
              : previous,
          );
          continue;
        }

        const folderId = action.resolvedFolderId ?? null;
        await assignConversationToFolder(action.conversationId, folderId);
        setLocalState?.((previous) =>
          previous?.id === action.conversationId
            ? { ...previous, folderId }
            : previous,
        );
      }

      for (const entry of conversationSettingsPlan.values()) {
        const conversation = await getConversationMeta(entry.id);
        if (!conversation) throw new Error("Conversation not found");
        const settings = applyConversationSettingValues(
          conversation.settings,
          entry.expected,
        );
        await updateConversationMeta(entry.id, { settings });
        setLocalState?.((previous) =>
          previous?.id === entry.id
            ? { ...previous, settings }
            : previous,
        );
      }

      for (const entry of mcpPlan.values()) {
        const conversation = await getConversationMeta(entry.id);
        if (!conversation) throw new Error("Conversation not found");
        const settings = { ...(conversation.settings || {}), mcp_servers: entry.expected };
        await updateConversationMeta(entry.id, { settings });
        setLocalState?.((previous) =>
          previous?.id === entry.id ? { ...previous, settings } : previous,
        );
      }

      if (Object.keys(settingUpdates).length > 0) {
        dispatch(importUserSettings(settingUpdates));
      }
      if (updatedMemories) {
        dispatch(importUserSettings({ memories: updatedMemories }));
      }

      setApplied(true);
      setDecision("accepted");
      notifySuccess(t("meta_chat.changes_applied"));
    } catch (applyError) {
      console.error("Failed to apply Meta chat changes", applyError);
      setError(t("meta_chat.apply_failed"));
      notifyError(t("meta_chat.apply_failed"));
    } finally {
      setApplying(false);
    }
  };

  const valuesEqual = (first, second) =>
    JSON.stringify(first) === JSON.stringify(second);

  const conversationSettingMatches = (key, current, expected) => {
    if (key === "model") {
      const currentId = typeof current === "string" ? current : current?.id;
      const expectedId = typeof expected === "string" ? expected : expected?.id;
      return currentId === expectedId;
    }
    return valuesEqual(current, expected);
  };

  const applyConversationSettingValues = (settings, values) => {
    const next = { ...(settings || {}) };
    let tools;
    for (const [key, value] of Object.entries(values)) {
      if (CONVERSATION_TOOL_SETTING_KEYS.has(key)) {
        tools ??= { ...(next.tools || {}) };
        if (value === undefined) delete tools[key];
        else tools[key] = value;
        continue;
      }
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
    }
    if (tools) {
      if (Object.keys(tools).length) next.tools = tools;
      else delete next.tools;
    }
    return next;
  };

  const handleRevert = async () => {
    if (!applied || reverting || !previousState.current) return;
    setReverting(true);
    setError("");

    try {
      const snapshot = previousState.current;

      for (const chat of snapshot.chats) {
        if (chat.type === "pin_topic") {
          const folder = await getFolder(chat.topicId);
          if (
            !folder ||
            (folder.pinned === true) !== chat.expectedPinned
          ) {
            throw new Error("Topic pinned state changed");
          }
          continue;
        }

        const current = await getConversationMeta(chat.conversationId);
        if (!current) throw new Error("Conversation not found");
        if (chat.type === "rename") {
          if ((current.title || "") !== chat.expectedTitle) {
            throw new Error("Conversation title changed");
          }
        } else if (chat.type === "pin") {
          if ((current.pinned === true) !== chat.expectedPinned) {
            throw new Error("Conversation pinned state changed");
          }
        } else if (
          (current.folderId ?? null) !== (chat.expectedFolderId ?? null)
        ) {
          throw new Error("Conversation topic changed");
        }
      }

      for (const [key, values] of Object.entries(snapshot.settings)) {
        if (!valuesEqual(userSettings[key], values.expected)) {
          throw new Error("Setting changed");
        }
      }

      for (const entry of snapshot.conversationSettings || []) {
        const current = await getConversationMeta(entry.id);
        if (!current) throw new Error("Conversation not found");
        for (const [key, expected] of Object.entries(entry.expected)) {
          const currentValue = readConversationSetting(current.settings, key);
          if (!conversationSettingMatches(key, currentValue, expected)) {
            throw new Error("Conversation setting changed");
          }
        }
      }

      for (const entry of snapshot.mcpServers || []) {
        const current = await getConversationMeta(entry.id);
        if (!current) throw new Error("Conversation not found");
        if (!valuesEqual(readMcpServers(current.settings), entry.expected)) {
          throw new Error("MCP servers changed");
        }
      }

      if (
        snapshot.memories &&
        !valuesEqual(memories, snapshot.memories.expected)
      ) {
        throw new Error("Memories changed");
      }

      for (const chat of snapshot.chats) {
        if (chat.type === "pin_topic") {
          await setFolderPinned(chat.topicId, chat.previousPinned);
          continue;
        }

        if (chat.type === "rename") {
          await updateConversationMeta(chat.conversationId, {
            title: chat.previousTitle,
          });
          setLocalState?.((previous) =>
            previous?.id === chat.conversationId
              ? { ...previous, title: chat.previousTitle }
              : previous,
          );
          continue;
        }

        if (chat.type === "pin") {
          await setConversationPinned(chat.conversationId, chat.previousPinned);
          setLocalState?.((previous) =>
            previous?.id === chat.conversationId
              ? { ...previous, pinned: chat.previousPinned }
              : previous,
          );
          continue;
        }

        const folderId = chat.previousFolderId ?? null;
        await assignConversationToFolder(chat.conversationId, folderId);
        setLocalState?.((previous) =>
          previous?.id === chat.conversationId
            ? { ...previous, folderId }
            : previous,
        );
      }

      for (const entry of snapshot.conversationSettings || []) {
        const conversation = await getConversationMeta(entry.id);
        if (!conversation) throw new Error("Conversation not found");
        const settings = applyConversationSettingValues(
          conversation.settings,
          entry.previous,
        );
        await updateConversationMeta(entry.id, { settings });
        setLocalState?.((previous) =>
          previous?.id === entry.id
            ? { ...previous, settings }
            : previous,
        );
      }

      for (const entry of snapshot.mcpServers || []) {
        const conversation = await getConversationMeta(entry.id);
        if (!conversation) throw new Error("Conversation not found");
        const settings = { ...(conversation.settings || {}), mcp_servers: entry.previous };
        await updateConversationMeta(entry.id, { settings });
        setLocalState?.((previous) =>
          previous?.id === entry.id ? { ...previous, settings } : previous,
        );
      }

      const previousSettings = Object.fromEntries(
        Object.entries(snapshot.settings).map(([key, values]) => [
          key,
          values.previous,
        ]),
      );
      if (Object.keys(previousSettings).length > 0) {
        dispatch(importUserSettings(previousSettings));
      }
      if (snapshot.memories) {
        dispatch(
          importUserSettings({ memories: snapshot.memories.previous }),
        );
      }

      setApplied(false);
      setDecision("rejected");
      notifySuccess(t("meta_chat.changes_reverted"));
    } catch (revertError) {
      console.error("Failed to revert Meta chat changes", revertError);
      setError(t("meta_chat.revert_mismatch"));
      notifyError(t("meta_chat.revert_mismatch"));
    } finally {
      setReverting(false);
    }
  };

  if (!Array.isArray(actions) || actions.length === 0) return null;

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-2.5">
      <div className="flex items-start gap-1.5">
        <TriangleAlert
          size={16}
          className="mt-0.5 shrink-0 text-warning"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-base-content">
            {t("meta_chat.proposed_changes")}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-base-content/70">
            {t("meta_chat.mutation_warning")}
          </p>

          <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-base-content">
            {actions.map((action, index) => (
              <li
                key={`${action.type}:${action.conversationId || action.topicId}:${index}`}
                className="flex items-start gap-1.5"
              >
                {action.type === "rename" ? (
                  <PencilLine
                    size={12}
                    className="mt-0.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                ) : action.type === "move" ? (
                  <Folder
                    size={12}
                    className="mt-0.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                ) : action.type === "pin" ||
                  action.type === "pin_topic" ? (
                  <Pin
                    size={12}
                    className="mt-0.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                ) : action.type === "setting" ? (
                  <Settings
                    size={12}
                    className="mt-0.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                ) : action.type === "conversation_setting" ? (
                  <SlidersHorizontal
                    size={12}
                    className="mt-0.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                ) : action.type === "mcp_server" ? (
                  <Server
                    size={12}
                    className="mt-0.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                ) : (
                  <Brain
                    size={12}
                    className="mt-0.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                )}
                <span>{summaryFor(action)}</span>
              </li>
            ))}
          </ul>

          {error && <p className="mt-1.5 text-[11px] text-error">{error}</p>}

          <div className="mt-2 flex justify-end gap-1.5">
            {applied ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs gap-1.5"
                onClick={handleRevert}
                disabled={reverting}
              >
                <Undo2 size={14} aria-hidden="true" />
                {reverting
                  ? t("meta_chat.reverting")
                  : t("meta_chat.revert_changes")}
              </button>
            ) : (
              <button
                type="button"
                data-guide="meta-action-accept"
                className="btn btn-warning btn-xs gap-1.5"
                onClick={handleAccept}
                disabled={applying}
              >
                <TriangleAlert size={14} aria-hidden="true" />
                {applying
                  ? t("meta_chat.applying_changes")
                  : t("meta_chat.accept_changes")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
