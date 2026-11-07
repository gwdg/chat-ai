import {
  arcanaIdEntered,
  attachmentProcessed,
  ensureTool,
  ensureToolsEnabled,
  hasAttachmentCard,
  isToolActive,
  mcpConfigured,
  openConversationMenu,
  openConversationSettings,
  openSearch,
  openSortMenu,
  openTools,
  openTopicCreate,
  openTopicMenu,
  openUserSettings,
  searchHasQuery,
  selectSettingsTab,
  toolsAreEnabled,
  topicNameEntered,
} from "./featureGuideActions.js";

export const featureGuides = {
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
      "Attach a file to the current chat. The paperclip button in the prompt box opens the file picker. After attaching, PDF and DOCX files may need to be processed. Then add a message and send it.",
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
  mcp_server: {
    titleKey: "feature_guide.mcp_server.title",
    prompt:
      "Connect an MCP server. Open Tools, enable tools, select MCP Server, then enter the server configuration.",
    keywords: ["mcp", "mcp server", "model context protocol"],
    steps: [
      {
        target: '[data-guide="tools"]',
        textKey: "feature_guide.mcp_server.step1",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="tools-enable"]',
        prepare: openTools,
        textKey: "feature_guide.mcp_server.step2",
        check: toolsAreEnabled,
      },
      {
        target: '[data-guide="tool-mcp"]',
        prepare: ensureToolsEnabled,
        textKey: "feature_guide.mcp_server.step3",
        check: () => isToolActive("mcp"),
      },
      {
        target: '[data-guide="mcp-input"]',
        prepare: () => ensureTool("mcp"),
        textKey: "feature_guide.mcp_server.step4",
        check: mcpConfigured,
      },
    ],
  },
  tools_overview: {
    titleKey: "feature_guide.tools_overview.title",
    prompt:
      "GWDG Tools add web search, image, audio, and video generation, Arcana, and MCP servers. Open Tools and enable them to see the available buttons.",
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
    ],
  },
  sort_organize: {
    titleKey: "feature_guide.sort_organize.title",
    prompt:
      "Use Sort & organize in the sidebar header to let the model suggest topics, titles, and cleanup for your chats. Review the proposal, select what you want, and apply it. Nothing changes before you apply.",
    keywords: [
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
      "Sort and group chats by topic, date, or creation date from the sidebar sort menu.",
    keywords: ["sort chats", "group chats", "grouping", "sort by date", "sort"],
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
        target: [
          '[data-guide="rendering-preference"]',
          '[data-guide="document-conversion-preference"]',
        ],
        textKey: "feature_guide.settings_overview.step3",
        completeOnTargetClick: true,
        prepare: () => selectSettingsTab("chat"),
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
  chat_preferences: {
    titleKey: "feature_guide.chat_preferences.title",
    prompt:
      "Open user settings and choose the Chat tab to change chat preferences, rendering, document conversion, and more.",
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
        target: '[data-guide="settings-tab-chat"]',
        prepare: openUserSettings,
        textKey: "feature_guide.rendering.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="rendering-preference"]',
        prepare: () => selectSettingsTab("chat"),
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
        target: '[data-guide="settings-tab-chat"]',
        prepare: openUserSettings,
        textKey: "feature_guide.reasoning_streaming.step2",
        completeOnTargetClick: true,
      },
      {
        target: '[data-guide="reasoning-streaming-preference"]',
        prepare: () => selectSettingsTab("chat"),
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
        prepare: () => selectSettingsTab("data"),
        textKey: "feature_guide.data_management.step3",
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
  feedback: {
    titleKey: "feature_guide.feedback.title",
    prompt:
      "Rate an assistant message with the feedback buttons when the feedback module is enabled.",
    keywords: ["feedback", "rate answer", "thumbs up", "thumbs down"],
    steps: [
      {
        target: '[data-guide="feedback"]',
        textKey: "feature_guide.feedback.step1",
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
      "Ask the Meta chat to pin or unpin a chat or topic. Pinned items appear in the pinned area at the top of the sidebar. The change is proposed in a warning card and applied only after the user accepts it.",
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

export const FEATURE_CATEGORIES = {
  meta_chat: [
    "meta_chat_usage",
    "meta_chat_catalogs",
    "meta_chat_search",
    "meta_chat_navigation",
    "meta_chat_actions",
    "meta_chat_pins",
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
    "audio_generation",
    "mcp_server",
  ],
  chats: [
    "search_chats",
    "manage_topics",
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
  personas: ["chat_with_persona"],
  settings: [
    "settings_overview",
    "chat_preferences",
    "memories",
    "rendering",
    "reasoning_streaming",
    "document_conversion",
    "data_management",
    "dark_mode",
  ],
  other: ["feedback", "speech_output"],
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
  return featureId && featureGuides[featureId] ? featureId : null;
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
  mcp_server: ["mcp", "mcp server", "mcp-server", "model context protocol"],
  tools_overview: ["werkzeuge", "tools", "gwdg tools", "tool nutzung", "werkzeug verwend"],
  search_chats: ["chats durchsuch", "chat durchsuch", "chat such", "unterhaltung such", "chat find", "suche nach chat"],
  manage_topics: ["thema", "themen", "topic", "themen erstell", "chats organisier"],
  sort_group_chats: ["chats sortier", "chats gruppier", "sortier", "gruppier", "nach datum sortier"],
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
    .map(([featureId, guide]) => `- ${featureId}: ${guide.prompt}`)
    .join("\n");
}
