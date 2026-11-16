import {
  getConversationMeta,
  getRecentMessageExcerpts,
  listConversationMetas,
  listFolders,
  searchMessages,
} from "../db";
import { buildFeatureGuidePrompt, featureGuides } from "../config/featureGuides";
import { buildUseCasePrompt, useCases } from "../config/useCases";
import { loadPersonaCatalog } from "./personaCatalog";
import { getSpeechModule } from "./speechAudio";
import {
  listMcpServerTools,
  normalizeMcpUrl,
  remoteMcpEnabled,
  testMcpServer,
} from "../agent/mcp";
import { getAgents } from "../agents/agentStore";
import { fetchAgentSessions } from "../agents/agentSessions";
import { filterSessionTree } from "../agents/workspaceAgentSessions";
import { listWorkspaceSummaries } from "../db/workspaceDb";
import {
  getOpencodeInfo,
  getOpencodeSessionStatus,
  listOpencodeFiles,
  listOpencodeMessages,
  readOpencodeFile,
  runOpencodeShellAndWait,
} from "../apis/opencodeAgents";
import { FILE_SEARCH_MARKER, FILE_STAT_MARKER } from "./gitLog";

const MAX_CONVERSATIONS = 400;
const MAX_CONTEXT_CHARS = 60000;

function yesNo(value) {
  return value ? "yes" : "no";
}

function memoryGroupsFor(userSettings = {}) {
  return [
    { id: "default", name: "Default" },
    ...(Array.isArray(userSettings.memory_groups)
      ? userSettings.memory_groups
      : []),
  ];
}

function memoryGroupName(userSettings, groupId) {
  const id = groupId ?? "default";
  return (
    memoryGroupsFor(userSettings).find((group) => group.id === id)?.name || id
  );
}

function buildSettingsLines(userSettings = {}, interfaceSettings = {}) {
  const memoryMode =
    userSettings.memory_mode === 1
      ? "recall"
      : userSettings.memory_mode === 2
        ? "learn"
        : "off";
  const memories = userSettings.memories ?? [];
  const memoryGroups = memoryGroupsFor(userSettings);
  const memoryGroupsSummary = memoryGroups
    .map((group) => {
      const count = memories.filter(
        (memory) => (memory.groupId ?? "default") === group.id,
      ).length;
      return `${group.name} (${count} memories)`;
    })
    .join(", ");
  const sendWithEnter =
    userSettings.send_with_enter === null ||
    userSettings.send_with_enter === undefined
      ? "device default"
      : userSettings.send_with_enter
        ? "Enter"
        : "Shift+Enter";
  const documentConversion =
    userSettings.document_conversion_mode === "browser"
      ? "browser only (local)"
      : userSettings.document_conversion_mode === "server"
        ? "server only"
        : "by choice";
  const model = userSettings.model;
  const modelName =
    typeof model === "string"
      ? model
      : model?.name || model?.id || "not set";

  return [
    `- Default model: ${modelName}`,
    `- Memory mode: ${memoryMode}`,
    `- Saved memories: ${userSettings.memories?.length ?? 0} (stored in this browser)`,
    `- Memory groups: ${memoryGroupsSummary}`,
    `- Configured MCP servers: ${
      Array.isArray(userSettings.mcp_servers) && userSettings.mcp_servers.length
        ? userSettings.mcp_servers
            .map(
              (server) =>
                `${server.name || server.url || server.serverId} (${server.kind}, id: ${server.id}${server.url ? `, url: ${server.url}` : ""})`,
            )
            .join(", ")
        : "none"
    }`,
    `- Default memory group: ${memoryGroupName(userSettings, userSettings.default_memory_group)} (id: ${userSettings.default_memory_group ?? "default"})`,
    `- Request timeout: ${Math.round((userSettings.timeout ?? 300000) / 1000)} seconds`,
    `- Suggest follow-up prompts: ${yesNo(userSettings.suggest_user_prompts)}`,
    `- Set title only on first prompt: ${yesNo(userSettings.set_title_once)}`,
    `- Conversation summaries: ${yesNo(userSettings.conversation_summaries)}`,
    `- Show message timestamps: ${yesNo(userSettings.show_timestamps)}`,
    `- Send message with: ${sendWithEnter}`,
    `- HTML rendering: ${userSettings.html_render_mode ?? "off"}`,
    `- Load external references: ${yesNo(userSettings.html_load_external)}`,
    `- HTML sanitization: ${userSettings.html_sanitization ?? "strict"}`,
    `- Render Typst: ${yesNo(userSettings.render_typst)}`,
    `- Render LaTeX: ${yesNo(userSettings.render_latex)}`,
    `- Render Graphviz: ${yesNo(userSettings.render_graphviz ?? false)}`,
    `- Render Vega-Lite: ${yesNo(userSettings.render_vega ?? false)}`,
    `- Render Chart.js: ${yesNo(userSettings.render_chartjs ?? false)}`,
    `- Keep reasoning collapsed while streaming: ${yesNo(userSettings.collapse_reasoning_while_streaming)}`,
    `- Document conversion: ${documentConversion}`,
    `- Modules: tools ${import.meta.env.VITE_MODULE_TOOLS === "true" ? "enabled" : "disabled"}, feedback ${import.meta.env.VITE_MODULE_FEEDBACK === "true" ? "enabled" : "disabled"}, choices ${import.meta.env.VITE_MODULE_CHOICES === "true" ? "enabled" : "disabled"}, arcanas ${import.meta.env.VITE_MODULE_ARCANAS !== "false" ? "enabled" : "disabled"}, agents ${import.meta.env.VITE_MODULE_AGENTS !== "false" ? "enabled" : "disabled"}, speech ${getSpeechModule() ? "enabled" : "disabled"}`,
    `- Dark mode: ${yesNo(interfaceSettings.dark_mode)}`,
    `- Show usage in sidebar: ${yesNo(interfaceSettings.show_usage_in_sidebar)}`,
    `- Chat sorting: ${interfaceSettings.conversation_sort ?? "created_desc"}`,
    `- Chat grouping: ${interfaceSettings.conversation_grouping ?? "topic"}`,
    `- Web search disclaimer accepted: ${yesNo(interfaceSettings.agree_web_search)}`,
    `- Show welcome tour: ${yesNo(interfaceSettings.show_tour)}`,
    `- Confirmation warnings: clear history ${yesNo(interfaceSettings.warn_clear_history)}, close chat ${yesNo(interfaceSettings.warn_close_chat)}, share settings ${yesNo(interfaceSettings.warn_share_settings)}, regenerate ${yesNo(interfaceSettings.warn_regenerate)}, fork ${yesNo(interfaceSettings.warn_fork)}, restore agent sessions ${yesNo(interfaceSettings.warn_restore_agent_sessions)}`,
    `- Completed tutorials: ${interfaceSettings.completed_tutorials?.length ?? 0}`,
    `- Completed use cases: ${interfaceSettings.completed_use_cases?.length ?? 0}`,
    `- Suppressed tutorials: ${interfaceSettings.suppressed_tutorials?.length ?? 0}`,
  ];
}

export function buildConversationSettingsSummary(settings = {}) {
  const model =
    typeof settings.model === "string"
      ? settings.model
      : settings.model?.name || settings.model?.id || "not set";
  const tools = settings.tools || {};
  const enabledTools = Object.entries(tools)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
  const browserStorage = tools.browser_storage === true;
  const memoryOverride =
    settings.memory_mode_override === "default" ||
    settings.memory_mode_override === undefined
      ? "default"
      : ["off", "recall", "learn"][Number(settings.memory_mode_override)] ||
        String(settings.memory_mode_override);
  const reasoning =
    settings.reasoning_effort === null ||
    settings.reasoning_effort === undefined
      ? "default"
      : settings.reasoning_effort;
  const arcanaId = settings.arcana?.id || "";
  const mcpServers = Array.isArray(settings.mcp_servers)
    ? settings.mcp_servers
    : typeof settings.mcp_servers === "string" && settings.mcp_servers.trim()
      ? [{ id: settings.mcp_servers.trim(), enabled: true }]
      : [];
  const mcpDescription = mcpServers
    .map((server) => {
      const enabled = server?.enabled === false ? "disabled" : "enabled";
      const name = typeof server?.name === "string" && server.name.trim() ? ` "${server.name.trim()}"` : "";
      if (typeof server?.url === "string") return `local ${server.url}${name} (${enabled})`;
      if (typeof server?.id === "string") return `remote ${server.id}${name} (${enabled})`;
      return `unknown ${JSON.stringify(server)}`;
    })
    .join(", ");

  return [
    `model ${model}`,
    `temperature ${settings.temperature ?? "default"}`,
    `top_p ${settings.top_p ?? "default"}`,
    `reasoning effort ${reasoning}`,
    `memory mode override ${memoryOverride}`,
    `tools ${settings.enable_tools ? "enabled" : "disabled"}${
      settings.enable_tools && enabledTools.length
        ? ` (${enabledTools.join(", ")})`
        : ""
    }`,
    `browser storage ${browserStorage ? "enabled" : "disabled"}`,
    `arcana ${arcanaId || "none"}`,
    `MCP local ${tools.mcp ? "enabled" : "disabled"}, remote ${remoteMcpEnabled(settings) ? "enabled" : "disabled"}${mcpDescription ? ` (${mcpDescription})` : ""}`,
  ].join("; ");
}

function conversationLines(conversations, topics) {
  const topicById = new Map(topics.map((topic) => [topic.id, topic.name]));
  const lines = [];
  let used = 0;
  for (const conversation of conversations.slice(0, MAX_CONVERSATIONS)) {
    const summary = conversation.summary || "(no summary available)";
    const modified = conversation.lastModified
      ? new Date(conversation.lastModified).toISOString()
      : "unknown";
    const topicName = conversation.folderId
      ? topicById.get(conversation.folderId) || "Unsorted"
      : "Unsorted";
    const topicId = conversation.folderId
      ? ` (id: ${conversation.folderId})`
      : "";
    const line = `- id: ${conversation.id}\n  title: ${conversation.title}\n  topic: ${topicName}${topicId}\n  pinned: ${conversation.pinned ? "yes" : "no"}\n  summary: ${summary}\n  per-chat settings: ${conversation.settingsSummary}\n  last modified: ${modified}`;
    if (used + line.length > MAX_CONTEXT_CHARS) break;
    lines.push(line);
    used += line.length;
  }
  return lines.join("\n") || "(no conversations available)";
}

function topicLines(topics) {
  return (
    topics
      .map(
        (topic) =>
          `- id: ${topic.id}\n  name: ${topic.name}\n  pinned: ${topic.pinned ? "yes" : "no"}`,
      )
      .join("\n") || "(no topics available)"
  );
}

function personaLines(personas) {
  return (
    personas
      .map(
        (persona) =>
          `- id: ${persona.id}\n  title: ${persona.title}\n  category: ${persona.category || "uncategorized"}\n  description: ${persona.description || "(no description)"}`,
      )
      .join("\n") || "(no personas available)"
  );
}

function messageLines(matches, topics) {
  const topicNames = new Map(topics.map((topic) => [topic.id, topic.name]));
  return (
    matches
      .slice(0, 20)
      .map((match) => {
        const date = match.createdAt
          ? new Date(match.createdAt).toISOString()
          : "unknown";
        const topicName = match.folderId
          ? topicNames.get(match.folderId) || "Unsorted"
          : "Unsorted";
        return `- conversation id: ${match.conversationId}\n  conversation title: ${match.conversationTitle}\n  topic: ${topicName}\n  message id: ${match.messageId}\n  role: ${match.role}\n  date: ${date}\n  excerpt: ${match.snippet}`;
      })
      .join("\n") || "(no message matches)"
  );
}

const findAgent = (reference) => {
  const target = String(reference || "").trim();
  return getAgents().find(
    (agent) => agent.id === target || agent.name === target,
  );
};

const agentMessageText = (message) => {
  if (message?.type === "user") return String(message.text || "").trim();
  const parts = message?.content ?? message?.parts ?? [];
  return parts
    .map((part) => {
      if (part?.type === "text") return part.text || "";
      if (part?.type === "tool") return `[tool: ${part.name || "tool"}]`;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
};

const agentFileLink = (agent, path) =>
  `/agent/${encodeURIComponent(agent.id)}?file=${encodeURIComponent(path)}`;

const findAgentSession = async (agent, reference) => {
  if (!agent?.sessionId) return null;
  const target = String(reference || "").trim();
  if (!target) return agent.sessionId;
  const tree = await fetchAgentSessions(agent).catch(() => ({ all: [] }));
  const sessions = tree?.all || [];
  const exact = sessions.find((session) => session.id === target);
  if (exact) return exact.id;
  const byTitle = sessions.find(
    (session) =>
      String(session.title || "").trim().toLowerCase() ===
      target.toLowerCase(),
  );
  return byTitle?.id || null;
};

const agentSessionLines = (agent, tree) => {
  const roots = tree?.roots || [];
  const children = tree?.children || new Map();
  const line = (session, depth) => {
    const parentId = session.parentID || session.parentId;
    return [
      `- ${session.id}`,
      `  title: ${session.title || "Untitled session"}`,
      `  ${depth ? `subagent of: ${parentId}` : "top-level"}`,
      ...(session.id === agent.sessionId ? ["  active: yes"] : []),
    ].join("\n");
  };
  const lines = [];
  const seen = new Set();
  const walk = (session, depth) => {
    if (!session?.id || seen.has(session.id)) return;
    seen.add(session.id);
    lines.push(line(session, depth));
    for (const child of children.get(session.id) || []) {
      walk(child, depth + 1);
    }
  };
  for (const root of roots) walk(root, 0);
  return lines;
};

const fileTime = (item) => {
  const raw =
    item?.mtime ??
    item?.modified ??
    item?.modifiedAt ??
    item?.time?.modified ??
    item?.time?.updated ??
    item?.time?.created ??
    item?.createdAt;
  if (raw === undefined || raw === null || raw === "") return 0;
  const numeric = typeof raw === "number" ? raw : new Date(raw).getTime();
  if (!Number.isFinite(numeric)) return 0;
  return numeric < 1e12 ? numeric * 1000 : numeric;
};

/** ISO timestamp for tool output; empty when a row predates the field. */
const formatToolTimestamp = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "unknown";
  return new Date(numeric).toISOString();
};

const tableCell = (value) =>
  String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();

const markdownTable = (headers, rows) =>
  [
    `| ${headers.map(tableCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map(
      (row) => `| ${row.map(tableCell).join(" | ")} |`,
    ),
  ].join("\n");

const shellQuote = (value) =>
  `'${String(value).replace(/'/g, "'\\''")}'`;

const searchAgentFileContents = async (agent, query) => {
  if (!agent?.sessionId) return [];
  const command = `grep -RInF --exclude-dir=.git --exclude-dir=node_modules -- ${shellQuote(query)} . 2>/dev/null | head -50 # ${FILE_SEARCH_MARKER}`;
  try {
    const output = await runOpencodeShellAndWait(
      agent,
      agent.sessionId,
      command,
      20000,
    );
    return output
      .split("\n")
      .filter(Boolean)
      .filter((line) => !line.includes(FILE_SEARCH_MARKER))
      .slice(0, 50);
  } catch {
    return [];
  }
};

const fileStatsCache = new Map();
const FILE_STATS_TTL = 60 * 1000;

const readAgentFileStats = async (agent) => {
  if (!agent?.sessionId) return null;
  const cacheKey = `${agent.id}:${agent.sessionId}`;
  const cached = fileStatsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < FILE_STATS_TTL) {
    return cached.rows;
  }
  const command = `node -e "const fs=require('fs'),path=require('path');function walk(d,out){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name==='.git'||e.name==='node_modules')continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p,out);else{const s=fs.statSync(p);out.push({path:path.relative(process.cwd(),p),size:s.size,mtime:s.mtimeMs})}if(out.length>=2000)return out}return out}console.log(JSON.stringify(walk('.',[])))" # ${FILE_STAT_MARKER}`;
  try {
    const output = await runOpencodeShellAndWait(
      agent,
      agent.sessionId,
      command,
      20000,
    );
    const line = output
      .split("\n")
      .find((entry) => entry.trim().startsWith("["));
    if (!line) return null;
    const rows = JSON.parse(line);
    const files = Array.isArray(rows)
      ? rows.filter((row) => row?.path && typeof row.path === "string")
      : null;
    if (files) fileStatsCache.set(cacheKey, { at: Date.now(), rows: files });
    return files;
  } catch {
    return null;
  }
};

const collectAgentFiles = async (
  agent,
  path = "",
  depth = 0,
  output = [],
) => {
  if (depth > 3 || output.length >= 500) return output;
  let rows = [];
  try {
    rows = await listOpencodeFiles(agent, path);
  } catch {
    return output;
  }
  for (const row of rows) {
    if (output.length >= 500) break;
    const rowPath = String(row?.path || "");
    if (
      row?.type === "directory" &&
      rowPath.split("/").filter(Boolean).includes(".git")
    ) {
      continue;
    }
    if (row?.type === "directory") {
      await collectAgentFiles(agent, rowPath, depth + 1, output);
    } else {
      output.push({ ...row, agentId: agent.id, agentName: agent.name || agent.id });
    }
  }
  return output;
};

const parseSince = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const sessionActivity = (raw) => {
  if (!raw) return "idle";
  const activity =
    typeof raw === "string"
      ? raw
      : raw?.type ?? raw?.status ?? raw?.state ?? "unknown";
  const value = String(activity);
  if (/busy|running|working|active|pending|retry|permission/i.test(value)) {
    return "working";
  }
  if (/error|offline|failed|unavailable/i.test(value)) return "error";
  return "idle";
};

const loadAgentSessionTrees = async (agents) => {
  const entries = await Promise.all(
    agents.map(async (agent) => {
      try {
        return [agent.id, await fetchAgentSessions(agent)];
      } catch {
        return [agent.id, null];
      }
    }),
  );
  return new Map(entries);
};

const agentStatusRows = async (
  agents,
  sessionTrees = null,
  { scopedAgentIds = new Set() } = {},
) => {
  return Promise.all(
    agents.map(async (agent) => {
      const treeResult = sessionTrees
        ? Promise.resolve({
            status: "fulfilled",
            value: sessionTrees.get(agent.id),
          })
        : fetchAgentSessions(agent).then(
            (value) => ({ status: "fulfilled", value }),
            (reason) => ({ status: "rejected", reason }),
          );
      const [info, statuses, treeResultValue] = await Promise.all([
        getOpencodeInfo(agent).then(
          (value) => ({ status: "fulfilled", value }),
          (reason) => ({ status: "rejected", reason }),
        ),
        getOpencodeSessionStatus(agent).then(
          (value) => ({ status: "fulfilled", value }),
          (reason) => ({ status: "rejected", reason }),
        ),
        treeResult,
      ]);
      const tree =
        treeResultValue.status === "fulfilled" ? treeResultValue.value : null;
      const sessions = tree?.all || [];
      const statusMap =
        statuses.status === "fulfilled" ? statuses.value || {} : {};
      const connected =
        info.status === "fulfilled" || statuses.status === "fulfilled";
      if (!agent.sessionId && !sessions.length) {
        return {
          missing: true,
          name: agent.name || agent.id,
          server: agent.serverUrl,
        };
      }
      const active = sessions.find((session) => session.id === agent.sessionId);
      const activeState = sessionActivity(statusMap[agent.sessionId]);
      // A scoped report must not name a session outside the scope it was given.
      const activeHidden =
        scopedAgentIds.has(agent.id) && Boolean(agent.sessionId) && !active;
      const workingCount = sessions.filter(
        (session) => sessionActivity(statusMap[session.id]) === "working",
      ).length;
      const errorCount = sessions.filter(
        (session) => sessionActivity(statusMap[session.id]) === "error",
      ).length;
      const subagents = sessions.filter(
        (session) => session.parentID || session.parentId,
      ).length;
      const error =
        info.status === "rejected"
          ? info.reason instanceof Error
            ? info.reason.message
            : String(info.reason)
          : "";
      return {
        missing: false,
        name: agent.name || agent.id,
        server: agent.serverUrl,
        connected,
        activeTitle:
          active?.title ||
          (activeHidden ? "not in this scope" : agent.sessionId || "none"),
        activeState: activeHidden ? "—" : activeState,
        total: sessions.length,
        working: workingCount,
        errors: errorCount,
        subagents,
        error,
      };
    }),
  );
};

const agentStatusLines = async (agents, sessionTrees = null) => {
  const rows = await agentStatusRows(agents, sessionTrees);
  return rows.map((row) =>
    row.missing
      ? `- ${row.name}: no OpenCode session configured.`
      : [
          `- ${row.name}: ${row.connected ? "connected" : "unreachable"}`,
          `  server: ${row.server}`,
          `  active session: ${row.activeTitle} — ${row.activeState}`,
          `  all sessions: ${row.total} total, ${row.working} working, ${row.errors} error${row.subagents ? `, ${row.subagents} subagent session(s)` : ""}`,
          ...(row.error ? [`  error: ${row.error}`] : []),
        ].join("\n"),
  );
};

const agentSessionChanges = async (agents, since, sessionTrees = null) => {
  const rows = [];
  await Promise.all(
    agents.map(async (agent) => {
      try {
        const tree = sessionTrees
          ? sessionTrees.get(agent.id)
          : await fetchAgentSessions(agent);
        if (!tree) return;
        for (const session of tree.all || []) {
          const updated = fileTime(session);
          if (!updated || updated < since) continue;
          rows.push({
            agent,
            session,
            updated,
            active: session.id === agent.sessionId,
            parent: tree.all.find(
              (item) =>
                item.id === (session.parentID || session.parentId),
            ),
          });
        }
      } catch {}
    }),
  );
  rows.sort((left, right) => right.updated - left.updated);
  return rows;
};

const recentAgentFiles = async (agents, since) => {
  const files = [];
  let withoutTimestamp = 0;
  await Promise.all(
    agents.map(async (agent) => {
      const rows = (
        (await readAgentFileStats(agent)) ??
        (await collectAgentFiles(agent))
      ).map((row) => ({
        ...row,
        agentId: agent.id,
        agentName: agent.name || agent.id,
      }));
      for (const row of rows) {
        const time = fileTime(row);
        if (!time) {
          withoutTimestamp += 1;
          continue;
        }
        if (time >= since) files.push({ ...row, time });
      }
    }),
  );
  files.sort((left, right) => right.time - left.time);
  return { files, withoutTimestamp };
};

const tool = (name, description, properties = {}, required = []) => ({
  type: "function",
  function: {
    name,
    description,
    parameters: {
      type: "object",
      properties,
      required,
    },
  },
});

export const META_TOOL_DEFINITIONS = [
  tool(
    "list_chats",
    "List the user's conversations with id, title, topic, pinned state, summary, per-chat settings, and last-modified time.",
  ),
  tool("list_topics", "List the user's topics (folders) with id, name, and pinned state."),
  tool(
    "get_chat",
    "Get one conversation's metadata and current settings by id.",
    { id: { type: "string", description: "Conversation id" } },
    ["id"],
  ),
  tool(
    "search_messages",
    "Search the user's stored messages and return matching excerpts with conversation and message ids.",
    { query: { type: "string", description: "Text to search for" } },
    ["query"],
  ),
  tool(
    "list_memories",
    "List the user's memory groups and saved memories with their indices and group names.",
  ),
  tool(
    "get_user_settings",
    "Get the current global user preferences, interface settings, module flags, MCP servers, and the Meta chat's own settings.",
  ),
  tool(
    "test_mcp_server",
    "Test a configured local MCP server by its id, name, or URL and report whether it is reachable.",
    { server: { type: "string", description: "MCP server id, name, or URL" } },
    ["server"],
  ),
  tool(
    "agent_health",
    "Check all agent connections and test all configured local MCP servers.",
  ),
  tool(
    "list_mcp_tools",
    "List tools exposed by one configured local MCP server.",
    { server: { type: "string", description: "MCP server id, name, or URL" } },
    ["server"],
  ),
  tool(
    "list_workspaces",
    "List the user's workspaces with ids, names, pinned state, creation and modification times, attached agent ids, attached chat ids, and source counts.",
  ),
  tool(
    "list_agents",
    "List the user's configured OpenCode agents with id, name, server URL, local/remote mode, pinned state, and creation and modification times.",
  ),
  tool(
    "check_agents",
    "Check the connection and session activity of every configured OpenCode agent.",
  ),
  tool(
    "list_agent_sessions",
    "List an OpenCode agent's sessions and subagent sessions, including which one is active. Use the ids with get_agent_history.",
    { agent: { type: "string", description: "Agent id or name" } },
    ["agent"],
  ),
  tool(
    "get_agent_history",
    "Read recent OpenCode messages for one agent session by agent id or name. Defaults to the active session; pass a session id or title from list_agent_sessions to read another session or subagent.",
    {
      agent: { type: "string", description: "Agent id or name" },
      session: { type: "string", description: "Optional session id or title" },
      limit: { type: "integer", description: "Maximum messages to return (default 40, max 100)" },
    },
    ["agent"],
  ),
  tool(
    "list_agent_files",
    "List files in one agent's OpenCode project by its id or name.",
    {
      agent: { type: "string", description: "Agent id or name" },
      path: { type: "string", description: "Project-relative folder, default empty/root" },
    },
    ["agent"],
  ),
  tool(
    "list_recent_agent_files",
    "List files recently modified in any agent's OpenCode project, sorted newest first.",
    {
      hours: { type: "integer", description: "How far back to look, default 24, max 720" },
      agent: { type: "string", description: "Optional agent id or name" },
    },
  ),
  tool(
    "search_all",
    "Search chats, messages, topics, memories, agent histories, agent file names, and agent file contents.",
    { query: { type: "string", description: "Text to search for" } },
    ["query"],
  ),
  tool(
    "get_whats_new",
    "Report changes since a timestamp: new or changed chats, topics, memories, agent status, all agent sessions and subagent sessions, and recently modified agent files.",
    {
      since: { type: "string", description: "ISO timestamp or epoch milliseconds; defaults to 24 hours ago" },
    },
  ),
  tool(
    "read_agent_file",
    "Read a UTF-8 file from one agent's OpenCode project by its id or name.",
    {
      agent: { type: "string", description: "Agent id or name" },
      path: { type: "string", description: "Project-relative file path" },
      maxChars: { type: "integer", description: "Maximum characters (default 20000, max 100000)" },
    },
    ["agent", "path"],
  ),
  tool(
    "fetch_agent_file",
    "Fetch a file from one agent's OpenCode project and attach it to this Meta chat so it can be displayed or downloaded. Use this for images, PDFs, and other binary files.",
    {
      agent: { type: "string", description: "Agent id or name" },
      path: { type: "string", description: "Project-relative file path" },
    },
    ["agent", "path"],
  ),
  tool("list_models", "List the models available in this deployment with their ids and names."),
  tool("list_personas", "List the recommended persona catalog with ids, titles, categories, and descriptions."),
  tool(
    "list_tutorials",
    "List the available feature guides and use cases, including their ids and purposes.",
  ),
  tool(
    "start_tutorial",
    "Start an in-app feature guide by its id.",
    { id: { type: "string", description: "Feature guide id" } },
    ["id"],
  ),
  tool(
    "start_use_case",
    "Start an in-app use-case walkthrough by its id.",
    { id: { type: "string", description: "Use case id" } },
    ["id"],
  ),
];

export async function getAgentFileChanges({
  agents = [],
  since: sinceInput,
} = {}) {
  const since =
    parseSince(sinceInput) || Date.now() - 24 * 60 * 60 * 1000;
  if (!agents.length) return "No connected agents.";
  const recent = await recentAgentFiles(agents, since);
  return [
    `Agent files modified since ${new Date(since).toISOString()}:`,
    ...(recent.files.length
      ? recent.files
          .slice(0, 200)
          .map(
            (file) =>
              `- ${new Date(file.time).toISOString()} — ${file.agentName}: [${file.path}](${agentFileLink({ id: file.agentId }, file.path)})${typeof file.size === "number" ? ` (${file.size} bytes)` : ""}`,
          )
      : ["(none)"]),
    ...(recent.withoutTimestamp
      ? [`(${recent.withoutTimestamp} file(s) had no timestamp metadata.)`]
      : []),
  ].join("\n");
}

export async function getWhatsNew({
  userSettings = {},
  since: sinceInput,
  scope = null,
} = {}) {
  const since =
    parseSince(sinceInput) || Date.now() - 24 * 60 * 60 * 1000;
const [rows, folders, allAgents] = await Promise.all([
  listConversationMetas(),
  listFolders(),
  Promise.resolve(getAgents()),
]);
// A workspace-scoped report (the chat sidebar) passes the ids it may show. The Meta chat
// passes no scope and keeps seeing every chat, agent and session.
const agentIds = scope?.agentIds ? new Set(scope.agentIds) : null;
const agents = agentIds
  ? allAgents.filter((agent) => agentIds.has(agent.id))
  : allAgents;
const conversationIds = scope?.conversationIds
  ? new Set(scope.conversationIds)
  : null;
const scopedSessionAgentIds = new Set(
  scope?.sessionIds ? Object.keys(scope.sessionIds) : [],
);
const chats = (rows || [])
  .filter(
    (row) =>
      !row.isMetaChat &&
      row.id !== "meta-chat" &&
      (!conversationIds || conversationIds.has(row.id)) &&
      (row.lastModified ?? row.createdAt ?? 0) >= since,
  )
  .sort(
    (left, right) =>
      (right.lastModified ?? 0) - (left.lastModified ?? 0),
  )
  .slice(0, 20);
const topics = (folders || []).filter(
  (folder) =>
    (folder.createdAt ?? 0) >= since &&
    // A scoped report only shows a topic if a chat of that scope belongs to it.
    (!conversationIds ||
      (rows || []).some(
        (row) => row.folderId === folder.id && conversationIds.has(row.id),
      )),
);
// Memories belong to the account, not to a workspace, so a scoped report omits them.
const memories = scope
  ? []
  : (userSettings.memories || []).filter((memory) => {
      const created = new Date(memory.createdAt || 0).getTime();
      return Number.isFinite(created) && created >= since;
    });
const sessionTrees = agents.length
  ? await loadAgentSessionTrees(agents)
  : new Map();
// Restrict each agent's tree to the sessions the caller may show. Agents that are absent
// from `sessionIds` (workspace bridges without session links) keep their full list.
for (const [agentId, ids] of Object.entries(scope?.sessionIds ?? {})) {
  const tree = sessionTrees.get(agentId);
  if (tree) sessionTrees.set(agentId, filterSessionTree(tree, new Set(ids)));
}
const statusRows = agents.length
  ? await agentStatusRows(agents, sessionTrees, {
      scopedAgentIds: scopedSessionAgentIds,
    })
  : [];
const sessionChanges = agents.length
  ? await agentSessionChanges(agents, since, sessionTrees)
  : [];
const recent = agents.length
  ? await recentAgentFiles(agents, since)
  : { files: [], withoutTimestamp: 0 };
const lines = [`Changes since ${new Date(since).toISOString()}:`];
let sectionCount = 0;
const addSection = (title, body) => {
  if (!body) return;
  sectionCount += 1;
  lines.push("", `### ${title}`, "", body);
};

addSection(
  "Chats",
  chats.length
    ? markdownTable(
        ["Chat", "Changed"],
        chats.map((chat) => [
          `[${chat.title || "Untitled Chat"}](/chat/${chat.id})`,
          new Date(chat.lastModified ?? chat.createdAt ?? 0).toISOString(),
        ]),
      )
    : "",
);
addSection(
  "New topics",
  topics.length
    ? markdownTable(
        ["Topic", "Id"],
        topics.map((topic) => [topic.name, topic.id]),
      )
    : "",
);
addSection(
  "New memories",
  memories.length
    ? markdownTable(
        ["Memory"],
        memories.map((memory) => [memory.text]),
      )
    : "",
);
if (statusRows.length) {
  addSection(
    "Agents",
    markdownTable(
      ["Agent", "State", "Active session", "Sessions", "Subagents"],
      statusRows.map((row) =>
        row.missing
          ? [row.name, "No session", "—", "0", "0"]
          : [
              row.name,
              row.connected ? "Connected" : "Unreachable",
              `${row.activeTitle} (${row.activeState})`,
              `${row.total} total, ${row.working} working, ${row.errors} error`,
              String(row.subagents),
            ],
      ),
    ),
  );
}
addSection(
  "New or changed agent sessions",
  sessionChanges.length
    ? markdownTable(
        ["Agent", "Session", "Active", "Parent", "Updated"],
        sessionChanges.slice(0, 100).map(
          ({ agent, session, updated, active, parent }) => [
            agent.name || agent.id,
            `[${session.title || "Untitled session"}](/agent/${agent.id}?session=${session.id})`,
            active ? "yes" : "",
            parent ? parent.title || parent.id : "",
            new Date(updated).toISOString(),
          ],
        ),
      )
    : "",
);
addSection(
  "Recently modified agent files",
  recent.files.length
    ? markdownTable(
        ["Modified", "Agent", "File", "Size"],
        recent.files.slice(0, 100).map((file) => [
          new Date(file.time).toISOString(),
          file.agentName,
          `[${file.path}](${agentFileLink({ id: file.agentId }, file.path)})`,
          typeof file.size === "number" ? `${file.size} B` : "",
        ]),
      ) +
        (recent.withoutTimestamp
          ? `\n\n${recent.withoutTimestamp} file(s) had no timestamp metadata.`
          : "")
    : "",
);
if (sectionCount === 0) lines.push("", "No changes found.");
return lines.join("\n");
}

export function createMetaToolRunner({
  userSettings,
  interfaceSettings,
  metaSettings,
  modelsData,
  memories,
}) {
  return async function runMetaTool(name, args = {}) {
    switch (name) {
      case "search_all": {
        const query = String(args.query || "").trim();
        if (!query) return "A search query is required.";
        const lower = query.toLowerCase();
        const [messages, rows, folders, agents] = await Promise.all([
          searchMessages(query).catch(() => []),
          listConversationMetas(),
          listFolders(),
          Promise.resolve(getAgents()),
        ]);
        const chatTitles = (rows || [])
          .filter(
            (row) =>
              !row.isMetaChat &&
              row.id !== "meta-chat" &&
              String(row.title || "").toLowerCase().includes(lower),
          )
          .slice(0, 20);
        const topics = (folders || []).filter((folder) =>
          String(folder.name || "").toLowerCase().includes(lower),
        );
        const memoryMatches = (userSettings.memories || []).filter((memory) =>
          String(memory.text || "").toLowerCase().includes(lower),
        );
        const agentMessageMatches = [];
        const agentFileNames = [];
        const agentFileContents = [];
        await Promise.all(
          agents.slice(0, 10).map(async (agent) => {
            if (agent.sessionId) {
              try {
                const history = await listOpencodeMessages(
                  agent,
                  agent.sessionId,
                );
                for (const message of history) {
                  const text = agentMessageText(message);
                  if (!text.toLowerCase().includes(lower)) continue;
                  agentMessageMatches.push({
                    agent,
                    messageId: message.id,
                    role: message.type,
                    text: text.slice(0, 240),
                  });
                }
              } catch {}
            }
            const stats = await readAgentFileStats(agent);
            if (stats) {
              for (const file of stats) {
                if (String(file.path).toLowerCase().includes(lower)) {
                  agentFileNames.push({ agent, file });
                }
              }
            }
            const contentLines = await searchAgentFileContents(agent, query);
            for (const line of contentLines) {
              const [path, lineNumber, ...rest] = line.split(":");
              if (!path) continue;
              agentFileContents.push({
                agent,
                path,
                line: lineNumber,
                text: rest.join(":").slice(0, 240),
              });
            }
          }),
        );
        const lines = [`Search results for “${query}”:`];
        lines.push("", "Chats:");
        lines.push(
          chatTitles.length
            ? chatTitles
                .map((chat) => `- [${chat.title || "Untitled Chat"}](/chat/${chat.id})`)
                .join("\n")
            : "(none)",
        );
        lines.push("", "Messages:");
        lines.push(
          (messages || []).length
            ? (messages || [])
                .slice(0, 20)
                .map(
                  (match) =>
                    `- [${match.conversationTitle || "Untitled Chat"}](/chat/${match.conversationId}?message=${match.messageId}) — ${match.snippet}`,
                )
                .join("\n")
            : "(none)",
        );
        lines.push("", "Topics:");
        lines.push(
          topics.length
            ? topics
                .map((topic) => `- [${topic.name || "Untitled topic"}](/topic/${topic.id})`)
                .join("\n")
            : "(none)",
        );
        lines.push("", "Memories:");
        lines.push(
          memoryMatches.length
            ? memoryMatches.map((memory) => `- ${memory.text}`).join("\n")
            : "(none)",
        );
        lines.push("", "Agent messages:");
        lines.push(
          agentMessageMatches.length
            ? agentMessageMatches
                .slice(0, 30)
                .map(
                  (match) =>
                    `- [${match.agent.name || match.agent.id}, ${match.role}](/agent/${match.agent.id}?message=${match.messageId}) — ${match.text}`,
                )
                .join("\n")
            : "(none)",
        );
        lines.push("", "Agent files:");
        lines.push(
          agentFileNames.length
            ? agentFileNames
                .slice(0, 30)
                .map(
                  (match) =>
                    `- ${match.agent.name || match.agent.id}: [${match.file.path}](${agentFileLink(match.agent, match.file.path)}) (${match.file.size ?? "?"} bytes)`,
                )
                .join("\n")
            : "(none)",
        );
        lines.push("", "Agent file contents:");
        lines.push(
          agentFileContents.length
            ? agentFileContents
                .slice(0, 50)
                .map(
                  (match) =>
                    `- ${match.agent.name || match.agent.id}: ${match.path}:${match.line} — ${match.text}`,
                )
                .join("\n")
            : "(none)",
        );
        return lines.join("\n");
      }

      case "list_chats": {
        const [rows, folders] = await Promise.all([
          listConversationMetas(),
          listFolders(),
        ]);
        const topics = (folders || []).map((folder) => ({
          id: folder.id,
          name: (folder.name || "").trim() || "Untitled topic",
          pinned: folder.pinned === true,
        }));
        const conversations = (rows || [])
          .filter((row) => row?.id && !row.isMetaChat && row.id !== "meta-chat")
          .sort(
            (a, b) =>
              (b.lastModified ?? b.createdAt ?? 0) -
              (a.lastModified ?? a.createdAt ?? 0),
          )
          .map((row) => ({
            id: row.id,
            title: (row.title || "").trim() || "Untitled Chat",
            summary: (row.summary || "").trim(),
            folderId: row.folderId ?? null,
            pinned: row.pinned === true,
            lastModified: row.lastModified ?? row.createdAt ?? 0,
            settingsSummary: buildConversationSettingsSummary(row.settings),
          }));
        return conversationLines(conversations, topics);
      }

      case "list_topics": {
        const folders = await listFolders();
        return topicLines(
          (folders || []).map((folder) => ({
            id: folder.id,
            name: (folder.name || "").trim() || "Untitled topic",
            pinned: folder.pinned === true,
          })),
        );
      }

      case "get_chat": {
        const conversation = await getConversationMeta(String(args.id || ""));
        if (!conversation) return "Conversation not found.";
        return `id: ${conversation.id}\ntitle: ${conversation.title || "Untitled Chat"}\ntopic: ${conversation.folderId || "Unsorted"}\npinned: ${conversation.pinned ? "yes" : "no"}\nsummary: ${conversation.summary || "(no summary)"}\nper-chat settings: ${buildConversationSettingsSummary(conversation.settings)}`;
      }

      case "search_messages": {
        const query = String(args.query || "").trim();
        if (!query) return "A search query is required.";
        const [matches, folders, recent] = await Promise.all([
          searchMessages(query).catch(() => []),
          listFolders(),
          /\b(decisions?|action items?|next steps?|todos?|compare|comparison|agreed|beschlossen|entscheid|aufgaben|nächste schritte|vereinbart|vergleich)\b/i.test(
            query,
          )
            ? getRecentMessageExcerpts().catch(() => [])
            : Promise.resolve([]),
        ]);
        const topics = (folders || []).map((folder) => ({
          id: folder.id,
          name: (folder.name || "").trim() || "Untitled topic",
        }));
        const seen = new Set();
        const combined = [...(matches || []), ...(recent || [])].filter((match) => {
          if (!match?.messageId || seen.has(match.messageId)) return false;
          seen.add(match.messageId);
          return true;
        });
        return messageLines(combined, topics);
      }

      case "list_memories": {
        const memoryGroups = memoryGroupsFor(userSettings);
        const groupLines = memoryGroups.map((group) => {
          const count = (memories || []).filter(
            (memory) => (memory.groupId ?? "default") === group.id,
          ).length;
          return `- ${group.name} (${count} memories)`;
        });
        const defaultGroupId = userSettings.default_memory_group ?? "default";
        const groupOverride = metaSettings?.memory_group_override;
        const requestedGroup =
          groupOverride && groupOverride !== "default"
            ? groupOverride
            : defaultGroupId;
        const effectiveGroupId =
          requestedGroup === "default" ||
          memoryGroups.some((group) => group.id === requestedGroup)
            ? requestedGroup
            : "default";
        const lines = (memories || [])
          .map((memory, index) => {
            const text = String(memory?.text || "").trim();
            if (!text) return "";
            const groupId = memory?.groupId ?? "default";
            return `- index: ${index}\n  group: ${memoryGroupName(userSettings, groupId)}\n  text: ${text}`;
          })
          .filter(Boolean);
        return [
          `Default memory group: ${memoryGroupName(userSettings, defaultGroupId)}`,
          `This chat's effective memory group: ${memoryGroupName(userSettings, effectiveGroupId)}`,
          "",
          "Memory groups:",
          groupLines.join("\n"),
          "",
          "Memories:",
          lines.join("\n") || "(no saved memories)",
        ].join("\n");
      }

      case "get_user_settings": {
        return [
          ...buildSettingsLines(userSettings, interfaceSettings),
          `- Meta chat settings: ${buildConversationSettingsSummary(metaSettings)}`,
        ].join("\n");
      }

      case "test_mcp_server": {
        const target = String(args.server || "").trim();
        const server = (userSettings.mcp_servers ?? []).find(
          (item) =>
            item?.id === target ||
            item?.name === target ||
            item?.url === target,
        );
        if (!server) return "MCP server not found.";
        if (server.kind !== "local" || !normalizeMcpUrl(server.url)) {
          return "This MCP server cannot be tested from the browser.";
        }
        try {
          const result = await testMcpServer({
            url: normalizeMcpUrl(server.url),
            headers: server.headers,
            enabled: true,
          });
          window.dispatchEvent(
            new CustomEvent("chatai:mcp-status", {
              detail: { id: server.id, status: "ready" },
            }),
          );
          return `Connected: ${result.name} (${result.toolCount} tools).`;
        } catch (error) {
          window.dispatchEvent(
            new CustomEvent("chatai:mcp-status", {
              detail: { id: server.id, status: "error" },
            }),
          );
          return `Connection failed: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      }

      case "agent_health": {
        const agents = getAgents();
        const servers = (userSettings.mcp_servers || []).filter(
          (server) => server.kind === "local" && normalizeMcpUrl(server.url),
        );
        const statusLines = agents.length
          ? (await agentStatusLines(agents)).join("\n")
          : "No agents configured.";
        const mcpLines = await Promise.all(
          servers.slice(0, 20).map(async (server) => {
            try {
              const result = await testMcpServer({
                url: normalizeMcpUrl(server.url),
                headers: server.headers,
                enabled: true,
              });
              return `- ${server.name || server.id}: connected (${result.name}, ${result.toolCount} tools)`;
            } catch (error) {
              return `- ${server.name || server.id}: unreachable — ${
                error instanceof Error ? error.message : String(error)
              }`;
            }
          }),
        );
        return [
          "Agents:",
          statusLines,
          "",
          "Local MCP servers:",
          mcpLines.length ? mcpLines.join("\n") : "(none configured)",
        ].join("\n");
      }

      case "list_mcp_tools": {
        const target = String(args.server || "").trim();
        const server = (userSettings.mcp_servers || []).find(
          (item) =>
            item?.id === target ||
            item?.name === target ||
            item?.url === target,
        );
        if (!server) return "MCP server not found.";
        if (server.kind !== "local" || !normalizeMcpUrl(server.url)) {
          return "This MCP server has no browser-reachable URL.";
        }
        try {
          const tools = await listMcpServerTools({
            url: normalizeMcpUrl(server.url),
            headers: server.headers,
            enabled: true,
          });
          return tools
            .map(
              (tool) =>
                `- ${tool.name}${tool.title ? ` (${tool.title})` : ""}: ${tool.description || "no description"}`,
            )
            .join("\n") || "(no tools)";
        } catch (error) {
          return `Could not list MCP tools: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      }

      case "list_workspaces": {
        const workspaces = await listWorkspaceSummaries();
        if (!workspaces.length) return "No workspaces configured.";
        return workspaces
          .map(
            (workspace) =>
              `- id: ${workspace.id}\n  name: ${workspace.name}\n  pinned: ${workspace.pinned ? "yes" : "no"}\n  created: ${formatToolTimestamp(workspace.createdAt)}\n  modified: ${formatToolTimestamp(workspace.lastModified)}\n  agents: ${workspace.agentIds.join(", ") || "none"}\n  chats: ${workspace.conversationIds.join(", ") || "none"}\n  sources: ${workspace.sourceCount}`,
          )
          .join("\n");
      }

      case "list_agents": {
        const agents = getAgents();
        if (!agents.length) return "No agents configured.";
        return agents
          .map(
            (agent) =>
              `- id: ${agent.id}
  name: ${agent.name || agent.id}
  server: ${agent.serverUrl}
  mode: ${agent.local === false ? "remote" : "local"}
  pinned: ${agent.pinned === true ? "yes" : "no"}
  created: ${formatToolTimestamp(agent.createdAt)}
  modified: ${formatToolTimestamp(agent.updatedAt ?? agent.createdAt)}`,
          )
          .join("\n");
      }

      case "check_agents": {
        const agents = getAgents();
        if (!agents.length) return "No agents configured.";
        return (await agentStatusLines(agents)).join("\n");
      }

      case "get_whats_new":
        return getWhatsNew({ userSettings, since: args.since });

      case "list_agent_sessions": {
        const agent = findAgent(args.agent);
        if (!agent) return "Agent not found.";
        if (!agent.sessionId) return "This agent has no OpenCode session.";
        try {
          const tree = await fetchAgentSessions(agent);
          const lines = agentSessionLines(agent, tree);
          return `Agent: ${agent.name || agent.id}
Active session: ${agent.sessionId}
Sessions:\n${lines.join("\n") || "(no sessions)"}`;
        } catch (error) {
          return `Could not list the agent sessions: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      }

      case "get_agent_history": {
        const agent = findAgent(args.agent);
        if (!agent) return "Agent not found.";
        if (!agent.sessionId) return "This agent has no OpenCode session.";
        const sessionId = await findAgentSession(agent, args.session);
        if (!sessionId) return "Agent session not found.";
        const limit = Math.min(
          100,
          Math.max(1, Number.parseInt(args.limit, 10) || 40),
        );
        let messages;
        try {
          messages = await listOpencodeMessages(agent, sessionId);
        } catch (error) {
          return `Could not read the agent history: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
        const lines = [];
        for (const message of messages.slice(-limit)) {
          const text = agentMessageText(message);
          if (!text) continue;
          lines.push(
            `- id: ${message.id}\n  role: ${message.type}\n  text: ${text.slice(0, 12000)}`,
          );
        }
        return `Agent: ${agent.name || agent.id}\nsession: ${sessionId}${sessionId !== agent.sessionId ? " (not active)" : ""}\nHistory (${lines.length} messages):\n${lines.join("\n") || "(no messages)"}`;
      }

      case "list_agent_files": {
        const agent = findAgent(args.agent);
        if (!agent) return "Agent not found.";
        const path = String(args.path || "").replace(/^\/+/, "");
        try {
          const rows = await listOpencodeFiles(agent, path);
          return rows
            .map((entry) => {
              const time = fileTime(entry);
              return `- ${entry.type === "directory" ? "dir " : "file"} [${entry.path}](${agentFileLink(agent, entry.path)})${typeof entry.size === "number" ? ` (${entry.size} bytes)` : ""}${time ? ` — ${new Date(time).toISOString()}` : ""}`;
            })
            .join("\n") || "(empty folder)";
        } catch (error) {
          return `Could not list agent files: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      }

      case "list_recent_agent_files": {
        const hours = Math.min(
          720,
          Math.max(1, Number.parseInt(args.hours, 10) || 24),
        );
        const since = Date.now() - hours * 60 * 60 * 1000;
        const agents = args.agent
          ? [findAgent(args.agent)].filter(Boolean)
          : getAgents();
        if (!agents.length) return "Agent not found.";
        const files = [];
        let withoutTimestamp = 0;
        await Promise.all(
          agents.map(async (agent) => {
            const rows = (
              (await readAgentFileStats(agent)) ??
              (await collectAgentFiles(agent))
            ).map((row) => ({
              ...row,
              agentId: agent.id,
              agentName: agent.name || agent.id,
            }));
            for (const row of rows) {
              const time = fileTime(row);
              if (!time) {
                withoutTimestamp += 1;
                continue;
              }
              if (time >= since) files.push({ ...row, time });
            }
          }),
        );
        files.sort((left, right) => right.time - left.time);
        if (!files.length) {
          return `No agent files modified in the last ${hours} hours.${
            withoutTimestamp
              ? ` ${withoutTimestamp} file(s) had no timestamp metadata.`
              : ""
          }`;
        }
        return [
          `Agent files modified in the last ${hours} hours:`,
          ...files.slice(0, 100).map(
            (file) =>
              `- ${new Date(file.time).toISOString()} — ${file.agentName}: ${file.path}${typeof file.size === "number" ? ` (${file.size} bytes)` : ""}`,
          ),
          ...(withoutTimestamp
            ? [`(${withoutTimestamp} file(s) had no timestamp metadata.)`]
            : []),
        ].join("\n");
      }

      case "read_agent_file": {
        const agent = findAgent(args.agent);
        if (!agent) return "Agent not found.";
        const path = String(args.path || "").trim();
        if (!path) return "A file path is required.";
        const maxChars = Math.min(
          100000,
          Math.max(1, Number.parseInt(args.maxChars, 10) || 20000),
        );
        try {
          const { blob, type } = await readOpencodeFile(agent, path);
          if (blob.size > 2 * 1024 * 1024) {
            return `File is too large to read (${blob.size} bytes).`;
          }
          const text = await blob.text();
          if (text.includes("\u0000")) {
            return `File appears to be binary (${type || "unknown type"}, ${blob.size} bytes).`;
          }
          return text.slice(0, maxChars) || "(empty file)";
        } catch (error) {
          return `Could not read the agent file: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      }

      case "fetch_agent_file": {
        const agent = findAgent(args.agent);
        if (!agent) return "Agent not found.";
        const path = String(args.path || "").trim();
        if (!path) return "A file path is required.";
        try {
          const { blob, type } = await readOpencodeFile(agent, path);
          if (blob.size > 10 * 1024 * 1024) {
            return `File is too large to attach (${blob.size} bytes).`;
          }
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let binary = "";
          for (let index = 0; index < bytes.length; index += 0x8000) {
            binary += String.fromCharCode(
              ...bytes.subarray(index, index + 0x8000),
            );
          }
          return {
            summary: `Fetched ${path} (${type || "application/octet-stream"}, ${blob.size} bytes).`,
            attachment: {
              name: path.split("/").filter(Boolean).pop() || path,
              mime: type || "application/octet-stream",
              base64: btoa(binary),
            },
          };
        } catch (error) {
          return `Could not fetch the agent file: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      }

      case "list_models": {
        return (
          (modelsData || [])
            .map((model) => `- id: ${model.id}\n  name: ${model.name || model.id}`)
            .join("\n") || "(no models available)"
        );
      }

      case "list_personas": {
        const personas = await loadPersonaCatalog().catch(() => []);
        return personaLines(personas);
      }

      case "list_tutorials": {
        return `<feature_guides>\n${buildFeatureGuidePrompt()}\n</feature_guides>\n\n<use_cases>\n${buildUseCasePrompt()}\n</use_cases>`;
      }

      case "start_tutorial": {
        const id = String(args.id || "").trim();
        if (!featureGuides[id]) return "Feature guide not found.";
        window.dispatchEvent(
          new CustomEvent("chatai:start-feature-guide", { detail: { featureId: id } }),
        );
        return `Started the feature guide ${id}.`;
      }

      case "start_use_case": {
        const id = String(args.id || "").trim();
        if (!useCases[id]) return "Use case not found.";
        window.dispatchEvent(
          new CustomEvent("chatai:start-use-case", { detail: { useCaseId: id } }),
        );
        return `Started the use case ${id}.`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  };
}
