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
import { remoteMcpEnabled } from "../agent/mcp";

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
                `${server.name || server.url || server.serverId} (${server.kind})`,
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
    `- Modules: tools ${import.meta.env.VITE_MODULE_TOOLS === "true" ? "enabled" : "disabled"}, feedback ${import.meta.env.VITE_MODULE_FEEDBACK === "true" ? "enabled" : "disabled"}, choices ${import.meta.env.VITE_MODULE_CHOICES === "true" ? "enabled" : "disabled"}, arcanas ${import.meta.env.VITE_MODULE_ARCANAS !== "false" ? "enabled" : "disabled"}, agents ${import.meta.env.VITE_MODULE_AGENTS !== "false" ? "enabled" : "disabled"}, speech ${import.meta.env.VITE_MODULE_SPEECH === "true" ? "enabled" : "disabled"}`,
    `- Dark mode: ${yesNo(interfaceSettings.dark_mode)}`,
    `- Show usage in sidebar: ${yesNo(interfaceSettings.show_usage_in_sidebar)}`,
    `- Chat sorting: ${interfaceSettings.conversation_sort ?? "created_desc"}`,
    `- Chat grouping: ${interfaceSettings.conversation_grouping ?? "topic"}`,
    `- Web search disclaimer accepted: ${yesNo(interfaceSettings.agree_web_search)}`,
    `- Show welcome tour: ${yesNo(interfaceSettings.show_tour)}`,
    `- Confirmation warnings: clear history ${yesNo(interfaceSettings.warn_clear_history)}, close chat ${yesNo(interfaceSettings.warn_close_chat)}, share settings ${yesNo(interfaceSettings.warn_share_settings)}, regenerate ${yesNo(interfaceSettings.warn_regenerate)}, fork ${yesNo(interfaceSettings.warn_fork)}`,
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
    "Get the current global user preferences, interface settings, module flags, and the Meta chat's own settings.",
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

export function createMetaToolRunner({
  userSettings,
  interfaceSettings,
  metaSettings,
  modelsData,
  memories,
}) {
  return async function runMetaTool(name, args = {}) {
    switch (name) {
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
