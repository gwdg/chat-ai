import { isBrandLocked } from "../config/brandPolicy.js";
import { isFeatureEnabled } from "../config/deployment.js";

const ACTION_TYPES =
  "CREATE_CHAT|RENAME_CHAT|MOVE_CHAT|PIN_CHAT|PIN_TOPIC|PIN_WORKSPACE|PIN_AGENT|SET_SETTING|SET_CONVERSATION_SETTING|WORKSPACE_LINK|AGENT_ACTION|AGENT_SESSION|MCP_SERVER|ADD_MEMORY|UPDATE_MEMORY|DELETE_MEMORY|CLEAR_MEMORIES|E2EE_ASSIGN";
const ACTION_SOURCE = `\\[\\[(${ACTION_TYPES}):\\s*(\\{[\\s\\S]*?\\})\\]\\]`;

const BARE_CLEAR_SOURCE =
  "\\[\\[(?:CLEAR_MEMORIES|CLEAR_ALL_MEMORIES|DELETE_ALL_MEMORIES)\\]\\]";

const SUPPORTED_SETTING_KEYS = new Set([
  "memory_mode",
  "suggest_user_prompts",
  "html_render_mode",
  "html_load_external",
  "html_sanitization",
  "set_title_once",
  "render_typst",
  "render_latex",
  "render_graphviz",
  "render_vega",
  "render_chartjs",
  "collapse_reasoning_while_streaming",
  "document_conversion_mode",
  "conversation_summaries",
  "show_timestamps",
  "send_with_enter",
  "feedback_enabled",
  "feedback_full_transcript",
  "mcp_tool_policy",
  "timeout",
  "sync_enabled",
  "sync_auto",
]);

const SUPPORTED_CONVERSATION_SETTING_KEYS = new Set([
  "model",
  "temperature",
  "top_p",
  "reasoning_effort",
  "memory_mode_override",
  "enable_tools",
  "enable_web_search",
  "browser_storage",
  "workspace_write_access",
  "arcana_tools",
]);

const LOCKED_CHAT_SETTING_KEYS = new Set([
  "temperature",
  "top_p",
  "reasoning_effort",
  "memory_mode_override",
  "memory_group_override",
]);
const LOCKED_TOOL_SETTING_KEYS = new Set([
  "enable_tools",
  "enable_web_search",
  "browser_storage",
  "workspace_write_access",
  "arcana_tools",
]);

/**
 * A brand may fix the model, the chat settings or GWDG Tools. The Meta chat can
 * propose per-conversation settings and create a chat with overrides, so it must
 * not become the way around a control the brand removed from the interface.
 */
export const isConversationSettingLocked = (key) => {
  if (key === "model") return isBrandLocked("model");
  if (LOCKED_CHAT_SETTING_KEYS.has(key)) return isBrandLocked("chat_settings");
  if (LOCKED_TOOL_SETTING_KEYS.has(key)) return isBrandLocked("tools");
  return false;
};

function isValidConversationSetting(key, value) {
  if (key === "model") {
    return typeof value === "string" && value.trim().length > 0;
  }
  if (key === "temperature" || key === "top_p") {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 2;
  }
  if (key === "reasoning_effort") {
    return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
  }
  if (key === "memory_mode_override") {
    return value === "default" || [0, 1, 2].includes(Number(value));
  }
  return typeof value === "boolean";
}

const CREATE_CHAT_TOOL_KEYS = new Set([
  "web_search",
  "image_generation",
  "image_modification",
  "audio_generation",
  "arcana_tools",
  "arcana",
  "mcp",
  "workspace_write_access",
  "browser_storage",
  "create_docx",
]);

const CREATE_CHAT_SETTING_KEYS = new Set([
  "model",
  "temperature",
  "top_p",
  "reasoning_effort",
  "memory_mode_override",
  "memory_group_override",
  "enable_tools",
  "enable_web_search",
  "tools",
  "mcp_local_server_ids",
]);

function normalizeCreateChat(payload, memoriesEnabled = true) {
  const title = String(payload?.title || "").trim().slice(0, 200);
  const folderId =
    payload?.folderId === null || payload?.folder_id === null
      ? null
      : String(payload?.folderId ?? payload?.folder_id ?? "").trim() || null;
  const folderName = String(
    payload?.folderName ?? payload?.folder_name ?? "",
  ).trim().slice(0, 120);

  const rawMessages = Array.isArray(payload?.messages) ? payload.messages : [];
  if (rawMessages.length > 200) return null;
  const messages = [];
  let totalChars = 0;
  for (const rawMessage of rawMessages) {
    const role = String(rawMessage?.role || "").trim().toLowerCase();
    if (!["system", "user", "assistant"].includes(role)) return null;
    let text = "";
    if (typeof rawMessage?.content === "string") {
      text = rawMessage.content;
    } else if (Array.isArray(rawMessage?.content)) {
      if (rawMessage.content.some((part) => part?.type !== "text")) return null;
      text = rawMessage.content
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("\n");
    } else {
      return null;
    }
    text = text.trim();
    if (!text || text.length > 20000) return null;
    totalChars += text.length;
    if (totalChars > 100000) return null;
    messages.push({ role, text });
  }

  const rawSettings =
    payload?.settings && typeof payload.settings === "object"
      ? payload.settings
      : {};
  const settings = {};
  for (const [key, value] of Object.entries(rawSettings)) {
    if (!CREATE_CHAT_SETTING_KEYS.has(key)) continue;
    if (key === "model") {
      const id =
        typeof value === "string"
          ? value.trim()
          : String(value?.id || "").trim();
      if (id) settings.model = id;
    } else if (key === "temperature" || key === "top_p") {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 2) {
        settings[key] = value;
      }
    } else if (key === "reasoning_effort") {
      if (value === null || (Number.isInteger(value) && value >= 0 && value <= 10)) {
        settings[key] = value;
      }
    } else if (key === "memory_mode_override") {
      if (
        memoriesEnabled &&
        (value === "default" || [0, 1, 2].includes(Number(value)))
      ) {
        settings[key] = value === "default" ? "default" : Number(value);
      }
    } else if (key === "memory_group_override") {
      if (memoriesEnabled) {
        const group = String(value || "").trim();
        if (group) settings.memory_group_override = group.slice(0, 120);
      }
    } else if (key === "enable_tools" || key === "enable_web_search") {
      if (typeof value === "boolean") settings[key] = value;
    } else if (key === "tools" && value && typeof value === "object" && !Array.isArray(value)) {
      const tools = {};
      for (const [name, enabled] of Object.entries(value)) {
        if (CREATE_CHAT_TOOL_KEYS.has(name) && typeof enabled === "boolean") {
          tools[name] = enabled;
        }
      }
      if (Object.keys(tools).length) settings.tools = tools;
    } else if (key === "mcp_local_server_ids" && Array.isArray(value)) {
      settings[key] = value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 50);
    }
  }

  const pinned =
    typeof payload?.pinned === "boolean" ? payload.pinned : undefined;
  return {
    type: "create_chat",
    title,
    folderId,
    folderName,
    settings,
    messages,
    ...(pinned !== undefined ? { pinned } : {}),
  };
}

function normalizeFolderId(payload) {
  const hasFolderId =
    Object.prototype.hasOwnProperty.call(payload, "folderId") ||
    Object.prototype.hasOwnProperty.call(payload, "folder_id");
  const raw = payload.folderId ?? payload.folder_id ?? null;
  const folderId = raw === null ? null : String(raw).trim() || null;
  return { hasFolderId, folderId };
}

export function getMetaActionProposals(text) {
  const value = String(text || "");
  const pattern = new RegExp(ACTION_SOURCE, "gi");
  const proposals = new Map();
  const memoriesEnabled = isFeatureEnabled("memories");
  let match;

  if (memoriesEnabled && new RegExp(BARE_CLEAR_SOURCE, "i").test(value)) {
    proposals.set("memory:clear", { type: "clear_memories" });
  }

  while ((match = pattern.exec(value)) !== null) {
    let payload;
    try {
      payload = JSON.parse(match[2]);
    } catch {
      continue;
    }
    if (!payload || typeof payload !== "object") continue;

    const type = match[1].toUpperCase();

    // Memory proposals are meaningless while the deployment has no memories.
    if (
      !memoriesEnabled &&
      ["ADD_MEMORY", "UPDATE_MEMORY", "DELETE_MEMORY", "CLEAR_MEMORIES"].includes(
        type,
      )
    ) {
      continue;
    }

    if (type === "CREATE_CHAT") {
      const proposal = normalizeCreateChat(payload, memoriesEnabled);
      if (proposal) {
        proposals.set(
          `create-chat:${proposal.title}:${proposal.folderId || proposal.folderName}:${proposal.messages.length}`,
          proposal,
        );
      }
      continue;
    }

    if (type === "SET_SETTING") {
      const key = String(payload.key || "").trim();
      if (!SUPPORTED_SETTING_KEYS.has(key)) continue;
      if (key === "memory_mode" && !memoriesEnabled) continue;
      if (key === "feedback_full_transcript" && !isFeatureEnabled("feedback")) continue;
      if (
        key === "mcp_tool_policy" &&
        !["ask", "always", "never"].includes(payload.value)
      ) {
        continue;
      }
      if (
        (key === "sync_enabled" ||
          key === "sync_auto" ||
          key === "feedback_enabled" ||
          key === "feedback_full_transcript") &&
        typeof payload.value !== "boolean"
      ) {
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(payload, "value")) continue;
      proposals.set(`setting:${key}`, {
        type: "setting",
        key,
        value: payload.value,
      });
      continue;
    }

    if (type === "E2EE_ASSIGN") {
      const modelId = String(payload.modelId || payload.model || "").trim();
      if (!modelId) continue;
      const keyField = ["keyId", "key", "keyName"].find((field) =>
        Object.prototype.hasOwnProperty.call(payload, field),
      );
      // Without a key field the marker is incomplete; `null` or "" clears it.
      if (!keyField) continue;
      const rawKey = payload[keyField];
      const key =
        rawKey === null || rawKey === undefined || !String(rawKey).trim()
          ? null
          : String(rawKey).trim();
      proposals.set(`e2ee:${modelId}`, {
        type: "e2ee_assign",
        modelId,
        key,
      });
      continue;
    }

    if (type === "SET_CONVERSATION_SETTING") {
      const key = String(payload.key || "").trim();
      if (!SUPPORTED_CONVERSATION_SETTING_KEYS.has(key)) continue;
      if (key === "memory_mode_override" && !memoriesEnabled) continue;
      if (!Object.prototype.hasOwnProperty.call(payload, "value")) continue;
      if (!isValidConversationSetting(key, payload.value)) continue;
      // A locked setting keeps the deployment's value; the proposal is dropped
      // rather than offered and then silently ignored.
      if (isConversationSettingLocked(key)) continue;

      const targetAll =
        payload.target === "all" || payload.scope === "all" || payload.all === true;
      const conversationId = String(
        payload.id || payload.conversationId || payload.conversation_id || "",
      ).trim();
      if (!targetAll && !conversationId) continue;

      const scope = targetAll ? "all" : "conversation";
      proposals.set(
        `conversation-setting:${scope}:${conversationId || "all"}:${key}`,
        {
          type: "conversation_setting",
          scope,
          conversationId: targetAll ? null : conversationId,
          key,
          value: payload.value,
        },
      );
      continue;
    }

    if (type === "AGENT_ACTION") {
      const op = String(payload.op || "").trim().toLowerCase();
      if (!["prompt", "interrupt"].includes(op)) continue;
      const agentId = String(payload.agent ?? payload.agentId ?? "").trim();
      if (!agentId) continue;
      const text = String(payload.text ?? payload.prompt ?? "").trim();
      if (op === "prompt" && (!text || text.length > 20000)) continue;
      proposals.set(`agent-action:${op}:${agentId}:${text.slice(0, 40)}`, {
        type: "agent_action",
        op,
        agentId,
        ...(op === "prompt" ? { text } : {}),
      });
      continue;
    }

    if (type === "AGENT_SESSION") {
      const op = String(payload.op || "").trim().toLowerCase();
      if (!["create", "switch", "delete"].includes(op)) continue;
      const agentId = String(payload.agent ?? payload.agentId ?? "").trim();
      if (!agentId) continue;
      const sessionId = String(
        payload.sessionId ?? payload.session_id ?? "",
      ).trim();
      const title = String(payload.title || "").trim().slice(0, 200);
      if ((op === "switch" || op === "delete") && !sessionId) continue;
      proposals.set(`agent-session:${op}:${agentId}:${sessionId || title}`, {
        type: "agent_session",
        op,
        agentId,
        ...(sessionId ? { sessionId } : {}),
        ...(title ? { title } : {}),
      });
      continue;
    }

    if (type === "WORKSPACE_LINK") {
      const op = String(payload.op || "").trim().toLowerCase();
      if (!["attach", "detach"].includes(op)) continue;
      const workspaceId = String(
        payload.workspaceId ?? payload.workspace_id ?? "",
      ).trim();
      const agentId = String(payload.agentId ?? payload.agent_id ?? "").trim();
      const conversationId = String(
        payload.conversationId ?? payload.conversation_id ?? "",
      ).trim();
      if (!workspaceId || Boolean(agentId) === Boolean(conversationId)) {
        continue;
      }
      const targetKind = agentId ? "agent" : "conversation";
      const targetId = agentId || conversationId;
      proposals.set(
        `workspace-link:${op}:${workspaceId}:${targetKind}:${targetId}`,
        {
          type: "workspace_link",
          op,
          workspaceId,
          targetKind,
          targetId,
        },
      );
      continue;
    }

    if (type === "MCP_SERVER") {
      const op = String(payload.op || "").trim().toLowerCase();
      if (!["add", "remove", "update"].includes(op)) continue;
      const serverScope = String(payload.server || "local").trim().toLowerCase();
      // Only browser-connected servers exist; a legacy "remote" proposal is dropped.
      if (serverScope !== "local") continue;

      const rawTarget =
        payload.target ?? payload.conversationId ?? payload.conversation_id;
      const targetGlobal = rawTarget === "global";
      const targetAll =
        !targetGlobal &&
        (rawTarget === "all" || rawTarget === undefined ||
          rawTarget === null || rawTarget === "");
      const conversationId = String(rawTarget ?? "").trim();
      if (!targetGlobal && !targetAll && !conversationId) continue;

      const url = String(payload.url || "").trim();
      const entryId = String(
        payload.entryId ?? payload.entry_id ?? "",
      ).trim();
      const name = String(payload.name || "").trim();
      const scope = targetGlobal
        ? "global"
        : targetAll
          ? "all"
          : "conversation";
      if (!url && !(scope === "global" && entryId)) {
        continue;
      }

      const enabled =
        typeof payload.enabled === "boolean" ? payload.enabled : undefined;
      const authorization =
        typeof payload.authorization === "string"
          ? payload.authorization
          : undefined;
      if (
        scope !== "global" &&
        op === "update" &&
        enabled === undefined &&
        authorization === undefined
      ) {
        continue;
      }
      if (scope === "global" && op === "update" && !entryId && !url) {
        continue;
      }

      proposals.set(
        `mcp:${scope}:${conversationId || "all"}:${op}:${entryId || url}`,
        {
          type: "mcp_server",
          op,
          scope,
          conversationId: targetGlobal || targetAll ? null : conversationId,
          entryId,
          name,
          url,
          enabled,
          authorization,
        },
      );
      continue;
    }

    if (type === "ADD_MEMORY") {
      const text = String(payload.text || "").trim();
      if (!text) continue;
      const group = String(
        payload.group ?? payload.groupId ?? payload.group_id ?? "",
      ).trim();
      proposals.set(`memory:add:${group}:${text}`, {
        type: "add_memory",
        text,
        ...(group ? { group } : {}),
      });
      continue;
    }

    if (type === "UPDATE_MEMORY") {
      const index = Number(payload.index);
      const text = String(payload.text || "").trim();
      if (!Number.isInteger(index) || index < 0 || !text) continue;
      const group = String(
        payload.group ?? payload.groupId ?? payload.group_id ?? "",
      ).trim();
      proposals.set(`memory:update:${index}`, {
        type: "update_memory",
        index,
        text,
        ...(group ? { group } : {}),
      });
      continue;
    }

    if (type === "DELETE_MEMORY") {
      const index = Number(payload.index);
      if (!Number.isInteger(index) || index < 0) continue;
      proposals.set(`memory:delete:${index}`, {
        type: "delete_memory",
        index,
      });
      continue;
    }

    if (type === "CLEAR_MEMORIES") {
      proposals.set("memory:clear", { type: "clear_memories" });
      continue;
    }

    if (type === "PIN_TOPIC") {
      const topicId = String(
        payload.id || payload.topicId || payload.topic_id || "",
      ).trim();
      if (!topicId) continue;
      const hasPinned = Object.prototype.hasOwnProperty.call(payload, "pinned");
      const hasValue = Object.prototype.hasOwnProperty.call(payload, "value");
      const raw = hasPinned ? payload.pinned : payload.value;
      if ((!hasPinned && !hasValue) || typeof raw !== "boolean") continue;
      proposals.set(`pin-topic:${topicId}`, {
        type: "pin_topic",
        topicId,
        pinned: raw,
      });
      continue;
    }

    if (type === "PIN_WORKSPACE") {
      const workspaceId = String(
        payload.id || payload.workspaceId || payload.workspace_id || "",
      ).trim();
      if (!workspaceId) continue;
      const hasPinned = Object.prototype.hasOwnProperty.call(payload, "pinned");
      const hasValue = Object.prototype.hasOwnProperty.call(payload, "value");
      const raw = hasPinned ? payload.pinned : payload.value;
      if ((!hasPinned && !hasValue) || typeof raw !== "boolean") continue;
      proposals.set(`pin-workspace:${workspaceId}`, {
        type: "pin_workspace",
        workspaceId,
        pinned: raw,
      });
      continue;
    }

    if (type === "PIN_AGENT") {
      const agentId = String(
        payload.id || payload.agentId || payload.agent_id || "",
      ).trim();
      if (!agentId) continue;
      const hasPinned = Object.prototype.hasOwnProperty.call(payload, "pinned");
      const hasValue = Object.prototype.hasOwnProperty.call(payload, "value");
      const raw = hasPinned ? payload.pinned : payload.value;
      if ((!hasPinned && !hasValue) || typeof raw !== "boolean") continue;
      proposals.set(`pin-agent:${agentId}`, {
        type: "pin_agent",
        agentId,
        pinned: raw,
      });
      continue;
    }

    const conversationId = String(
      payload.id || payload.conversationId || payload.conversation_id || "",
    ).trim();
    if (!conversationId) continue;

    if (type === "RENAME_CHAT") {
      const title = String(payload.title || "").trim();
      if (!title) continue;
      proposals.set(`rename:${conversationId}`, {
        type: "rename",
        conversationId,
        title,
      });
      continue;
    }

    if (type === "PIN_CHAT") {
      const hasPinned = Object.prototype.hasOwnProperty.call(payload, "pinned");
      const hasValue = Object.prototype.hasOwnProperty.call(payload, "value");
      const raw = hasPinned ? payload.pinned : payload.value;
      if ((!hasPinned && !hasValue) || typeof raw !== "boolean") continue;
      proposals.set(`pin:${conversationId}`, {
        type: "pin",
        conversationId,
        pinned: raw,
      });
      continue;
    }

    const { hasFolderId, folderId } = normalizeFolderId(payload);
    const folderName = String(
      payload.folderName ?? payload.folder_name ?? "",
    ).trim();
    if (!folderId && !folderName && !hasFolderId) continue;
    proposals.set(`move:${conversationId}`, {
      type: "move",
      conversationId,
      folderId,
      folderName,
    });
  }

  return [...proposals.values()];
}

export function stripMetaActionMarkers(text) {
  return String(text || "")
    .replace(new RegExp(ACTION_SOURCE, "gi"), "")
    .replace(new RegExp(BARE_CLEAR_SOURCE, "gi"), "")
    .replace(
      /\[\[(?:RENAME_CHAT|MOVE_CHAT|PIN_CHAT|PIN_TOPIC|PIN_WORKSPACE|PIN_AGENT|SET_SETTING|SET_CONVERSATION_SETTING|MCP_SERVER|ADD_MEMORY|UPDATE_MEMORY|DELETE_MEMORY|CLEAR_MEMORIES|CLEAR_ALL_MEMORIES|DELETE_ALL_MEMORIES):[\s\S]*$/i,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}
