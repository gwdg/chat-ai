import {
  arcanaIdEntered,
  attachmentProcessed,
  ensureTool,
  ensureToolsEnabled,
  hasAttachmentCard,
  isToolActive,
  mcpConfigured,
  openAgentMenu,
  openAgentRecovery,
  openChatWorkspaces,
  openConversationMenu,
  openConversationSettings,
  openSearch,
  openSortMenu,
  openTools,
  openTopicCreate,
  openTopicMenu,
  openWorkspaceMenu,
  openWorkspaceAgents,
  openWorkspaceFiles,
  openUserSettings,
  searchHasQuery,
  selectDataSection,
  selectProfileSection,
  selectSettingsTab,
  toolsAreEnabled,
  topicNameEntered,
} from "./featureGuideActions.js";
import {
  isAgentEnabled,
  isAgentsEnabled,
  isArcanasEnabled,
  isSpeechEnabled,
  isSyncEnabled,
  isToolsEnabled,
} from "../utils/modules.js";
import { isFeatureEnabled } from "./deployment.js";
import { hasBrandInstitute, isBrandLocked, isBrandUiVisible } from "./brandPolicy.js";
import { canInstallApp } from "../utils/installPrompt.js";
import { isFeedbackReportEnabled, isChatFeedbackEnabled } from "../apis/feedback.js";
import { currentBrand } from "./brands.js";
import { brandConsentGate } from "./consent.js";
import { brandFeatureFlag } from "./brandFeatures.js";

export const featureGuides = {
  workspace_overview: {
    titleKey: "feature_guide.workspace_overview.title",
    prompt:
      "Open a workspace from the sidebar. A workspace is the home of the chats you run there: a prompt box starts a new chat, the list holds the ones already in it, and the right-hand panel shows what's new, the files the workspace stores, and the agent it runs.",
    keywords: ["workspace", "workspaces", "files", "browser storage", "local folder", "arcana files", "mcp files"],
    steps: [
      {
        target: '[data-guide="meta-tab-files"]',
        textKey: "feature_guide.workspace_overview.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="workspace-add-source"]',
        textKey: "feature_guide.workspace_overview.step2",
        prepare: openWorkspaceFiles,
      },
      {
        target: '[data-guide="workspace-files"]',
        textKey: "feature_guide.workspace_overview.step3",
        prepare: openWorkspaceFiles,
      },
      {
        target: '[data-guide="workspace-agent"]',
        textKey: "feature_guide.workspace_overview.step4",
        prepare: openWorkspaceAgents,
      },
    ],
  },
  manage_chat_data: {
    titleKey: "feature_guide.manage_chat_data.title",
    prompt:
      "Open the Workspace menu in the prompt box of a chat that belongs to a workspace. Access storage sits at the top: it is on by default and with it off the model gets no file tools. Manage Workspace is where this chat keeps its files: with one workspace it opens that workspace's editor — the same dialog as Create workspace, with its storage locations, its name, icon and colour, and Apply Changes — and with several the chevron turns the menu into a list of the attached workspaces, each one opening the same editor, with a back arrow to return to the settings. A chat that belongs to no workspace has no Workspace menu at all; attach it from the workspace itself.",
    keywords: [
      "manage workspace",
      "manage data",
      "access storage",
      "chat files",
      "browser storage",
      "opfs",
      "file system",
      "storage off",
    ],
    steps: [
      {
        target: '[data-guide="access-storage"]',
        textKey: "feature_guide.manage_chat_data.step1",
        prepare: openChatWorkspaces,
      },
      {
        target: '[data-guide="manage-workspace"]',
        textKey: "feature_guide.manage_chat_data.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  workspace_edit_storage: {
    titleKey: "feature_guide.workspace_edit_storage.title",
    prompt:
      "Manage a workspace that already exists. Open the workspace's options menu in the sidebar and choose Manage Workspace: it is Create workspace with the fields filled in, so you rename the workspace, change its icon and colour, and work on the same storage locations rail — browser storage, this device, Arcanas, the SAIA account folder and MCP servers — mount a folder, or add a local folder, a Git repository or an MCP server.",
    keywords: [
      "edit storage",
      "workspace storage",
      "add folder to workspace",
      "add source to workspace",
      "workspace sources",
      "mount folder later",
    ],
    steps: [
      {
        target: '[data-guide="workspace-menu"]',
        textKey: "feature_guide.workspace_edit_storage.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="workspace-manage"]',
        prepare: openWorkspaceMenu,
        textKey: "feature_guide.workspace_edit_storage.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  workspace_clone: {
    titleKey: "feature_guide.workspace_clone.title",
    prompt:
      "Create a workspace from a public Git repository. Choose Clone Git repository, select a local OpenCode agent for the real git clone, and pick a writable storage target. If the repository contains chat-ai-manifest.json, review the confirmation summary before any agent or chats are created.",
    keywords: ["clone repository", "import repository", "github workspace", "workspace manifest", "git clone", "chat-ai-manifest"],
    steps: [
      {
        target: '[data-guide="workspace-add-source"]',
        textKey: "feature_guide.workspace_clone.step1",
        completeOnTargetClick: true,
        prepare: openWorkspaceFiles,
      },
    ],
  },
  workspace_upload: {
    titleKey: "feature_guide.workspace_upload.title",
    prompt:
      "Upload a file from your computer into a workspace. Open a workspace and use Add file in the file browser; it writes into the folder you are viewing.",
    keywords: ["upload file", "workspace upload", "add file to workspace", "local file"],
    steps: [
      {
        target: '[data-guide="workspace-upload"]',
        textKey: "feature_guide.workspace_upload.step1",
        completeOnTargetClick: true,
        prepare: openWorkspaceFiles,
      },
      {
        target: '[data-guide="workspace-files"]',
        textKey: "feature_guide.workspace_upload.step2",
        prepare: openWorkspaceFiles,
      },
    ],
  },
  workspace_multiselect: {
    titleKey: "feature_guide.workspace_multiselect.title",
    prompt:
      "Select several files or folders in a workspace browser to delete or move them at once. Tick the checkbox that appears next to each entry, or use Select all in the toolbar, then move or delete the whole selection from the bar above the list.",
    keywords: [
      "delete workspace file",
      "remove file from workspace",
      "delete workspace folder",
      "trash workspace file",
    ],
    steps: [
      {
        target: '[data-guide="meta-tab-files"]',
        textKey: "feature_guide.workspace_multiselect.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="workspace-files"]',
        textKey: "feature_guide.workspace_multiselect.step2",
        prepare: openWorkspaceFiles,
      },
    ],
  },
  arcana_filesystem: {
    titleKey: "feature_guide.arcana_filesystem.title",
    prompt:
      "Every workspace includes an Arcana filesystem source. It lists every Arcana as a folder, and each collection's files inside it.",
    keywords: ["arcana filesystem", "arcana files", "browse arcanas", "arcana folder"],
    steps: [
      {
        target: '[data-guide="meta-tab-files"]',
        textKey: "feature_guide.arcana_filesystem.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="workspace-files"]',
        textKey: "feature_guide.arcana_filesystem.step2",
        prepare: openWorkspaceFiles,
      },
    ],
  },
  workspace_saia_fs: {
    titleKey: "feature_guide.workspace_saia_fs.title",
    prompt:
      "Chat AI can show your SAIA account folder as a filesystem inside a workspace. It only appears while this deployment's saia-fs service answers its health check, which Chat AI runs when a workspace's storage opens. Open Create workspace: the Sources rail lists it next to browser storage, this device, Arcanas and MCP servers, and you can mount one of its folders into the workspace.",
    keywords: [
      "saia files",
      "saia filesystem",
      "account folder",
      "saia-fs",
      "workspace files",
      "mount folder",
    ],
    steps: [
      {
        target: '[data-guide="workspace-add-source"]',
        textKey: "feature_guide.workspace_saia_fs.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="workspace-source-saia-fs"]',
        textKey: "feature_guide.workspace_saia_fs.step2",
      },
    ],
  },
  attach_from_workspace: {
    titleKey: "feature_guide.attach_from_workspace.title",
    prompt:
      "Attach a file from a workspace to the current chat. Attach the chat to a workspace with the workspace button in the prompt box, then click the attach button and choose From workspace to pick a file from the tree.",
    keywords: ["attach from workspace", "workspace file", "workspace attachment", "workspace tree"],
    steps: [
      {
        target: '[data-guide="chat-workspaces"]',
        textKey: "feature_guide.attach_from_workspace.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="attach-file"]',
        textKey: "feature_guide.attach_from_workspace.step2",
        check: hasAttachmentCard,
      },
      {
        target: '[data-guide="send"]',
        textKey: "feature_guide.attach_from_workspace.step3",
        completeOnEvent: "message-complete",
      },
    ],
  },
  agent_recovery: {
    titleKey: "feature_guide.agent_recovery.title",
    prompt:
      "Open the agent's tools from the composer. Exports fall back to the local cache when the agent server is unreachable, and Recovery can write the cached transcript into the instructions of a new session.",
    keywords: [
      "agent recovery",
      "recover agent",
      "cached agent history",
      "restore agent session",
      "agent offline",
      "export cached history",
    ],
    steps: [
      {
        target: '[data-guide="agent-tools-button"]',
        textKey: "feature_guide.agent_recovery.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="agent-recovery"]',
        textKey: "feature_guide.agent_recovery.step2",
        prepare: openAgentRecovery,
      },
      {
        target: '[data-guide="agent-recovery-restore"]',
        textKey: "feature_guide.agent_recovery.step3",
      },
    ],
  },
  remote_agents: {
    titleKey: "feature_guide.remote_agents.title",
    prompt:
      "Spawn a remote agent from the Agents section in the sidebar. An agent runs either on the GWDG HPC agentic service, where you pick one of your HPC projects, or on an OpenCode server you connect with its URL and password. Expand an agent to switch between its sessions and subagent sessions, or use + to create a new session.",
    keywords: ["agent", "agents", "remote agent", "hpc project", "gwdg infrastructure", "external opencode server", "agent session", "subagent", "new session"],
    steps: [
      {
        target: '[data-guide="agents-spawn"]',
        textKey: "feature_guide.remote_agents.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="agents-list"]',
        textKey: "feature_guide.remote_agents.step2",
      },
      {
        target: '[data-guide="agent-clear-history"]',
        textKey: "feature_guide.remote_agents.step3",
      },
    ],
  },
  close_group_sessions: {
    titleKey: "feature_guide.close_group_sessions.title",
    prompt:
      "Close every session of an agent inside one sidebar group, such as a workspace or “Unassigned sessions”. Running turns are interrupted first, and the action always asks for confirmation in a dialog.",
    keywords: [
      "close all sessions",
      "close group sessions",
      "stop agent sessions",
      "close workspace sessions",
      "close unassigned sessions",
    ],
    steps: [
      {
        target: '[data-guide="agents-list"]',
        textKey: "feature_guide.close_group_sessions.step1",
      },
      {
        target: '[data-guide="close-group-sessions"]',
        textKey: "feature_guide.close_group_sessions.step2",
      },
    ],
  },
  session_workspaces: {
    titleKey: "feature_guide.session_workspaces.title",
    prompt:
      "Move an agent session between workspaces by dragging its row onto another workspace group under the same expanded agent. The session is detached from the source workspace and attached to the target, which is the same move the session row's “…” menu offers. A session can also be attached from the workspace's own “…” menu.",
    keywords: [
      "move session",
      "drag session",
      "drag and drop session",
      "session workspace",
      "attach session",
      "attach agent session",
      "detach session",
    ],
    steps: [
      {
        target: '[data-guide="agents-list"]',
        textKey: "feature_guide.session_workspaces.step1",
      },
      {
        target: '[data-guide="agent-session-group"]',
        textKey: "feature_guide.session_workspaces.step2",
      },
      {
        target: '[data-guide="attach-agent-session-menu-item"]',
        prepare: openWorkspaceMenu,
        textKey: "feature_guide.session_workspaces.step3",
      },
    ],
  },
  agent_workspace_access: {
    titleKey: "feature_guide.agent_workspace_access.title",
    prompt:
      "Open an agent, then open the workspace button next to its prompt box and switch on Agent workspace access. While it is on, Chat AI keeps a reverse proxy (the agent bridge) to the browser open, so the agent can list, read and optionally write the files of the workspace chosen there.",
    keywords: [
      "agent workspace access",
      "agent bridge",
      "workspace access",
      "agent files",
      "reverse proxy",
      "allow writes",
      "mcp tools",
      "inject mcp",
    ],
    steps: [
      {
        target: '[data-guide="agent-files"]',
        textKey: "feature_guide.agent_workspace_access.step1",
      },
      {
        target: '[data-guide="agent-workspaces"]',
        textKey: "feature_guide.agent_workspace_access.step2",
      },
      {
        target: '[data-guide="agent-workspaces"]',
        textKey: "feature_guide.agent_workspace_access.step3",
      },
    ],
  },
  attach_media: {
    titleKey: "feature_guide.attach_media.title",
    prompt:
      "Attach an image, audio, or video to a message. The media button appears only when the selected model supports that input type.",
    keywords: ["attach an image", "attach media", "upload an image", "upload media", "photo", "picture"],
    steps: [
      {
        target: '[data-guide="attach-media"]',
        textKey: "feature_guide.attach_media.step1",
        completeOnTargetClick: true,
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.attach_media.step2",
        check: hasAttachmentCard,
      },
      {
        target: '[data-guide="send"]',
        textKey: "feature_guide.attach_media.step3",
        completeOnEvent: "message-complete",
      },
    ],
  },
  upload_file: {
    titleKey: "feature_guide.upload_file.title",
    prompt:
      "Attach a file to the current chat. The paperclip button in the prompt box opens the file picker. After attaching, PDF and DOCX files may need to be processed, unless the selected model supports binary file input. Then add a message and send it.",
    keywords: ["attach", "attachment", "upload"],
    steps: [
      {
        target: '[data-guide="attach-file"]',
        textKey: "feature_guide.upload_file.step1",
        completeOnTargetClick: true,
      },
      {
        target: ['[data-guide="attachment-card"]', ".prompt-area"],
        textKey: "feature_guide.upload_file.step2",
        check: hasAttachmentCard,
      },
      {
        target: '[data-guide="send"]',
        textKey: "feature_guide.upload_file.step3",
        completeOnEvent: "message-complete",
      },
    ],
  },
  process_attachment: {
    titleKey: "feature_guide.process_attachment.title",
    prompt:
      "Process a PDF or DOCX attachment before sending it. The attachment card offers browser or server conversion depending on the document-conversion preference.",
    keywords: ["process file", "process attachment", "convert pdf", "convert docx"],
    steps: [
      {
        target: ['[data-guide="attachment-card"]', '[data-guide="attach-file"]'],
        textKey: "feature_guide.process_attachment.step1",
        check: hasAttachmentCard,
      },
      {
        target: '[data-guide="process-file"]',
        textKey: "feature_guide.process_attachment.step2",
        check: attachmentProcessed,
      },
      {
        target: '[data-guide="send"]',
        textKey: "feature_guide.process_attachment.step3",
        completeOnEvent: "message-complete",
      },
    ],
  },
  select_model: {
    titleKey: "feature_guide.select_model.title",
    prompt:
      "Choose the model for a conversation from the model selector in the prompt box or the header on small screens.",
    keywords: ["change model", "switch model", "select model", "which model"],
    steps: [
      {
        target: [".model-selector", ".model-selector-header"],
        textKey: "feature_guide.select_model.step1",
        completeOnTargetClick: true,
      },
    ],
  },
  conversation_settings: {
    titleKey: "feature_guide.conversation_settings.title",
    prompt:
      "Open per-conversation settings to change the system prompt, temperature, top_p, reasoning effort, and memory mode.",
    keywords: ["conversation settings", "temperature", "top p", "system prompt", "reasoning effort"],
    steps: [
      {
        target: ".settings-toggle",
        textKey: "feature_guide.conversation_settings.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="conversation-settings-panel"]',
        prepare: openConversationSettings,
        textKey: "feature_guide.conversation_settings.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  voice_input: {
    titleKey: "feature_guide.voice_input.title",
    prompt:
      "Record a voice message with the microphone button. The browser asks for microphone permission the first time.",
    keywords: ["microphone", "voice input", "record audio", "dictate"],
    steps: [
      {
        target: '[data-guide="mic"]',
        textKey: "feature_guide.voice_input.step1",
        completeOnTargetClick: true,
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.voice_input.step2",
        completeOnEvent: "message-complete",
      },
    ],
  },
  send_key: {
    titleKey: "feature_guide.send_key.title",
    prompt:
      "Choose whether Enter or Shift+Enter sends a message in the user's chat preferences.",
    keywords: ["send key", "submit key", "shift enter", "press enter"],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.send_key.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-chat"]',
        prepare: () => selectSettingsTab("chat"),
        textKey: "feature_guide.send_key.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="submission-preference"]',
        prepare: () => selectSettingsTab("chat"),
        textKey: "feature_guide.send_key.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  arcana: {
    titleKey: "feature_guide.arcana.title",
    prompt:
      "Use Arcana for retrieval-augmented generation (RAG). Open Tools, enable tools, select Arcana, then enter the Arcana ID and key.",
    keywords: ["arcana", "rag", "retrieval", "knowledge base", "knowledge"],
    steps: [
      {
        target: '[data-guide="tools"]',
        textKey: "feature_guide.arcana.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="tools-enable"]',
        prepare: openTools,
        textKey: "feature_guide.arcana.step2",
        check: toolsAreEnabled,
      },
      {
        target: '[data-guide="tool-arcana"]',
        prepare: ensureToolsEnabled,
        textKey: "feature_guide.arcana.step3",
        check: () => isToolActive("arcana"),
      },
      {
        target: '[data-guide="arcana-id"]',
        prepare: () => ensureTool("arcana"),
        textKey: "feature_guide.arcana.step4",
        check: arcanaIdEntered,
      },
    ],
  },
  web_search: {
    titleKey: "feature_guide.web_search.title",
    prompt:
      "Use Web Search from GWDG Tools. Enable tools first, then select Web Search and accept the disclaimer.",
    keywords: ["web search", "search the web", "internet search"],
    steps: [
      {
        target: '[data-guide="tools"]',
        textKey: "feature_guide.web_search.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="tools-enable"]',
        prepare: openTools,
        textKey: "feature_guide.web_search.step2",
        check: toolsAreEnabled,
      },
      {
        target: '[data-guide="tool-web_search"]',
        prepare: ensureToolsEnabled,
        textKey: "feature_guide.web_search.step3",
        check: () => isToolActive("web_search"),
      },
    ],
  },
  image_generation: {
    titleKey: "feature_guide.image_generation.title",
    prompt:
      "Generate images with GWDG Tools. Open Tools, enable tools, then select Image Generation.",
    keywords: ["image generation", "generate image", "create image", "text to image"],
    steps: [
      {
        target: '[data-guide="tools"]',
        textKey: "feature_guide.image_generation.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="tools-enable"]',
        prepare: openTools,
        textKey: "feature_guide.image_generation.step2",
        check: toolsAreEnabled,
      },
      {
        target: '[data-guide="tool-image_generation"]',
        prepare: ensureToolsEnabled,
        textKey: "feature_guide.image_generation.step3",
        check: () => isToolActive("image_generation"),
      },
    ],
  },
  image_modification: {
    titleKey: "feature_guide.image_modification.title",
    prompt:
      "Modify images with GWDG Tools. Open Tools, enable tools, then select Image Modification.",
    keywords: ["image modification", "modify image", "edit image"],
    steps: [
      {
        target: '[data-guide="tools"]',
        textKey: "feature_guide.image_modification.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="tools-enable"]',
        prepare: openTools,
        textKey: "feature_guide.image_modification.step2",
        check: toolsAreEnabled,
      },
      {
        target: '[data-guide="tool-image_modification"]',
        prepare: ensureToolsEnabled,
        textKey: "feature_guide.image_modification.step3",
        check: () => isToolActive("image_modification"),
      },
    ],
  },
  image_analysis: {
    titleKey: "feature_guide.image_analysis.title",
    prompt:
      "Analyze images with SAIA's Gemma vision model. Open GWDG Tools from the prompt box, then select Analyze images.",
    keywords: ["analyze image", "analyse image", "read image", "image text", "vision"],
    steps: [
      {
        target: '[data-guide="tools"]',
        textKey: "feature_guide.image_analysis.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="tool-image_analysis"]',
        prepare: openTools,
        textKey: "feature_guide.image_analysis.step2",
        check: () => isToolActive("image_analysis"),
      },
    ],
  },
  audio_generation: {
    titleKey: "feature_guide.audio_generation.title",
    prompt:
      "Generate audio with GWDG Tools. Open Tools, enable tools, then select Audio Generation.",
    keywords: ["audio generation", "generate audio", "generate speech"],
    steps: [
      {
        target: '[data-guide="tools"]',
        textKey: "feature_guide.audio_generation.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="tools-enable"]',
        prepare: openTools,
        textKey: "feature_guide.audio_generation.step2",
        check: toolsAreEnabled,
      },
      {
        target: '[data-guide="tool-audio_generation"]',
        prepare: ensureToolsEnabled,
        textKey: "feature_guide.audio_generation.step3",
        check: () => isToolActive("audio_generation"),
      },
    ],
  },
  arcana_tools: {
    titleKey: "feature_guide.arcana_tools.title",
    prompt:
      "Use Arcana Tools from GWDG Tools. Enable tools, then select Arcana Tools so the assistant can inspect Arcana collections, manage their files and indexes, and handle sharing.",
    keywords: [
      "arcana tools",
      "arcane tools",
      "arcana v2",
      "arcanav2",
      "arcana",
      "rag index",
      "sharing",
    ],
    steps: [
      {
        target: '[data-guide="tools"]',
        textKey: "feature_guide.arcana_tools.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="tools-enable"]',
        prepare: openTools,
        textKey: "feature_guide.arcana_tools.step2",
        check: toolsAreEnabled,
      },
      {
        target: '[data-guide="tool-arcana_tools"]',
        prepare: ensureToolsEnabled,
        textKey: "feature_guide.arcana_tools.step3",
        check: () => isToolActive("arcana_tools"),
      },
    ],
  },
  diagram_renderers: {
    titleKey: "feature_guide.diagram_renderers.title",
    prompt:
      "Render diagrams and charts from fenced code blocks. Use ```dot or ```graphviz for Graphviz, ```vega-lite or ```vega for Vega-Lite, and ```chart or ```chartjs for a Chart.js JSON config. They are rendered locally in the browser.",
    keywords: ["graphviz", "dot graph", "vega-lite", "vega", "chart.js", "chartjs", "diagram", "chart"],
    steps: [
      {
        target: ".prompt-area",
        textKey: "feature_guide.diagram_renderers.step1",
      },
      {
        target: '[data-guide="send"]',
        textKey: "feature_guide.diagram_renderers.step2",
        completeOnEvent: "message-complete",
      },
    ],
  },
  mcp_server: {
    titleKey: "feature_guide.mcp_server.title",
    prompt:
      "Configure an MCP server once in the sidebar's MCP Servers section, test the connection, then select the server for this chat under MCP Servers in GWDG Tools.",
    keywords: ["mcp", "mcp server", "model context protocol"],
    steps: [
      {
        target: '[data-guide="mcp-servers-add"]',
        textKey: "feature_guide.mcp_server.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="mcp-scan"]',
        textKey: "feature_guide.mcp_server.scan",
      },
      {
        target: '[data-guide="mcp-input"]',
        textKey: "feature_guide.mcp_server.step2",
        check: mcpConfigured,
      },
      {
        target: '[data-guide="mcp-server-details"]',
        textKey: "feature_guide.mcp_server.details",
      },
      {
        target: '[data-guide="mcp-server-picker"]',
        prepare: () => ensureTool("mcp"),
        textKey: "feature_guide.mcp_server.step3",
      },
      {
        target: '[data-guide="mcp-tool-policy"]',
        prepare: () => selectSettingsTab("advanced"),
        textKey: "feature_guide.mcp_server.policy",
      },
    ],
  },
  tools_overview: {
    titleKey: "feature_guide.tools_overview.title",
    prompt:
      "GWDG Tools add web search, image, audio, and video generation, Arcana, Arcana Tools, and MCP servers. Open Tools and enable them to see the available buttons.",
    keywords: ["tools", "gwdg tools", "tool use"],
    steps: [
      {
        target: '[data-guide="tools"]',
        textKey: "feature_guide.tools_overview.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="tools-enable"]',
        prepare: openTools,
        textKey: "feature_guide.tools_overview.step2",
        check: toolsAreEnabled,
      },
      {
        target: '[data-guide="tools-grid"]',
        prepare: ensureToolsEnabled,
        textKey: "feature_guide.tools_overview.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  search_chats: {
    titleKey: "feature_guide.search_chats.title",
    prompt:
      "Search chats by title from the sidebar search button.",
    keywords: ["search chats", "search conversation", "find a chat", "search"],
    steps: [
      {
        target: '[data-guide="search-chats"]',
        textKey: "feature_guide.search_chats.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="search-input"]',
        prepare: openSearch,
        textKey: "feature_guide.search_chats.step2",
        check: searchHasQuery,
      },
    ],
  },
  manage_topics: {
    titleKey: "feature_guide.manage_topics.title",
    prompt:
      "Organize chats into topics. Use the create-topic button in the sidebar, then drag chats into topics or use the conversation menu.",
    keywords: ["topic", "topics", "create topic", "organize chats"],
    steps: [
      {
        target: '[data-guide="create-topic"]',
        textKey: "feature_guide.manage_topics.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="topic-create-input"]',
        prepare: openTopicCreate,
        textKey: "feature_guide.manage_topics.step2",
        check: topicNameEntered,
      },
      {
        target: '[data-guide="topic-list"]',
        textKey: "feature_guide.manage_topics.step3",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="collapse-all-topics"]',
        textKey: "feature_guide.manage_topics.step4",
        completeOnTargetClick: true,
      },
    ],
  },
  attach_chat_to_workspace: {
    titleKey: "feature_guide.attach_chat_to_workspace.title",
    prompt:
      "Attach a chat to a workspace by dragging it from the sidebar onto a workspace row. The workspace then shows the chat and can use its files. Drag the chat out of the workspace onto a topic to detach it again.",
    keywords: [
      "attach chat",
      "detach chat",
      "workspace chat",
      "drag chat",
      "move chat to workspace",
    ],
    steps: [
      {
        target: '[data-guide="workspace-row"]',
        textKey: "feature_guide.attach_chat_to_workspace.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="workspace-chat-row"]',
        textKey: "feature_guide.attach_chat_to_workspace.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="topic-list"]',
        textKey: "feature_guide.attach_chat_to_workspace.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  sort_organize: {
    titleKey: "feature_guide.sort_organize.title",
    prompt:
      "Use Smart Sort in the sidebar header to let the model suggest topics, titles, and cleanup for your chats. Review the proposal, select what you want, and apply it. Nothing changes before you apply.",
    keywords: [
      "smart sort",
      "sort and organize",
      "sort & organize",
      "organize chats",
      "clean up chats",
      "ai organization",
      "suggested topics",
      "duplicate chats",
    ],
    steps: [
      {
        target: '[data-guide="sort-organize"]',
        textKey: "feature_guide.sort_organize.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="sort-organize-review"]',
        textKey: "feature_guide.sort_organize.step2",
      },
      {
        target: '[data-guide="sort-organize-apply"]',
        textKey: "feature_guide.sort_organize.step3",
      },
    ],
  },
  sort_group_chats: {
    titleKey: "feature_guide.sort_group_chats.title",
    prompt:
      "Sort and group chats by topic, date, creation date, or browser storage size from the sidebar sort menu.",
    keywords: ["sort chats", "group chats", "grouping", "sort by date", "sort by size", "storage size"],
    steps: [
      {
        target: '[data-guide="sort-chats"]',
        textKey: "feature_guide.sort_group_chats.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="sort-menu"]',
        prepare: openSortMenu,
        textKey: "feature_guide.sort_group_chats.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  pin_chat: {
    titleKey: "feature_guide.pin_chat.title",
    prompt:
      "Pin a chat from the conversation menu so it stays in the pinned area at the top of the sidebar, regardless of how chats are grouped.",
    keywords: ["pin chat", "pinned", "unpin", "keep chat on top"],
    steps: [
      {
        target: '[data-guide="conversation-menu"]',
        textKey: "feature_guide.pin_chat.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="pin-chat-menu-item"]',
        prepare: openConversationMenu,
        textKey: "feature_guide.pin_chat.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  pin_topic: {
    titleKey: "feature_guide.pin_topic.title",
    prompt:
      "Pin a topic from its options menu so it stays in the pinned area at the top of the sidebar, regardless of how chats are grouped.",
    keywords: ["pin topic", "pinned topic", "unpin topic", "keep topic on top"],
    steps: [
      {
        target: '[data-guide="topic-menu"]',
        textKey: "feature_guide.pin_topic.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="pin-topic-menu-item"]',
        prepare: openTopicMenu,
        textKey: "feature_guide.pin_topic.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  pin_workspace: {
    titleKey: "feature_guide.pin_workspace.title",
    prompt:
      "Pin a workspace from its options menu so it moves to the pinned section at the top of the sidebar, above the chats.",
    keywords: ["pin workspace", "pinned workspace", "unpin workspace", "keep workspace on top"],
    steps: [
      {
        target: '[data-guide="workspace-menu"]',
        textKey: "feature_guide.pin_workspace.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="pin-workspace-menu-item"]',
        prepare: openWorkspaceMenu,
        textKey: "feature_guide.pin_workspace.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="pinned-section"]',
        textKey: "feature_guide.pin_workspace.step3",
      },
    ],
  },
  pin_agent: {
    titleKey: "feature_guide.pin_agent.title",
    prompt:
      "Pin an agent from its options menu so it moves to the pinned section at the top of the sidebar, above the chats.",
    keywords: ["pin agent", "pinned agent", "unpin agent", "keep agent on top"],
    steps: [
      {
        target: '[data-guide="agent-menu"]',
        textKey: "feature_guide.pin_agent.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="pin-agent-menu-item"]',
        prepare: openAgentMenu,
        textKey: "feature_guide.pin_agent.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  export_conversation: {
    titleKey: "feature_guide.export_conversation.title",
    prompt:
      "Export a chat from the conversation menu. The export dialog lets you choose the format.",
    keywords: ["export chat", "download chat", "save chat", "export"],
    steps: [
      {
        target: '[data-guide="conversation-menu"]',
        textKey: "feature_guide.export_conversation.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="export-chat"]',
        prepare: openConversationMenu,
        textKey: "feature_guide.export_conversation.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  import_conversation: {
    titleKey: "feature_guide.import_conversation.title",
    prompt:
      "Import a chat from a JSON file using the import button in the sidebar or the Data tab.",
    keywords: ["import chat", "restore chat", "import conversation", "import"],
    steps: [
      {
        target: '[data-guide="import-chat"]',
        textKey: "feature_guide.import_conversation.step1",
        completeOnTargetClick: true,
      },
    ],
  },
  close_chat: {
    titleKey: "feature_guide.close_chat.title",
    prompt:
      "Use the close button at the top right of the chat. It removes the chat from the conversation list; in the Meta chat it clears the conversation instead.",
    keywords: [
      "close chat",
      "delete chat",
      "remove chat",
      "clear meta chat",
      "clear chat",
    ],
    steps: [
      {
        target: '[data-guide="close-chat"]',
        textKey: "feature_guide.close_chat.step1",
        completeOnTargetClick: true,
      },
    ],
  },
  chat_with_persona: {
    titleKey: "feature_guide.chat_with_persona.title",
    prompt:
      "Open the persona library with the Chat with Persona button in the sidebar. Choose a category, then select a persona to start a new chat with its title, model, and system prompt.",
    keywords: [
      "persona",
      "personas",
      "chat with persona",
      "persona library",
      "start persona chat",
    ],
    steps: [
      {
        target: '[data-guide="import-persona"]',
        textKey: "feature_guide.chat_with_persona.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="persona-categories"]',
        textKey: "feature_guide.chat_with_persona.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="persona-files"]',
        textKey: "feature_guide.chat_with_persona.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  course_view: {
    titleKey: "feature_guide.course_view.title",
    prompt:
      "Open the persona library with the Chat with Persona button in the sidebar, choose the Courses folder, and pick a course. A course page opens with two modes: Learn (skills browser, practice quiz, self-learning pages) and Review (the course's own lecturer pages plus coverage numbers). The course tutor chat starts from the same page.",
    keywords: [
      "course",
      "courses",
      "kurs",
      "lernseite",
      "quiz",
      "üben",
      "practice",
      "c programming",
      "c programmierung",
    ],
    steps: [
      {
        target: '[data-guide="import-persona"]',
        textKey: "feature_guide.course_view.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="persona-courses"]',
        textKey: "feature_guide.course_view.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="persona-course-badge"]',
        textKey: "feature_guide.course_view.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  course_quiz_chat: {
    titleKey: "feature_guide.course_quiz_chat.title",
    prompt:
      "Open a course chat and click Ask for a quiz question in the course chat banner. The tutor calls its quiz tool and answers with one interactive quiz question from the course, which you answer and check right in the chat. The tutor decides which question to show; it can also offer one when you ask to practise a skill. Ask the same tutor to explain a skill and it embeds one of the course's learning pages (Lernseiten) in its reply, where you can read and interact with it without leaving the chat.",
    keywords: [
      "quiz",
      "quizfrage",
      "üben",
      "ueben",
      "practice question",
      "learning page",
      "lernseite",
      "course chat",
      "kurs chat",
    ],
    steps: [
      {
        target: '[data-guide="course-quiz-ask"]',
        textKey: "feature_guide.course_quiz_chat.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="course-page-ask"]',
        textKey: "feature_guide.course_quiz_chat.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  share_conversation: {
    titleKey: "feature_guide.share_conversation.title",
    prompt:
      "Share conversation settings as a link from the conversation settings panel.",
    keywords: ["share chat", "share settings", "share conversation", "share"],
    steps: [
      {
        target: ".settings-toggle",
        textKey: "feature_guide.share_conversation.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="share-settings"]',
        prepare: openConversationSettings,
        textKey: "feature_guide.share_conversation.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  fork_conversation: {
    titleKey: "feature_guide.fork_conversation.title",
    prompt:
      "Fork a conversation from an assistant message to continue from that point in a new chat.",
    keywords: ["fork chat", "fork conversation", "branch chat"],
    steps: [
      {
        target: '[data-guide="fork-button"]',
        textKey: "feature_guide.fork_conversation.step1",
        completeOnTargetClick: true,
      },
    ],
  },
  summarize_conversation: {
    titleKey: "feature_guide.summarize_conversation.title",
    prompt:
      "Summarize the current chat from the sidebar or the conversation menu.",
    keywords: ["summarize chat", "summarize conversation", "summary", "summarize"],
    steps: [
      {
        target: '[data-guide="conversation-menu"]',
        textKey: "feature_guide.summarize_conversation.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="summarize-chat"]',
        prepare: openConversationMenu,
        textKey: "feature_guide.summarize_conversation.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  settings_overview: {
    titleKey: "feature_guide.settings_overview.title",
    prompt:
      "Open user settings to review and change global preferences, including the default model, send key, rendering, document conversion, memories, and local data.",
    keywords: [
      "settings overview",
      "user settings",
      "change settings",
      "privacy settings",
    ],
    steps: [
      {
        target: [
          '[data-guide="user-settings"]',
          ".user-profile-button",
          ".user-profile-block",
        ],
        textKey: "feature_guide.settings_overview.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-chat"]',
        textKey: "feature_guide.settings_overview.step2",
        completeOnTargetClick: true,
        prepare: openUserSettings,
      },
      {
        target: '[data-guide="document-conversion-preference"]',
        textKey: "feature_guide.settings_overview.step3",
        completeOnTargetClick: true,
        prepare: () => selectSettingsTab("chat"),
      },
      {
        target: '[data-guide="rendering-preference"]',
        textKey: "feature_guide.settings_overview.step4",
        completeOnTargetClick: true,
        prepare: () => selectSettingsTab("advanced"),
      },
    ],
  },
  institution: {
    titleKey: "feature_guide.institution.title",
    prompt:
      "Show which institution provides this Chat AI and what it restricts. Open user settings and look at the Profile tab's Institution section: it names the institution, explains the limitation in plain words and lists every restriction the active brand applies, such as a fixed model, disabled features and blocked external communication, together with the contact and the links for this installation.",
    keywords: [
      "institution",
      "institutional restrictions",
      "restricted",
      "limitations",
      "approved model",
      "einrichtung",
      "einschränkung",
      "beschränkung",
    ],
    steps: [
      {
        target: [
          '[data-guide="user-settings"]',
          ".user-profile-button",
          ".user-profile-block",
        ],
        textKey: "feature_guide.institution.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-profile"]',
        prepare: openUserSettings,
        textKey: "feature_guide.institution.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="profile-subtab-institution"]',
        prepare: () => selectProfileSection("institution"),
        textKey: "feature_guide.institution.step3",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="institute-section"]',
        prepare: () => selectProfileSection("institution"),
        textKey: "feature_guide.institution.step4",
      },
    ],
  },
  memories: {
    titleKey: "feature_guide.memories.title",
    prompt:
      "Manage saved memories globally in user settings, and choose the memory mode for a conversation in conversation settings.",
    keywords: ["memory", "memories", "remember"],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.memories.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-memories"]',
        prepare: openUserSettings,
        textKey: "feature_guide.memories.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  e2ee: {
    titleKey: "feature_guide.e2ee.title",
    prompt:
      "Encrypt a model end to end: open user settings, choose the Encryption tab, import the public key of an encryption-capable model (load the keys published under the configured key directory for all models at once, or paste one, choose a .pub file, load it from a URL, import a key directory, or pick a local folder and read every .pub file in it), then bind the model to that key. The model shows a lock and every request through it is encrypted in this browser.",
    keywords: [
      "encryption",
      "end-to-end encryption",
      "e2ee",
      "public key",
      "key",
      "verschlüsselung",
      "schlüssel",
    ],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.e2ee.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-encryption"]',
        prepare: openUserSettings,
        textKey: "feature_guide.e2ee.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="e2ee-add"]',
        textKey: "feature_guide.e2ee.step3",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="e2ee-published"]',
        textKey: "feature_guide.e2ee.step_published",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="e2ee-models"]',
        textKey: "feature_guide.e2ee.step4",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="e2ee-keys"]',
        textKey: "feature_guide.e2ee.step_test",
        completeOnTargetClick: true,
      },
    ],
  },
  chat_preferences: {
    titleKey: "feature_guide.chat_preferences.title",
    prompt:
      "Open user settings and choose the Chat tab to change chat preferences and document conversion; rendering lives in the Advanced tab.",
    keywords: ["chat preferences", "preferences", "user settings"],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.chat_preferences.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-chat"]',
        prepare: openUserSettings,
        textKey: "feature_guide.chat_preferences.step2",
        completeOnTargetClick: true,
      },
    ],
  },
  advanced_mode: {
    titleKey: "feature_guide.advanced_mode.title",
    prompt:
      "Show the Agents and MCP Servers sections in the sidebar. Open user settings, choose the Advanced tab, and switch Advanced mode on; with it off the sidebar keeps chats, topics and workspaces only.",
    keywords: ["advanced mode", "sidebar sections", "show agents", "show mcp"],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.advanced_mode.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-advanced"]',
        prepare: openUserSettings,
        textKey: "feature_guide.advanced_mode.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="profile-advanced-mode-preference"]',
        textKey: "feature_guide.advanced_mode.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  brand_consent: {
    titleKey: "feature_guide.brand_consent.title",
    prompt:
      "Review or change the voluntary consents of this service. Open user settings, choose the Profile tab and its Consents section, and use the consent switches; the terms themselves are linked there.",
    keywords: [
      "consent",
      "consents",
      "study",
      "survey",
      "privacy",
      "terms of use",
      "withdraw consent",
    ],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.brand_consent.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="profile-subtab-consents"]',
        prepare: () => selectProfileSection("consents"),
        textKey: "feature_guide.brand_consent.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="brand-consent-settings"]',
        textKey: "feature_guide.brand_consent.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  message_timestamps: {
    titleKey: "feature_guide.message_timestamps.title",    prompt:
      "Show the date and time each message was sent. Open user settings, choose the Chat tab, and enable Show message timestamps in the Messages section.",
    keywords: [
      "message timestamps",
      "message time",
      "timestamp",
      "zeitstempel",
      "uhrzeit",
    ],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.message_timestamps.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-chat"]',
        prepare: openUserSettings,
        textKey: "feature_guide.message_timestamps.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="message-timestamps-preference"]',
        prepare: () => selectSettingsTab("chat"),
        textKey: "feature_guide.message_timestamps.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  rendering: {
    titleKey: "feature_guide.rendering.title",
    prompt:
      "Enable Typst or LaTeX rendering in user settings under Chat preferences. Each code block still has its own render toggle.",
    keywords: ["typst", "latex", "rendering", "render code"],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.rendering.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-advanced"]',
        prepare: openUserSettings,
        textKey: "feature_guide.rendering.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="rendering-preference"]',
        prepare: () => selectSettingsTab("advanced"),
        textKey: "feature_guide.rendering.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  reasoning_streaming: {
    titleKey: "feature_guide.reasoning_streaming.title",
    prompt:
      "Keep the reasoning process collapsed while the model streams and show a small moving activity dot instead. Users can open the reasoning after the response finishes.",
    keywords: ["reasoning", "thinking", "streaming", "collapse", "indicator"],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.reasoning_streaming.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-advanced"]',
        prepare: openUserSettings,
        textKey: "feature_guide.reasoning_streaming.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="reasoning-streaming-preference"]',
        prepare: () => selectSettingsTab("advanced"),
        textKey: "feature_guide.reasoning_streaming.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  document_conversion: {
    titleKey: "feature_guide.document_conversion.title",
    prompt:
      "Choose whether PDF and DOCX attachments are converted on the server, in the browser, or by choice in user settings.",
    keywords: ["document conversion", "convert document", "browser conversion", "server conversion"],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.document_conversion.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-chat"]',
        prepare: openUserSettings,
        textKey: "feature_guide.document_conversion.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="document-conversion-preference"]',
        prepare: () => selectSettingsTab("chat"),
        textKey: "feature_guide.document_conversion.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  data_management: {
    titleKey: "feature_guide.data_management.title",
    prompt:
      "Export or delete local data in user settings under the Data tab. This includes chats, memories, settings, and attachments.",
    keywords: ["data management", "privacy", "delete data", "clear cache", "export data"],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.data_management.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-data"]',
        prepare: openUserSettings,
        textKey: "feature_guide.data_management.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="export-data"]',
        prepare: () => selectDataSection("manage"),
        textKey: "feature_guide.data_management.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  sync_setup: {
    titleKey: "feature_guide.sync_setup.title",
    prompt:
      "Keep settings, conversations, workspaces and agents in step across devices with an encrypted copy on your SAIA filesystem. Open user settings, choose the Data tab, switch the encrypted server synchronization on, and create it with a passphrase you can remember (or unlock the copy another device already created). Everything is encrypted in this browser before it is uploaded, and the passphrase is never stored. A one-time offer may appear on first use while the sync module is on and the SAIA filesystem answers; its button switches the synchronization on and opens this section, but the copy is only created once a passphrase is entered. Once the copy is open, a passkey can remember the vault on this device so a reload does not ask for the passphrase again.",
    keywords: [
      "sync",
      "synchronization",
      "synchronisation",
      "encrypted copy",
      "server synchronization",
      "multi device",
      "passkey",
      "passkeys",
      "verschlüsselte kopie",
      "synchronisieren",
    ],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.sync_setup.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-data"]',
        prepare: openUserSettings,
        textKey: "feature_guide.sync_setup.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="data-subtab-sync"]',
        prepare: () => selectSettingsTab("data"),
        textKey: "feature_guide.sync_setup.subtab",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="sync-settings"]',
        prepare: () => selectDataSection("sync"),
        textKey: "feature_guide.sync_setup.step3",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="sync-enable"]',
        textKey: "feature_guide.sync_setup.step4",
        completeOnTargetClick: true,
      },
    ],
  },
  backup_create: {
    titleKey: "feature_guide.backup_create.title",
    prompt:
      "Download one encrypted file of your whole browser history — chats, topics, settings, workspaces and agents — and restore it later with the same passphrase. Open user settings, choose the Data tab, and create the backup under Encrypted backup. The file is encrypted in this browser and stamped with the date and time; the passphrase is never stored.",
    keywords: [
      "backup",
      "back up",
      "encrypted backup",
      "restore",
      "export",
      "sicherung",
      "sicherungskopie",
      "wiederherstellen",
    ],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.backup_create.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-data"]',
        prepare: openUserSettings,
        textKey: "feature_guide.backup_create.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="data-subtab-backup"]',
        prepare: () => selectSettingsTab("data"),
        textKey: "feature_guide.backup_create.subtab",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="backup-settings"]',
        prepare: () => selectDataSection("backup"),
        textKey: "feature_guide.backup_create.step3",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="backup-create"]',
        textKey: "feature_guide.backup_create.step4",
        completeOnTargetClick: true,
      },
    ],
  },
  backup_restore: {
    titleKey: "feature_guide.backup_restore.title",
    prompt:
      "Restore an encrypted backup file into this browser. Open user settings, choose the Data tab and the Encrypted backup section, pick the file, and type the passphrase it was created with.",
    keywords: [
      "backup",
      "restore",
      "import backup",
      "move chats",
      "new device",
      "wiederherstellen",
      "sicherung",
    ],
    steps: [
      {
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        textKey: "feature_guide.backup_restore.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="settings-tab-data"]',
        prepare: openUserSettings,
        textKey: "feature_guide.backup_restore.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="data-subtab-backup"]',
        prepare: () => selectSettingsTab("data"),
        textKey: "feature_guide.backup_restore.subtab",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="backup-restore"]',
        prepare: () => selectDataSection("backup"),
        textKey: "feature_guide.backup_restore.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  dark_mode: {
    titleKey: "feature_guide.dark_mode.title",
    prompt:
      "Switch between light and dark mode with the theme toggle in the footer.",
    keywords: ["dark mode", "light mode", "theme"],
    steps: [
      {
        target: '[data-guide="theme-toggle"]',
        textKey: "feature_guide.dark_mode.step1",
        completeOnTargetClick: true,
      },
    ],
  },
  language_picker: {
    titleKey: "feature_guide.language_picker.title",
    prompt:
      "Change the interface language in the footer. Choose English or German, or Automatic to follow the browser language; the choice is remembered on this device.",
    keywords: ["language", "deutsch", "english", "sprache", "translation"],
    steps: [
      {
        target: '[data-guide="language-picker"]',
        textKey: "feature_guide.language_picker.step1",
        completeOnTargetClick: true,
      },
    ],
  },
  pwa_install: {
    titleKey: "feature_guide.pwa_install.title",
    prompt:
      "Install this app so it opens in its own window without the browser's address bar. The install button in the footer appears when the browser offers the installation.",
    keywords: ["install", "pwa", "app", "home screen", "offline"],
    steps: [
      {
        target: '[data-guide="pwa-install"]',
        textKey: "feature_guide.pwa_install.step1",
        completeOnTargetClick: true,
      },
    ],
  },
  bug_report: {
    titleKey: "feature_guide.bug_report.title",
    prompt:
      "Report a problem with the app through the bug report button in the footer: pick a type, describe what happened and attach a screenshot if it helps.",
    keywords: ["bug", "report", "problem", "feedback", "screenshot"],
    steps: [
      {
        target: '[data-guide="bug-report"]',
        textKey: "feature_guide.bug_report.step1",
        completeOnTargetClick: true,
      },
    ],
  },
  feedback: {
    titleKey: "feature_guide.feedback.title",
    prompt:
      "Rate an assistant message with the thumbs-up/down buttons; under Profile → Feedback, switch answer ratings and chat transcripts on or off, and review or delete everything this account sent to the feedback service. Chat transcripts are sent as only the new messages, appended to the stored chat.",
    keywords: [
      "feedback",
      "rate answer",
      "thumbs up",
      "thumbs down",
      "delete feedback",
      "conversation analysis",
      "chat transcript",
      "delta",
    ],
    steps: [
      {
        target: '[data-guide="feedback"]',
        textKey: "feature_guide.feedback.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="feedback-preference"]',
        prepare: () => selectProfileSection("feedback"),
        textKey: "feature_guide.feedback.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="profile-feedback-history"]',
        prepare: () => selectProfileSection("feedback"),
        textKey: "feature_guide.feedback.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  speech_output: {
    titleKey: "feature_guide.speech_output.title",
    prompt:
      "Read an assistant message aloud with the speak button when the speech module is enabled.",
    keywords: ["speak", "read aloud", "text to speech", "speech output"],
    steps: [
      {
        target: '[data-guide="speak"]',
        textKey: "feature_guide.speech_output.step1",
        completeOnTargetClick: true,
      },
    ],
  },
  meta_chat_catalogs: {
    titleKey: "feature_guide.meta_chat_catalogs.title",
    prompt:
      "Explain how to use the Meta chat to find tutorials, use cases, personas, settings, chats, messages, and topics. Browse tutorials and Browse use cases open searchable catalogs; users can also ask the Meta chat to find a tutorial, recommend a persona, explain settings, navigate to a chat/message/topic/settings tab, search message contents, compare conversations, or extract decisions and action items.",
    keywords: [
      "meta chat tutorials",
      "meta chat use cases",
      "meta chat personas",
      "meta chat search",
      "find a decision",
      "compare conversations",
      "take me to a setting",
      "navigate to a message",
      "browse tutorials",
      "browse use cases",
      "persona",
      "recommend persona",
    ],
    steps: [
      {
        target: '[data-guide="browse-tutorials"]',
        textKey: "feature_guide.meta_chat_catalogs.step1",
      },
      {
        target: '[data-guide="browse-use-cases"]',
        textKey: "feature_guide.meta_chat_catalogs.step2",
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.meta_chat_catalogs.step3",
        completeOnEvent: "message-complete",
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.meta_chat_catalogs.step4",
        completeOnEvent: "message-complete",
      },
    ],
  },
  meta_chat_actions: {
    titleKey: "feature_guide.meta_chat_actions.title",
    prompt:
      "Use the Meta chat to propose renaming a chat or moving it to another topic. Review the warning card below the message and click Accept changes; nothing is applied before that.",
    keywords: [
      "meta chat rename",
      "meta chat move chat",
      "rename chat with meta chat",
      "move chat to topic",
      "accept changes",
    ],
    steps: [
      {
        target: '[data-guide="meta-chat"]',
        textKey: "feature_guide.meta_chat_actions.step1",
        completeOnTargetClick: true,
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.meta_chat_actions.step2",
        completeOnEvent: "message-complete",
      },
      {
        target: '[data-guide="meta-action-accept"]',
        textKey: "feature_guide.meta_chat_actions.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  meta_chat_search: {
    titleKey: "feature_guide.meta_chat_search.title",
    prompt:
      "Use the Meta chat to search the full text of your stored messages across conversations and topics. Ask where something was decided or what the action items are, then open the cited messages to jump to the exact source.",
    keywords: [
      "meta chat search",
      "full text search",
      "search messages",
      "find a message",
      "find a decision",
      "action items",
      "cite a message",
    ],
    steps: [
      {
        target: '[data-guide="meta-chat"]',
        textKey: "feature_guide.meta_chat_search.step1",
        completeOnTargetClick: true,
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.meta_chat_search.step2",
        completeOnEvent: "message-complete",
      },
      {
        target: '[data-guide="message-citation"]',
        textKey: "feature_guide.meta_chat_search.step3",
      },
    ],
  },
  meta_chat_pins: {
    titleKey: "feature_guide.meta_chat_pins.title",
    prompt:
      "Ask the Meta chat to pin or unpin a chat, topic, workspace or agent. Pinned items appear in the pinned section at the top of the sidebar. The change is proposed in a warning card and applied only after the user accepts it.",
    keywords: [
      "meta chat pin",
      "pin chat with meta chat",
      "unpin chat",
      "pin topic",
      "pinned chats",
    ],
    steps: [
      {
        target: '[data-guide="meta-chat"]',
        textKey: "feature_guide.meta_chat_pins.step1",
        completeOnTargetClick: true,
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.meta_chat_pins.step2",
        completeOnEvent: "message-complete",
      },
      {
        target: '[data-guide="meta-action-accept"]',
        textKey: "feature_guide.meta_chat_pins.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  meta_chat_navigation: {
    titleKey: "feature_guide.meta_chat_navigation.title",
    prompt:
      "Use the Meta chat to navigate to chats, messages, topics, and settings, and to search across message contents. Ask it where something was decided or what action items exist; answers include links that jump to the exact source and highlight it.",
    keywords: [
      "meta chat navigation",
      "find a message",
      "find a decision",
      "action items",
      "take me to a setting",
      "deep link",
    ],
    steps: [
      {
        target: '[data-guide="meta-chat"]',
        textKey: "feature_guide.meta_chat_navigation.step1",
        completeOnTargetClick: true,
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.meta_chat_navigation.step2",
        completeOnEvent: "message-complete",
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.meta_chat_navigation.step3",
        completeOnEvent: "message-complete",
      },
    ],
  },
  meta_chat_agents: {
    titleKey: "feature_guide.meta_chat_agents.title",
    prompt:
      "Use the Meta chat to check agent connections, read an agent's recent history, list or search agent files, fetch an agent file into the chat, or send a confirmable prompt/interrupt to an agent. Use list_agents first, then ask for the agent by name or id.",
    keywords: [
      "meta chat agents",
      "check agents",
      "agent status",
      "agent history",
      "agent files",
      "fetch agent file",
      "prompt an agent",
      "interrupt agent",
    ],
    steps: [
      {
        target: '[data-guide="meta-chat"]',
        textKey: "feature_guide.meta_chat_agents.step1",
        completeOnTargetClick: true,
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.meta_chat_agents.step2",
        completeOnEvent: "message-complete",
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.meta_chat_agents.step3",
        completeOnEvent: "message-complete",
      },
    ],
  },
  meta_chat_workspaces: {
    titleKey: "feature_guide.meta_chat_workspaces.title",
    prompt:
      "Use the Meta chat to list workspaces and propose attaching or detaching a workspace to an agent or chat. Changes appear as warning cards and are applied only after Accept.",
    keywords: [
      "meta chat workspace",
      "attach workspace with meta chat",
      "detach workspace",
      "workspace link",
    ],
    steps: [
      {
        target: '[data-guide="meta-chat"]',
        textKey: "feature_guide.meta_chat_workspaces.step1",
        completeOnTargetClick: true,
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.meta_chat_workspaces.step2",
        completeOnEvent: "message-complete",
      },
      {
        target: '[data-guide="meta-action-accept"]',
        textKey: "feature_guide.meta_chat_workspaces.step3",
        completeOnTargetClick: true,
      },
    ],
  },
  meta_chat_digest: {
    titleKey: "feature_guide.meta_chat_digest.title",
    prompt:
      "Ask the Meta chat what is new. It remembers the last check, then reports changed chats, new topics and memories, agent status, and recently modified agent files. The Meta banner shows when changes were last checked.",
    keywords: [
      "meta chat what's new",
      "anything new",
      "recent activity",
      "new agent files",
      "daily digest",
    ],
    steps: [
      {
        target: '[data-guide="meta-chat"]',
        textKey: "feature_guide.meta_chat_digest.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="meta-last-check"]',
        textKey: "feature_guide.meta_chat_digest.step2",
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.meta_chat_digest.step3",
        completeOnEvent: "message-complete",
      },
    ],
  },
  meta_chat_mcp: {
    titleKey: "feature_guide.meta_chat_mcp.title",
    prompt:
      "Manage MCP servers with the Meta chat. It can test local servers, list their tools, add, update, or remove global MCP servers, and report agent/MCP health. Changes to the sidebar list require Accept.",
    keywords: [
      "meta chat mcp",
      "mcp status",
      "mcp tools",
      "add mcp server",
      "test mcp server",
    ],
    steps: [
      {
        target: '[data-guide="mcp-servers-add"]',
        textKey: "feature_guide.meta_chat_mcp.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="meta-chat"]',
        textKey: "feature_guide.meta_chat_mcp.step2",
        completeOnTargetClick: true,
      },
      {
        target: ".prompt-area",
        textKey: "feature_guide.meta_chat_mcp.step3",
        completeOnEvent: "message-complete",
      },
    ],
  },
  meta_chat_usage: {
    titleKey: "feature_guide.meta_chat_usage.title",
    prompt:
      "Open the Meta chat from the AI icon in the sidebar. It can explain features and find past chats.",
    keywords: ["meta chat", "metachat"],
    steps: [
      {
        target: '[data-guide="meta-chat"]',
        textKey: "feature_guide.meta_chat_usage.step1",
        completeOnTargetClick: true,
      },
    ],
  },
};

// The Tools panel is where every tool guide points. It exists for the tools
// module, and agent mode renders the same panel with the agent's own toggles.
// A brand that locks GWDG Tools removes the panel entirely
// (components/Prompt/ToolsButton.jsx#isBrandLocked), so no tool guide can run.
const isToolPanelAvailable = () =>
  !isBrandLocked("tools") && (isToolsEnabled() || isAgentEnabled());
const modelIsSelectable = () =>
  !isBrandLocked("model") && isBrandUiVisible("model_selector");
// The chat settings panel (temperature, top_p, reasoning effort, memory mode,
// the system prompt) is a single button; a brand that fixes those settings hides
// it (components/Header/SettingsButton.jsx#isBrandLocked).
const chatSettingsEditable = () => !isBrandLocked("chat_settings");
const metaChatAvailable = () => isFeatureEnabled("meta_chat");

// A guided tour highlights real elements. When a deployment switches a module or
// a feature off, its UI is not rendered at all, so the guide would point at
// nothing and the catalog would promise a walkthrough that cannot run. This map
// is the single answer to "can this guide start here?"; the catalogs, the Meta
// chat's `list_tutorials` / `start_tutorial` and `startGuide` all ask it.
//
// A guide that is not named here is always available. Add an entry whenever a
// guide's first target lives behind a module or feature switch.
export const FEATURE_GUIDE_AVAILABILITY = {
  workspace_overview: () => isFeatureEnabled("workspaces"),
  manage_chat_data: () => isFeatureEnabled("workspaces"),
  workspace_edit_storage: () => isFeatureEnabled("workspaces"),
  workspace_clone: () => isFeatureEnabled("workspaces"),
  workspace_upload: () => isFeatureEnabled("workspaces"),
  workspace_multiselect: () => isFeatureEnabled("workspaces"),
  arcana_filesystem: () => isFeatureEnabled("workspaces") && isArcanasEnabled(),
  workspace_saia_fs: () => isFeatureEnabled("workspaces"),
  attach_from_workspace: () => isFeatureEnabled("workspaces"),
  attach_chat_to_workspace: () => isFeatureEnabled("workspaces"),
  pin_workspace: () => isFeatureEnabled("workspaces"),
  agent_recovery: () => isAgentsEnabled(),
  remote_agents: () => isAgentsEnabled(),
  close_group_sessions: () => isAgentsEnabled(),
  session_workspaces: () => isAgentsEnabled(),
  agent_workspace_access: () => isAgentsEnabled(),
  pin_agent: () => isAgentsEnabled(),
  select_model: modelIsSelectable,
  conversation_settings: chatSettingsEditable,
  share_conversation: chatSettingsEditable,
  tools_overview: () => isToolPanelAvailable(),
  web_search: () => isToolPanelAvailable(),
  image_generation: () => isToolPanelAvailable(),
  image_modification: () => isToolPanelAvailable(),
  image_analysis: () => isToolPanelAvailable(),
  audio_generation: () => isToolPanelAvailable(),
  arcana: () => isToolPanelAvailable() && isArcanasEnabled(),
  arcana_tools: () => isToolPanelAvailable() && isArcanasEnabled(),
  mcp_server: () => isFeatureEnabled("mcp_servers") && isToolPanelAvailable(),
  feedback: () => isChatFeedbackEnabled(),
  // The install button renders only while the browser offers an install prompt;
  // a tour whose target is missing would never start, so the guide follows it.
  pwa_install: () => canInstallApp(),
  bug_report: () => isFeedbackReportEnabled(),
  speech_output: () => isSpeechEnabled(),
  e2ee: () => isFeatureEnabled("e2ee"),
  memories: () => isFeatureEnabled("memories"),
  advanced_mode: () => isAgentsEnabled() || isFeatureEnabled("mcp_servers"),
  sync_setup: () => isSyncEnabled(),
  // The quiz card ships with the brand feature that contributes its tool.
  course_quiz_chat: () => brandFeatureFlag("course_material"),
  // The consent section exists only for a brand that declares a consent gate.
  brand_consent: () => Boolean(brandConsentGate(currentBrand())),
  // The Institution screen renders only for a brand that describes itself or
  // narrows something.
  institution: () => hasBrandInstitute(),
  meta_chat_usage: metaChatAvailable,
  meta_chat_catalogs: metaChatAvailable,
  meta_chat_search: metaChatAvailable,
  meta_chat_navigation: metaChatAvailable,
  meta_chat_actions: metaChatAvailable,
  meta_chat_pins: metaChatAvailable,
  meta_chat_agents: () => metaChatAvailable() && isAgentsEnabled(),
  meta_chat_workspaces: () => metaChatAvailable() && isFeatureEnabled("workspaces"),
  meta_chat_digest: metaChatAvailable,
  meta_chat_mcp: () => metaChatAvailable() && isFeatureEnabled("mcp_servers"),
};

/** Whether this deployment renders everything a guide highlights. */
export function isFeatureGuideAvailable(featureId) {
  if (!featureId || !featureGuides[featureId]) return false;
  return FEATURE_GUIDE_AVAILABILITY[featureId]?.() ?? true;
}

export const FEATURE_CATEGORIES = {
  meta_chat: [
    "meta_chat_usage",
    "meta_chat_catalogs",
    "meta_chat_search",
    "meta_chat_navigation",
    "meta_chat_actions",
    "meta_chat_pins",
    "meta_chat_agents",
    "meta_chat_workspaces",
    "meta_chat_digest",
    "meta_chat_mcp",
  ],
  prompt: [
    "attach_media",
    "upload_file",
    "process_attachment",
    "select_model",
    "conversation_settings",
    "voice_input",
    "send_key",
  ],
  tools: [
    "tools_overview",
    "arcana",
    "web_search",
    "image_generation",
    "image_modification",
    "image_analysis",
    "audio_generation",
    "arcana_tools",
    "mcp_server",
  ],
  chats: [
    "search_chats",
    "manage_topics",
    "attach_chat_to_workspace",
    "sort_group_chats",
    "sort_organize",
    "pin_chat",
    "pin_topic",
    "import_conversation",
    "export_conversation",
    "share_conversation",
    "fork_conversation",
    "summarize_conversation",
    "close_chat",
  ],
  workspace: ["workspace_overview", "manage_chat_data", "pin_workspace", "pin_agent", "workspace_edit_storage", "workspace_clone", "workspace_upload", "workspace_multiselect", "arcana_filesystem", "workspace_saia_fs", "attach_from_workspace", "remote_agents", "agent_recovery", "close_group_sessions", "session_workspaces", "agent_workspace_access"],
  personas: ["chat_with_persona", "course_view", "course_quiz_chat"],
  settings: [
    "settings_overview",
    "institution",
    "e2ee",
    "sync_setup",
    "backup_create",
    "backup_restore",
    "chat_preferences",
    "advanced_mode",
    "message_timestamps",
    "memories",
    "rendering",
    "reasoning_streaming",
    "document_conversion",
    "data_management",
    "dark_mode",
    "brand_consent",
    "language_picker",
    "pwa_install",
  ],
  other: ["feedback", "bug_report", "speech_output", "diagram_renderers"],
};

export function getFeatureCategory(featureId) {
  return (
    Object.entries(FEATURE_CATEGORIES).find(([, ids]) =>
      ids.includes(featureId),
    )?.[0] ?? "other"
  );
}

export function getRelatedGuides(featureId, limit = 3) {
  const category = getFeatureCategory(featureId);
  return (FEATURE_CATEGORIES[category] || [])
    .filter((id) => id !== featureId && featureGuides[id])
    .slice(0, limit);
}

export const GUIDE_MARKER_PATTERN = /\[\[GUIDE:([a-zA-Z0-9_-]+)\]\]/i;

export function getFeatureGuide(featureId) {
  return featureId ? featureGuides[featureId] : null;
}

export function getFeatureGuideMarker(text) {
  const match = String(text || "").match(GUIDE_MARKER_PATTERN);
  const featureId = match?.[1]?.toLowerCase();
  return featureId && isFeatureGuideAvailable(featureId) ? featureId : null;
}

export function stripFeatureGuideMarkers(text) {
  return String(text || "")
    .replace(/\[\[GUIDE:[a-zA-Z0-9_-]+\]\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

const germanGuideKeywords = {
  attach_media: ["medien anhäng", "medien hochlad", "bild anhäng", "bild hochlad", "foto", "video anhäng"],
  upload_file: ["datei anhäng", "datei hochlad", "hochladen", "hochlad", "hochgelad", "datei", "anhang", "anhäng", "anhang hinzufüg"],
  process_attachment: ["anhang verarbeit", "datei verarbeit", "pdf konvertier", "docx konvertier", "dokument konvertier"],
  select_model: ["modell wechsel", "modell auswähl", "modell änder", "welches modell", "modell"],
  conversation_settings: ["unterhaltungseinstellung", "konversationseinstellung", "temperatur", "top p", "systemprompt", "system prompt", "reasoning effort", "denkaufwand"],
  voice_input: ["mikrofon", "sprachnachricht", "sprachaufnahme", "spracheingabe", "aufnehm", "aufnimm", "diktier"],
  send_key: ["sende taste", "senden taste", "eingabetaste", "umschalt enter", "shift enter", "enter taste"],
  arcana: ["arcana", "rag", "retrieval", "wissensdatenbank"],
  web_search: ["websuche", "web suche", "im internet such", "internetsuche", "online such"],
  image_generation: ["bilder erzeug", "bild erzeug", "bild generier", "bilder generier", "bild erstell", "bilder erstell", "text zu bild"],
  image_modification: ["bild bearbeit", "bilder bearbeit", "bild änder", "bilder änder", "bild modifizier", "bilder modifizier"],
  audio_generation: ["audio erzeug", "audio generier", "audio", "sprache erzeug", "sprache generier", "ton erzeug"],
  arcana_tools: ["arcana tools", "arcane tools", "arcana v2", "arcanav2", "arcana", "rag index", "freigabe", "teilen"],
  mcp_server: ["mcp", "mcp server", "mcp-server", "model context protocol"],
  diagram_renderers: ["graphviz", "dot", "vega", "vega-lite", "chart.js", "chartjs", "diagramm", "diagramme", "diagramm zeichnen", "chart"],
  browser_storage: ["browserspeicher", "browser speicher", "arbeitsbereich", "arbeitsfläche", "opfs", "lokale dateien"],
  workspace_edit_storage: ["speicher bearbeit", "speicherort", "quelle hinzufüg", "quelle einhäng", "ordner hinzufüg", "speicher hinzufüg"],
  workspace_saia_fs: ["saia dateien", "saia-dateien", "saia dateisystem", "kontoordner", "saia-fs"],
  tools_overview: ["werkzeuge", "tools", "gwdg tools", "tool nutzung", "werkzeug verwend"],
  search_chats: ["chats durchsuch", "chat durchsuch", "chat such", "unterhaltung such", "chat find", "suche nach chat"],
  manage_topics: ["thema", "themen", "topic", "themen erstell", "chats organisier"],
  sort_group_chats: ["chats sortier", "chats gruppier", "sortier", "gruppier", "nach datum sortier", "speichergröße", "nach größe sortier"],
  sort_organize: ["sortieren", "organisieren", "sort & organize", "chats aufräum", "chats organisier", "themen vorschlag", "ki organisation", "duplikate finden", "chats umbenenn", "sortieren und organisieren"],
  export_conversation: ["chat exportier", "unterhaltung exportier", "chat herunterlad", "chat speicher", "exportier"],
  import_conversation: ["chat importier", "unterhaltung importier", "importier", "chat wiederherstell"],
  chat_with_persona: ["persona", "personas", "mit persona chatten", "persona bibliothek", "persona auswähl", "persona starten"],
  close_chat: ["chat schließ", "chat lösch", "unterhaltung schließ", "unterhaltung lösch", "chat entfern", "metachat leer", "chat leeren"],
  share_conversation: ["chat teil", "unterhaltung teil", "einstellungen teil"],
  fork_conversation: ["chat abzweig", "unterhaltung abzweig", "chat verzweig", "unterhaltung verzweig", "fork"],
  summarize_conversation: ["chat zusammenfass", "unterhaltung zusammenfass", "zusammenfassung", "zusammenfass"],
  settings_overview: ["einstellung", "benutzereinstellung", "einstellungen änder", "datenschutzeinstellung"],
  memories: ["erinnerung", "gedächtnis", "merken", "gemerkt", "gespeicherte erinnerung"],
  chat_preferences: ["chat einstellung", "chat-einstellung", "benutzereinstellung", "präferenzen"],
  advanced_mode: ["erweiterter modus", "fortgeschritten", "erweiterte ansicht", "agenten in der seitenleiste", "mcp in der seitenleiste"],
  backup_restore: ["sicherung wiederherstell", "sicherung einlesen", "backup wiederherstell", "backup importier", "auf neues gerät", "chats übertrag"],
  rendering: ["typst", "latex", "darstellung", "rendern", "code rendern"],
  document_conversion: ["dokumentkonvertierung", "dokument konvertieren", "dokument umwandeln", "konvertierung", "browser konvertierung", "server konvertierung"],
  data_management: ["daten verwalt", "datenverwaltung", "datenschutz", "daten lösch", "cache lösch", "daten exportier"],
  dark_mode: ["dunkelmodus", "dunkler modus", "heller modus", "design", "theme", "farbschema"],
  feedback: ["feedback", "antwort bewert", "bewert", "daumen hoch", "daumen runter"],
  speech_output: ["vorles", "vorgeles", "sprachausgabe", "text zu sprache", "antwort vorles"],
  meta_chat_catalogs: ["metachat tutorial", "metachat anleitung", "tutorials durchsuch", "anwendungsfälle durchsuch", "tutorials find", "tutorial", "anleitung", "anwendungsfälle", "katalog", "einstellungen im metachat", "persona", "personas", "persona empfehl", "persona finden", "mit persona chatten", "metachat suche", "entscheidung finden", "aufgaben finden", "chats vergleichen", "zum chat", "zur nachricht", "zum thema", "einstellung öffnen"],
  meta_chat_search: ["metachat suche", "metachat durchsuch", "volltextsuche", "nachrichten durchsuchen", "nachricht finden", "entscheidung finden", "aufgaben finden", "zitat"],
  meta_chat_navigation: ["metachat navigation", "nachricht finden", "entscheidung finden", "aufgaben finden", "zum chat springen", "zur einstellung", "deep link", "zitat"],
  meta_chat_actions: ["metachat umbenennen", "meta chat umbenennen", "chat umbenennen", "chat verschieben", "chat in thema verschieben", "änderungen übernehmen", "vorschlag bestätigen"],
  meta_chat_pins: ["metachat anheften", "chat anheften", "chat nicht mehr anheften", "thema anheften", "angeheftete chats", "anheften metachat"],
  meta_chat_agents: ["metachat agenten", "agentenstatus", "agent verlauf", "agent dateien", "agent datei abrufen", "agent prompt", "agent unterbrechen"],
  meta_chat_workspaces: ["metachat arbeitsbereich", "arbeitsbereich verknüpfen", "arbeitsbereich trennen", "workspace link"],
  meta_chat_digest: ["metachat neuigkeiten", "was gibt es neues", "letzte aktivität", "neue agent dateien", "tagesübersicht"],
  meta_chat_mcp: ["metachat mcp", "mcp status", "mcp werkzeuge", "mcp server hinzufügen", "mcp server testen"],
  meta_chat_usage: ["metachat", "meta chat", "metachat verwend", "metachat öffn"],
};

const keywordStopWords = new Set([
  "a",
  "an",
  "and",
  "das",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "ein",
  "eine",
  "einer",
  "für",
  "im",
  "in",
  "me",
  "mit",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "und",
  "von",
  "zu",
]);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token && !keywordStopWords.has(token));
}

function containsKeyword(textTokens, keyword) {
  const tokens = tokenize(keyword);
  if (tokens.length === 0) return false;
  return tokens.every((token) =>
    textTokens.some((word) =>
      token.length <= 3 ? word === token : word.startsWith(token),
    ),
  );
}

export function findFeatureGuideForText(text) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized.trim()) return null;
  const textTokens = tokenize(normalized);

  let bestMatch = null;
  let bestLength = 0;

  for (const [featureId, guide] of Object.entries(featureGuides)) {
    if (!isFeatureGuideAvailable(featureId)) continue;
    const keywords = [
      ...(guide.keywords || []),
      ...(germanGuideKeywords[featureId] || []),
    ];
    for (const keyword of keywords) {
      if (
        containsKeyword(textTokens, keyword) &&
        keyword.length > bestLength
      ) {
        bestMatch = featureId;
        bestLength = keyword.length;
      }
    }
  }

  return bestMatch;
}

export function buildFeatureGuidePrompt() {
  return Object.entries(featureGuides)
    .filter(([featureId]) => isFeatureGuideAvailable(featureId))
    .map(([featureId, guide]) => `- ${featureId}: ${guide.prompt}`)
    .join("\n");
}
