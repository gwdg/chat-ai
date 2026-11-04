import {
  arcanaIdEntered,
  attachmentProcessed,
  ensureTool,
  ensureToolsEnabled,
  hasAttachmentCard,
  isToolActive,
  openConversationMenu,
  openConversationSettings,
  openUserSettings,
  selectSettingsTab,
} from "./featureGuideActions";

export const useCases = {
  analyze_paper: {
    category: "research",
    prompt:
      "Analyze a research paper: attach the PDF, process it, then ask questions about the references, methodology, and findings.",
    keywords: ["paper", "research paper", "analyze paper", "pdf analysis"],
    steps: [
      {
        textKey: "use_cases.common.start_new_chat",
        completeOnTargetClick: true,
        target: '[data-guide="new-chat"]',
      },
      {
        textKey: "use_cases.analyze_paper.step1",
        check: hasAttachmentCard,
        target: '[data-guide="attach-file"]',
        tutorialId: "upload_file",
      },
      {
        textKey: "use_cases.analyze_paper.step2",
        check: attachmentProcessed,
        target: ['[data-guide="process-file"]', '[data-guide="attachment-card"]'],
        tutorialId: "process_attachment",
      },
      {
        textKey: "use_cases.analyze_paper.step3",
        completeOnEvent: "message-complete",
        target: ".prompt-area",
      },
      {
        textKey: "use_cases.analyze_paper.step4",
        completeOnEvent: "message-complete",
        target: ".prompt-area",
      },
    ],
  },
  web_research: {
    category: "research",
    prompt:
      "Research current information with Web Search enabled, then ask a question that needs recent sources.",
    keywords: ["web research", "current information", "latest sources"],
    steps: [
      {
        textKey: "use_cases.common.start_new_chat",
        completeOnTargetClick: true,
        target: '[data-guide="new-chat"]',
      },
      {
        textKey: "use_cases.web_research.step1",
        completeOnTargetClick: true,
        target: '[data-guide="tools"]',
        tutorialId: "web_search",
      },
      {
        textKey: "use_cases.web_research.step2",
        check: () => isToolActive("web_search"),
        target: '[data-guide="tool-web_search"]',
        prepare: ensureToolsEnabled,
      },
      {
        textKey: "use_cases.web_research.step3",
        completeOnEvent: "message-complete",
        target: ".prompt-area",
      },
      {
        textKey: "use_cases.web_research.step4",
        completeOnEvent: "message-complete",
        target: ".prompt-area",
      },
    ],
  },
  rag_documents: {
    category: "research",
    prompt:
      "Use Arcana for RAG: connect an Arcana collection and ask questions that should be answered from the user's own documents.",
    keywords: ["rag", "arcana", "own documents", "knowledge base"],
    steps: [
      {
        textKey: "use_cases.common.start_new_chat",
        completeOnTargetClick: true,
        target: '[data-guide="new-chat"]',
      },
      {
        textKey: "use_cases.rag_documents.step1",
        completeOnTargetClick: true,
        target: '[data-guide="tools"]',
        tutorialId: "arcana",
      },
      {
        textKey: "use_cases.rag_documents.step2",
        check: () => isToolActive("arcana"),
        target: '[data-guide="tool-arcana"]',
        prepare: ensureToolsEnabled,
      },
      {
        textKey: "use_cases.rag_documents.step3",
        check: arcanaIdEntered,
        target: '[data-guide="arcana-id"]',
        prepare: () => ensureTool("arcana"),
      },
      {
        textKey: "use_cases.rag_documents.step4",
        completeOnEvent: "message-complete",
        target: ".prompt-area",
      },
      {
        textKey: "use_cases.rag_documents.step5",
        completeOnEvent: "message-complete",
        target: ".prompt-area",
      },
    ],
  },
  organize_topics: {
    category: "organize",
    prompt:
      "Organize chats by project using topics, then group or sort them for easier navigation.",
    keywords: ["organize", "topics", "projects", "group chats"],
    steps: [
      {
        textKey: "use_cases.organize_topics.step1",
        completeOnTargetClick: true,
        target: '[data-guide="create-topic"]',
        tutorialId: "manage_topics",
      },
      {
        textKey: "use_cases.organize_topics.step2",
        completeOnTargetClick: true,
        target: '[data-guide="topic-list"]',
        tutorialId: "sort_group_chats",
      },
    ],
  },
  find_chat: {
    category: "organize",
    prompt:
      "Find an old chat by searching titles or by asking the Meta chat where the conversation is.",
    keywords: ["find chat", "old chat", "search chat", "where is my chat"],
    steps: [
      {
        textKey: "use_cases.find_chat.step1",
        completeOnTargetClick: true,
        target: '[data-guide="search-chats"]',
        tutorialId: "search_chats",
      },
      {
        textKey: "use_cases.find_chat.step2",
        completeOnEvent: "message-complete",
        target: ".prompt-area",
        tutorialId: "meta_chat_usage",
      },
    ],
  },
  summarize_chat: {
    category: "organize",
    prompt:
      "Summarize a long conversation for notes or sharing.",
    keywords: ["summarize", "summary", "long chat", "meeting notes"],
    steps: [
      {
        textKey: "use_cases.summarize_chat.step1",
        completeOnTargetClick: true,
        target: '[data-guide="conversation-menu"]',
        tutorialId: "summarize_conversation",
      },
      {
        textKey: "use_cases.summarize_chat.step2",
        completeOnTargetClick: true,
        target: '[data-guide="summarize-chat"]',
        prepare: openConversationMenu,
      },
    ],
  },
  generate_image: {
    category: "create",
    prompt:
      "Create an image for a slide by enabling Image Generation and describing the visual.",
    keywords: ["image", "slide", "visual", "illustration"],
    steps: [
      {
        textKey: "use_cases.common.start_new_chat",
        completeOnTargetClick: true,
        target: '[data-guide="new-chat"]',
      },
      {
        textKey: "use_cases.generate_image.step1",
        completeOnTargetClick: true,
        target: '[data-guide="tools"]',
        tutorialId: "image_generation",
      },
      {
        textKey: "use_cases.generate_image.step2",
        check: () => isToolActive("image_generation"),
        target: '[data-guide="tool-image_generation"]',
        prepare: ensureToolsEnabled,
      },
      {
        textKey: "use_cases.generate_image.step3",
        completeOnEvent: "message-complete",
        target: ".prompt-area",
      },
    ],
  },
  share_setup: {
    category: "create",
    prompt:
      "Share a reusable conversation setup as a link containing the system prompt, model, and settings.",
    keywords: ["share setup", "share settings", "reusable setup"],
    steps: [
      {
        textKey: "use_cases.share_setup.step1",
        completeOnTargetClick: true,
        target: ".settings-toggle",
        tutorialId: "share_conversation",
      },
      {
        textKey: "use_cases.share_setup.step2",
        completeOnTargetClick: true,
        target: '[data-guide="share-settings"]',
        prepare: openConversationSettings,
      },
    ],
  },
  compare_models: {
    category: "workflows",
    prompt:
      "Compare models by forking a conversation, changing the model, and asking the same question.",
    keywords: ["compare models", "different model", "model comparison"],
    steps: [
      {
        textKey: "use_cases.compare_models.step1",
        completeOnTargetClick: true,
        target: '[data-guide="fork-button"]',
        tutorialId: "fork_conversation",
      },
      {
        textKey: "use_cases.compare_models.step2",
        completeOnTargetClick: true,
        target: [".model-selector", ".model-selector-header"],
        tutorialId: "select_model",
      },
      {
        textKey: "use_cases.compare_models.step3",
        completeOnEvent: "message-complete",
        target: ".prompt-area",
      },
    ],
  },
  local_conversion: {
    category: "workflows",
    prompt:
      "Keep PDF and DOCX conversion in the browser for privacy by changing the document-conversion preference.",
    keywords: ["local conversion", "browser conversion", "privacy"],
    steps: [
      {
        textKey: "use_cases.common.start_new_chat",
        completeOnTargetClick: true,
        target: '[data-guide="new-chat"]',
      },
      {
        textKey: "use_cases.local_conversion.step1",
        completeOnTargetClick: true,
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        tutorialId: "document_conversion",
      },
      {
        textKey: "use_cases.local_conversion.step2",
        completeOnTargetClick: true,
        target: '[data-guide="document-conversion-preference"]',
        prepare: () => {
          openUserSettings();
          selectSettingsTab("chat");
        },
      },
      {
        textKey: "use_cases.local_conversion.step3",
        check: hasAttachmentCard,
        target: '[data-guide="attach-file"]',
      },
      {
        textKey: "use_cases.local_conversion.step4",
        check: attachmentProcessed,
        target: '[data-guide="process-file"]',
      },
    ],
  },
  memories: {
    category: "workflows",
    prompt:
      "Save preferences and context in memories so future chats can recall them.",
    keywords: ["memories", "remember", "preferences"],
    steps: [
      {
        textKey: "use_cases.common.start_new_chat",
        completeOnTargetClick: true,
        target: '[data-guide="new-chat"]',
      },
      {
        textKey: "use_cases.memories.step1",
        completeOnTargetClick: true,
        target: ['[data-guide="user-settings"]', ".user-profile-button", ".user-profile-block"],
        tutorialId: "memories",
      },
      {
        textKey: "use_cases.memories.step2",
        completeOnTargetClick: true,
        target: '[data-guide="settings-tab-memories"]',
        prepare: openUserSettings,
      },
      {
        textKey: "use_cases.memories.step3",
        completeOnEvent: "message-complete",
        target: ".prompt-area",
      },
    ],
  },
  read_aloud: {
    category: "workflows",
    prompt:
      "Listen to an answer with the speech button when the speech module is enabled.",
    keywords: ["read aloud", "listen", "speech"],
    steps: [
      {
        textKey: "use_cases.read_aloud.step1",
        completeOnTargetClick: true,
        target: '[data-guide="speak"]',
        tutorialId: "speech_output",
      },
      {
        textKey: "use_cases.read_aloud.step2",
        completeOnTargetClick: true,
        target: '[data-guide="speak"]',
      },
    ],
  },
};

export const USE_CASE_CATEGORIES = {
  research: ["analyze_paper", "web_research", "rag_documents"],
  organize: ["organize_topics", "find_chat", "summarize_chat"],
  create: ["generate_image", "share_setup"],
  workflows: [
    "compare_models",
    "local_conversion",
    "memories",
    "read_aloud",
  ],
};

export const USE_CASE_MARKER_PATTERN = /\[\[USE_CASE:([a-zA-Z0-9_-]+)\]\]/i;

export function buildUseCaseGuide(useCaseId) {
  const useCase = useCases[useCaseId];
  if (!useCase) return null;
  return {
    id: `use_case:${useCaseId}`,
    titleKey: `use_cases.${useCaseId}.title`,
    steps: useCase.steps.map((step) => ({
      target: step.target,
      textKey: step.textKey,
      prepare: step.prepare,
      check: step.check,
      completeOnEvent: step.completeOnEvent,
      completeOnTargetClick: step.completeOnTargetClick,
    })),
  };
}

export function getUseCaseMarker(text) {
  const match = String(text || "").match(USE_CASE_MARKER_PATTERN);
  const useCaseId = match?.[1]?.toLowerCase();
  return useCaseId && useCases[useCaseId] ? useCaseId : null;
}

export function stripUseCaseMarkers(text) {
  return String(text || "")
    .replace(/\[\[USE_CASE:[a-zA-Z0-9_-]+\]\]/gi, "")
    .replace(/\[\[USE_CASE:?[a-zA-Z0-9_-]*\]*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

export function buildUseCasePrompt() {
  return Object.entries(useCases)
    .map(([useCaseId, useCase]) => `- ${useCaseId}: ${useCase.prompt}`)
    .join("\n");
}
