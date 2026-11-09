const ACTION_TYPES =
  "RENAME_CHAT|MOVE_CHAT|PIN_CHAT|PIN_TOPIC|SET_SETTING|SET_CONVERSATION_SETTING|MCP_SERVER|ADD_MEMORY|UPDATE_MEMORY|DELETE_MEMORY|CLEAR_MEMORIES";
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
  "collapse_reasoning_while_streaming",
  "document_conversion_mode",
  "conversation_summaries",
  "send_with_enter",
  "timeout",
]);

const SUPPORTED_CONVERSATION_SETTING_KEYS = new Set([
  "model",
  "temperature",
  "top_p",
  "reasoning_effort",
  "memory_mode_override",
  "enable_tools",
  "enable_web_search",
]);

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
  let match;

  if (new RegExp(BARE_CLEAR_SOURCE, "i").test(value)) {
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

    if (type === "SET_SETTING") {
      const key = String(payload.key || "").trim();
      if (!SUPPORTED_SETTING_KEYS.has(key)) continue;
      if (!Object.prototype.hasOwnProperty.call(payload, "value")) continue;
      proposals.set(`setting:${key}`, {
        type: "setting",
        key,
        value: payload.value,
      });
      continue;
    }

    if (type === "SET_CONVERSATION_SETTING") {
      const key = String(payload.key || "").trim();
      if (!SUPPORTED_CONVERSATION_SETTING_KEYS.has(key)) continue;
      if (!Object.prototype.hasOwnProperty.call(payload, "value")) continue;
      if (!isValidConversationSetting(key, payload.value)) continue;

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

    if (type === "MCP_SERVER") {
      const op = String(payload.op || "").trim().toLowerCase();
      if (!["add", "remove", "update"].includes(op)) continue;
      const serverScope = String(payload.server || "").trim().toLowerCase();
      if (!["local", "remote"].includes(serverScope)) continue;

      const rawTarget =
        payload.target ?? payload.conversationId ?? payload.conversation_id;
      const targetAll =
        rawTarget === "all" || rawTarget === undefined ||
        rawTarget === null || rawTarget === "";
      const conversationId = String(rawTarget ?? "").trim();
      if (!targetAll && !conversationId) continue;

      const url = String(payload.url || "").trim();
      const serverId = String(
        payload.serverId ?? payload.server_id ?? payload.id ?? "",
      ).trim();
      if (serverScope === "local" && !url) continue;
      if (serverScope === "remote" && !serverId) continue;

      const enabled =
        typeof payload.enabled === "boolean" ? payload.enabled : undefined;
      const authorization =
        typeof payload.authorization === "string"
          ? payload.authorization
          : undefined;
      if (op === "update" && enabled === undefined && authorization === undefined) {
        continue;
      }

      const scope = targetAll ? "all" : "conversation";
      const name = serverScope === "local" ? url : serverId;
      proposals.set(
        `mcp:${scope}:${conversationId || "all"}:${op}:${serverScope}:${name}`,
        {
          type: "mcp_server",
          op,
          serverScope,
          scope,
          conversationId: targetAll ? null : conversationId,
          url,
          serverId,
          enabled,
          authorization,
        },
      );
      continue;
    }

    if (type === "ADD_MEMORY") {
      const text = String(payload.text || "").trim();
      if (!text) continue;
      proposals.set(`memory:add:${text}`, { type: "add_memory", text });
      continue;
    }

    if (type === "UPDATE_MEMORY") {
      const index = Number(payload.index);
      const text = String(payload.text || "").trim();
      if (!Number.isInteger(index) || index < 0 || !text) continue;
      proposals.set(`memory:update:${index}`, {
        type: "update_memory",
        index,
        text,
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
      /\[\[(?:RENAME_CHAT|MOVE_CHAT|PIN_CHAT|PIN_TOPIC|SET_SETTING|SET_CONVERSATION_SETTING|MCP_SERVER|ADD_MEMORY|UPDATE_MEMORY|DELETE_MEMORY|CLEAR_MEMORIES|CLEAR_ALL_MEMORIES|DELETE_ALL_MEMORIES):[\s\S]*$/i,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}
