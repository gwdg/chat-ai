export default {
    // Common phrases
    common: {
      loading: "Loading...",
      undo: "Undo",
      rename: "Rename",
      import: "Import Chat",
      export: "Export Chat",
      clear: "Clear",
      abort: "Abort",
      send: "Send",
      stop: "Stop",
      share: "Share",
      delete: "Delete",
      cancel: "Cancel",
      refresh: "Refresh",
      notice: "Notice",
      disclaimer: "Disclaimer",
      understand: "I Understand",
      ok: "OK",
      record_start: "Record (click/hold)",
      record_stop: "Stop (click/release)",
      dont_show_again: "Don't show this again",
      backup_data: "Backup Data",
      skip_backup: "Skip Backup",
      upgrade_chat_ai: "Upgrade Chat AI",
    },
    // Sidebar
    sidebar: {
      new_conversation: "New Conversation",
      import_persona: "Chat with Persona",
    },
    // Settings panel
    settings: {
      tools_enabled: "Tools are enabled",
      tools_disabled: "Tools are disabled",
      web_search_enabled: "Web search is enabled",
      web_search_disabled: "Web search is disabled",
      system_prompt_placeholder: "Enter the system prompt here",
      reset_default: "Reset default",
      default: "Default",
    },
    // Conversation
    conversation: {
      prompt: {
        placeholder: "Ask me",
        attach: "Attach File",
        attach_media: "Attach Media",
        attachments: "Attachments",
        clear_attachments: "Clear all",
      },
      attachment: {
        "image_unsupported": "Switch model to process image",
        "audio_unsupported": "Switch model to process audio",
        "file_unsupported": "Switch model to process {{filetype}}",
        "unprocessed": "Unprocessed file",
      },
      reasoning: "Reasoning Process",
      action: "Action",
      sources: "Sources and References",
      references: "References",
      empty_message: "Your conversations are never stored on our servers",
    },
    // Footer
    footer: {
      imprint: "Imprint",
      terms: "Terms of Use",
      privacy: "Data Privacy",
      faq: "FAQ",
      contact: "Contact Us",
      about: "About",
      copyright: "All Rights Reserved",
      iso_certified: "ISO 27001 Certified",
    },
    // User Settings Modal
    user_settings: {
        title: "User Profile Settings",
        default_model: {
          title: "Default Model",
          current: "Current: {{currentModel}}",
          description: "Select the default model for new conversations.",
        },
        timeout: {
          title: "Request Timeout",
          description:
            "Set how long to wait for AI responses before timing out.",
          seconds: "Timeout (seconds)",
          range: "Range: 5-900 seconds",
        },
        data: {
          title: "Manage Data",
          description: `Here you can manage all locally stored data. This data is only stored on your device.\n\n
                            Clearing data will result in permanently losing access to all past conversations, memories, settings, and attachments.`,
        },
        clear_data_button: "Clear Data",
        export_data_button: "Export Data",
        memory: {
          title:"User Memories",
          description:
            "Manage your personal memories that help the AI remember important details about you. You currently have {{count}} memories saved.",
          manage: "Manage Memory",
        },          
        logout: "Logout",
    },
    // Import Persona Modal
    persona: {
      selectPersona: "Select Persona",
      browsePersonas: "Browse and import AI personas",
      personas: "Personas",
      back: "Back",
      errorLoading: "Error loading personas",
      retry: "Retry",
      noPersonas: "No personas found in this folder",
      configuration: "Persona configuration",
      folder: "Folder",
      createOwn: "Create Your Own",
      importFromClipboard: "Import from Clipboard",
      importFromClipboardErrorInvalidJson:
        "Failed to import persona from clipboard. No valid JSON found.",
      importFromClipboardErrorInvalidPersona:
        "Failed to import persona from clipboard. Invalid persona data.",
      personaLibrary: "Persona Library",
      categories: "Categories",
      quickImport: "Quick Import",
      selectFolder: "No category selected",
      selectFolderDescription:
        "Select a category from the sidebar to view personas",
      emptyFolder: "This folder is empty",
      categoryCount: "{{folders}} categories • {{files}} personas",
    },
    // Memory Modal
    memory: {
      userMemory: "User Memory",
      memoryCount_one: "{{count}} memory stored",
      memoryCount_other: "{{count}} memories stored",
      addNew: "Add New Memory",
      add: "Add",
      savedMemories: "Saved Memories",
      deleteAll: "Delete All",
      noMemories: "No memories saved yet.",
      addFirst: "Add your first memory above!",
      save: "Save",
      cancel: "Cancel",
      created: "Created: {{date}}",
      edit: "Edit",
      delete: "Delete",
      clearAllTitle: "Clear All Memories",
      clearAllWarning:
        "Are you sure you want to delete all {{count}} memories? This action cannot be undone and will permanently remove all your saved memories.",
      warningTitle: "Warning",
      warningText:
        "You will lose all personal memories that help the AI understand your preferences and context. Consider exporting them first if needed.",
      dontShowAgain: "Don't show this warning again",
      clearAll: "Clear All Memories ({{count}})",
    },
    // Export Conversation Modal
    export_conversation: {
      title: "Export Options",
      // File format
      json: "JSON file",
      pdf: "PDF file",
      text: "TXT file",
      export: "Export",
      export_settings: "Include model and options",
      export_files: "Include files",
      export_arcana: "Include Arcana details",
    },
    // Rename Conversation Modal
    rename_conversation: {
      title: "Rename conversation",
      enter_name: "Enter conversation title",
      alert_empty: "Title is required",
    },
    // Delete Conversation Modal
    delete_conversation: {
      title: "Delete Conversation",
      description:
        "Are you sure you want to delete this conversation?",
    },
    // Share Settings Modal
    share_settings: {
       description:
      "This feature creates a shareable link for your chosen model, system prompt, and settings. Any user who opens this link will be able to use the same configuration in their own conversations. Please note that your conversation history will not be shared.",
      warn_arcana:
      "Warning: Sharing arcana details may compromise data uploaded in the arcana.",
    },
    // Help modals
    help: {
      title: "Help",
      arcana:
      "Arcana is a unique feature of our service that empowers the LLM with specialized knowledge. When you enter a valid Arcana ID and its corresponding key, the LLM gains access to the knowledge contained within that Arcana. This enables the model to generate responses that are more informed and relevant to your needs. Leave the ID empty to use the model without any specialized knowledge.",
      models:
      "Chat AI provides access to a range of state-of-the-art Large Language Models (LLMs), each with distinct capabilities and performance characteristics. This allows you to explore and select the model that best aligns with your research goals and requirements. \
      Larger models typically offer higher-quality responses, but may have longer response times due to their increased complexity. Conversely, smaller models provide faster response times, but may sacrifice some accuracy and depth. With the list of available models, you can balance trade-offs between response quality and speed to suit your specific needs. For more details",
    
      memory:
      "Memory enhances conversation continuity by remembering context from previous messages. 'None' disables memory functionality - each conversation is treated independently. 'Recall' adds memory context to the system prompt, allowing the AI to reference earlier parts of your conversation. 'Learn' works similar to Recall, but also updates the memory with relevant parts of the current conversation. This feature provides a more natural conversational experience similar to other AI services. Memories are only stored locally in your browser.",
      system_prompt:
      "The system prompt is a special command or instruction given at the beginning of a conversation to set the tone, context, or constraints for our interaction. It's a way to guide the model's behavior and ensure that it responds in a helpful and appropriate manner.",
      temperature:
        "A low temperature (e.g., 0-1) produces more predictable and logical responses, while higher temperatures (e.g., above 1) increase the possibility of more creative and unconventional responses. You can adjust the temperature setting to achieve different levels of predictability and creativity.",
      tools:
        "Tools are a new and experimental feature designed to extend the capabilities of Chat AI. They allow the model to perform additional actions or access additional resources in order to provide more useful, accurate, or specialized responses. Current tools include Arcana (for all models) and Web Search (optional), with more tools planned for the future. As this feature is still evolving, functionality and available tools may change over time.",
      web_search:
        "The web search tool allows the AI to look up the latest information from the internet to improve its responses. When enabled, the AI can generate search queries based on your question and the full conversation history, send them to a search engine (such as DuckDuckGo), and use the retrieved results to provide more accurate and up-to-date answers. This is especially useful for topics where current or rapidly changing information is important.",
      top_p:
        "top_p is a slider from 0 to 1 which adjusts the total population of probabilities considered for the next token. A top_p of 0.1 would mean only the top 10% of cumulative probabilities is considered. Variating top_p has a similar effect on predictability and creativity as temperature.",
    },
    // Tour
    tour: {
      welcome_message: "Welcome to Chat AI",
      start_tour: "Start Tour",
      skip_tour: "Skip tour",
      description: "Click the button below to begin the guided tour and explore the new user interface.",
      prompt: "You can simply type a message here to start a conversation with Chat AI. You can attach files to your message; the model will use it if it understands the file type.",
      model: "Here you can select the model to chat with. Each model has its unique capabilities and limitations.",
      sidebar: "In the sidebar you can add, export, delete, and switch conversations. You can import and export conversations to your device, or choose a Persona to chat with.",
      settings: "In the settings panel, you can adjust the system prompt, temperature, and top_p. You can specify Chat AI's memory settings and enable new GWDG tools, including arcana, image generation, and web search.",
      profile: "Just below the settings button, this button will open your user profile, where you can set your preferences, manage memories, and export or clear your data.",
      interface: "In this corner you can switch the theme and language of Chat AI.",
      memory: {
        off: "Memory - None: Chat AI won't remember anything from previous conversations, like before.",
        recall: "Recall: Chat AI can use relevant memories about you from previous conversations, but won't memorize anything from the current conversation.",
        on: "Learn: Chat AI actively learns stuff about you from the current conversation and also recalls memories it gained previously.",
        settings:
          "You can always view, add, edit, and remove memories from the User Profile panel in the top-right corner. Memories are only stored locally in your browser.",
      },
      back: "Back",
      close: "Close",
      last: "Finish",
      next: "Next",
      skip: "Skip Tour",
    },
    // Alerts and warnings
    alert: {
      title: "Warning",
      bad_request: "Bad request was sent: Please clear conversation, reattempt within the limit, and save your chat history for future reference.",
      clear_data:
        "Caution! Clearing data will erase all your conversations, history, and settings. Are you sure?",
      clear_messages:
      "Are you sure you want to erase all messages in this conversation?",
      no: "No, go back",
      yes: "Yes, clear everything",
      system_prompt_empty: "System prompt is empty. Model may not respond.",
      external_model:
        "You are using an external model. Your messages will be processed outside of GWDG, and the custom settings will not be applied.",
      external_model_mpg:
        "You are using an external model. Your messages will be processed outside of GWDG, and the custom settings will not be applied. External models can only be used by scientific employees for scientific work, provided that no personal data is entered.",
      arcana_usage:
        "Keep temperature at 0 and top_p at 0.05 for optimal arcana results",
      arcana_export:
        "Warning: Exporting Arcana details to a file may compromise your private data, as it can be accessed by others.",
      model_offline:
      "The model you selected is currently offline. By pressing OK below, the model starts up and will be online in a few minutes. In the meantime, feel free to choose another model.",
      session_expired:
      "Your session has expired. Please press OK to refresh.",
      unsent_files:
      "You have attached files that will be lost. Are you sure you want to leave?",
      unprocessed_files:
        "Please process or remove the attached PDF to continue.",
      migrate_data:
        "It looks like you're using an older version of Chat AI. To continue, your previous conversations and data need to be upgraded. Please back up your data first if needed, then press 'Upgrade' to start the process.",
      // Hallucination warning
      hallucination: {
        note1: "Note: Chatbots are prone to",
        note2: "and their responses should not be considered accurate.",
        note3: "Hallucination",
      },
      // External models
      settings_external: "These settings will not affect external (OpenAI) models.",
      web_search_disclaimer: 
      `When web search is enabled, the AI may generate search queries based on your message and the full conversation history, and send them to a search engine (e.g., DuckDuckGo) to retrieve up-to-date information. This helps provide more accurate and current responses.\n\nBy clicking “I Understand,” you agree that your input may be processed in this way and acknowledge that you will not share any confidential, personal, or sensitive information while web search is active.`
    },
    // Landing page
    landing: {
      title: "You are not logged in",
      description: "Please login to use Chat AI.",
      reasonsTitle: "You can login if you are:",
      reasons: {
        deleted:
          "• member of a German university or research institution",
        outdatedLink: "• member of an organization in DFN",
        incorrectId: "• a registered user in AcademicCloud",
        historyCleared: "• granted access by the GWDG",
      },
      reassurance: "Simply use the button below to log in.",
      buttonText: "Login with AcademicCloud SSO",
    },
    not_found: {
      title: "404: Conversation Not Found",
      description:
        "Oops! It seems like you're trying to access a conversation that doesn't exist in your chat history.",
      reasonsTitle: "This might happen because:",
      reasons: {
        deleted: "• The conversation was deleted",
        outdatedLink: "• You're using an outdated or invalid link",
        incorrectId: "• The conversation ID in the URL is incorrect",
        historyCleared: "• Your chat history was cleared",
      },
      reassurance:
        "Don't worry! You can start a new conversation by clicking the button below.",
      buttonText: "Go to chat",
    },
    // Announcement
    announcement: "",
}