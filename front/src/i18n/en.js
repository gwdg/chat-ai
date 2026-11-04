export default {
  // Common phrases
  common: {
    loading: "Loading...",
    undo: "Undo",
    scroll: "Scroll to bottom",
    scroll_to_top: "Scroll to top",
    scroll_to_message: "Jump to start of message",
    next_message: "Scroll to next message",
    previous_message: "Scroll to previous message",
    rename: "Rename",
    create: "Create",
    save: "Save",
    import: "Import Chat",
    export: "Export Chat",
    summarize: "Summarize",
    summarizing: "Summarizing...",
    summarize_success: "Summary created in a new conversation.",
    summary_title: "Summary of {{title}}",
    summarize_error: "Summarization failed. Your conversation is unchanged.",
    clear: "Clear",
    abort: "Abort",
    send: "Send",
    send_shortcut: "Send (Enter)",
    send_shortcut_shift_enter: "Send (Shift+Enter)",
    stop: "Stop",
    share: "Share",
    delete: "Delete",
    cancel: "Cancel",
    close: "Close",
    allow: "Allow",
    disallow: "Disallow",
    refresh: "Refresh",
    notice: "Notice",
    disclaimer: "Disclaimer",
    understand: "I Understand",
    ok: "OK",
    record_start: "Record (click/hold)",
    record_stop: "Stop (click/release)",
    dont_show_again: "Don't show this again",
    regenerate: "Regenerate response",
    fork: "Continue in a new chat",
    backup_data: "Backup Data",
    skip_backup: "Skip Backup",
    upgrade_chat_ai: "Upgrade Chat AI",
  },
  feedback:{
    thumbsup:"The response is good.",
    thumbsdown: "The response is not so good.",
    send: "Send a detailed feedback describing your observation."
  },
  // Sidebar
  sidebar: {
    new_conversation: "New Chat",
    import_persona: "Chat with Persona",
    expand: "Expand",
    extend: "Expand",
    open_sidebar: "Open Sidebar",
    close_sidebar: "Close Sidebar",
    rename_tooltip: "Rename: {{title}}",
    shortcut_new_conversation: "Ctrl + Shift + O",
    user_section: "User",
  },
  folders: {
    title: "Chats",
    all: "All chats",
    uncategorized: "Unsorted Chats",
    by_date: "All chats by date",
    by_created: "All chats by creation date",
    sort_label: "Sort chats",
    sort_by_topic: "By topic",
    sort_by_date: "By date",
    sort_by_created: "By creation date",
    modified: "Modified {{date}}",
    dateBuckets: {
      today: "Today",
      yesterday: "Yesterday",
      lastWeek: "Last week",
      lastMonth: "Last month",
      older: "Older",
    },
    create_button: "New topic",
    expand_topic: "Expand topic",
    collapse_topic: "Collapse topic",
    empty_topic: "Drag a chat here.",
    search_label: "Search",
    search_action: "Search chats",
    search_placeholder: "Search by title",
    search_no_results: 'No matches for "{{query}}"',
    clear_search: "Clear search",
    create_title: "Create topic",
    rename_title: "Rename topic",
    delete_title: "Delete topic",
    delete_description:
      'Delete topic "{{name}}"? Chats remain available and move to "Unsorted Chats".',
    name_label: "Topic name",
    name_placeholder: "Enter topic name",
    error_required: "Please enter a topic name.",
    create_blurb: "Group related chats under a new topic. Configure the name, color, and icon of the topic.",
    blurb_examples: "Examples",
    suggestion_homework: "Homework",
    suggestion_writing: "Writing",
    suggestion_health: "Health",
    suggestion_research: "Research",
    creating: "Creating…",
    done: "Done",
    choose_color: "Choose a colour",
    choose_icon: "Choose an icon",
    error_generic: "Could not complete the action. Please try again.",
    move_title: "Move to topic",
    move_description: 'Choose a topic for "{{title}}"',
    move_action: "Move",
    new_folder_prompt: "Create new topic",
    create_inline: "Create",
  },
  topic_view: {
    chat_count_one: "{{count}} chat",
    chat_count_other: "{{count}} chats",
    empty_title: "No chats in this topic yet",
    empty_body: "Write a prompt below to start the first chat here.",
    composer_placeholder: "Ask anything — starts a new chat in {{name}}",
    create_error: "Could not start a new chat. Please try again.",
    missing_topic: "This topic no longer exists",
    missing_topic_body:
      "It may have been deleted. Choose another topic from the sidebar.",
    back_to_chats: "Back to chats",
    loading: "Loading topic…",
  },
  sorter: {
    button: "Sort & organize",
    title: "Sort & organize chats",
    intro:
      "Review the suggestions below. Nothing is changed until you apply them.",
    ai_model_note:
      "Chat titles, available summaries, and existing topic names are analyzed by the default ChatAI model.",
    ai_analyzing: "Analyzing your chats with {{model}}…",
    ai_error:
      "The model could not analyze your chats. No changes are shown.",
    ai_retry: "Try the model again",
    ai_limited:
      "Analyzed the {{analyzed}} most recent of {{total}} chats. Older chats were left unchanged.",
    ai_default_model: "the default model",
    assessment_title: "Model assessment",
    preview_title: "Proposed structure",
    include_topic_rename: "Include topic rename",
    include_title_change: "Include title change",
    new_topic: "New topic",
    existing_topic: "Existing topic",
    no_changes: "No topic changes suggested.",
    select_all_moves: "Select all",
    deselect_all_moves: "Deselect all",
    deletions_title: "Suggested deletions",
    deletions_hint:
      "Deletions proposed by the model appear here. They are not selected by default.",
    no_deletions: "No deletions suggested.",
    reason_empty: "Empty chat",
    reason_duplicate: 'Duplicate of "{{title}}"',
    reason_duplicate_generic: "Duplicate chat",
    select_all_deletions: "Select all deletions",
    deselect_all_deletions: "Deselect all deletions",
    summary_moves: "{{count}} moves",
    summary_new_topics: "{{count}} new topics",
    summary_titles: "{{count}} title changes",
    summary_topic_renames: "{{count}} topic renames",
    summary_deletions: "{{count}} deletions",
    apply: "Apply changes",
    applying: "Applying…",
    error_name: "Please give every new topic a name.",
    error_generic: "Could not apply the changes. Please try again.",
    success: "Chats reorganized.",
    categories: {
      code: "Programming",
      writing: "Writing",
      research: "Research",
      data: "Data & analysis",
      planning: "Planning",
      learning: "Learning",
      health: "Health",
      travel: "Travel",
      finance: "Finance",
      creative: "Creative work",
    },
  },
  meta_chat: {
    title: "Meta chat",
    open: "Metachat: ask about your chats",
    banner_description: "Metachat can help you in two ways:",
    purposes: {
      tutor: "Learn how to use Chat AI features",
      tutor_example: "“How do I find a tutorial or check my settings?”",
      find: "Find your past chats and topics",
      find_example: "“Where is my chat about my food order?”",
    },
    clear_chat: "Clear chat",
    proposed_changes: "Proposed changes",
    mutation_warning:
      "These changes modify your chats, settings, or memories. Review them before applying.",
    accept_changes: "Accept changes",
    applying_changes: "Applying…",
    changes_applied: "Changes applied",
    revert_changes: "Revert changes",
    reverting: "Reverting…",
    changes_reverted: "Changes reverted",
    revert_mismatch:
      "Cannot revert because the current state no longer matches the applied change.",
    apply_failed: "Could not apply the changes.",
    rename_summary: "Rename “{{from}}” to “{{to}}”",
    move_summary: "Move “{{title}}” to “{{topic}}”",
    setting_summary: "Change {{setting}} from “{{from}}” to “{{to}}”",
    setting_temperature: "Temperature",
    setting_top_p: "Top-p",
    conversation_setting_all_summary:
      "Set {{setting}} to “{{value}}” for all chats",
    conversation_setting_summary: "Set {{setting}} to “{{value}}” in “{{title}}”",
    add_memory_summary: "Add memory “{{text}}”",
    update_memory_summary: "Update memory “{{from}}” to “{{to}}”",
    delete_memory_summary: "Delete memory “{{text}}”",
    clear_memories_summary: "Delete all saved memories",
    memory_item: "Memory {{index}}",
    setting_on: "on",
    setting_off: "off",
    setting_device_default: "device default",
    unsorted_topic: "Unsorted",
    error: "Could not answer. Please try again.",
    no_model: "No default model is configured.",
  },
  feature_guide: {
    catalog: {
      open: "Browse tutorials",
      close: "Hide tutorials",
      title: "Tutorials",
      search: "Search tutorials",
      empty: "No tutorials found.",
      hide_completed: "Hide completed",
      completed_successfully: "Completed successfully",
      completed: "Completed",
      start: "Start",
      replay: "Replay",
      steps: "{{count}} steps",
    },
    walkthrough_complete: "Walkthrough complete",
    dont_show_again: "Don't show this again",
    completed_title: "Tutorial complete",
    more_tutorials: "More tutorials",
    categories: {
      meta_chat: "Using the Meta chat",
      prompt: "Prompt and chat",
      tools: "Tools and RAG",
      chats: "Chats and organization",
      personas: "Personas",
      settings: "Settings",
      other: "More",
    },
    show_me: "Show me: {{title}}",
    show_me_short: "Show me",
    step: "Step {{current}} of {{total}}",
    status_title: "Tutorial progress",
    status_waiting: "Waiting for you to complete this step",
    status_ready: "Step complete",
    status_manual: "Continue when ready",
    status_done: "Tutorial complete",
    complete_step: "Complete this step to continue.",
    next: "Next",
    back: "Back",
    done: "Done",
    close: "Close",
    attach_media: {
      title: "Attach media to a chat",
      step1: "Click the image button in the prompt box.",
      step2:
        "Choose an image, audio, or video file if the current model supports it. The file appears above the prompt.",
      step3: "Add a message and click Send.",
    },
    upload_file: {
      title: "Attach a file to a chat",
      step1: "Click the paperclip in the prompt box to open the file picker.",
      step2:
        "Choose a file. It appears above the prompt; PDF and DOCX files may need to be processed first.",
      step3:
        "Add your message and click Send. The model uses the file if it supports that file type.",
    },
    process_attachment: {
      title: "Process an attachment",
      step1: "Attach a PDF or DOCX file, or find its attachment card above the prompt.",
      step2: "Choose Process in browser or Process on server.",
      step3:
        "Wait for the processed Markdown file, then send your message.",
    },
    select_model: {
      title: "Select a model",
      step1:
        "Open the model selector here to see the available models and their capabilities. The header selector is used on small screens.",
    },
    conversation_settings: {
      title: "Change conversation settings",
      step1: "Click the settings icon in the prompt box.",
      step2:
        "Adjust the memory mode, temperature, top_p, reasoning effort, or system prompt for this chat.",
    },
    voice_input: {
      title: "Record a voice message",
      step1:
        "Click the microphone. Allow microphone access if the browser asks for it.",
      step2:
        "The recording is attached to the prompt. Add text if needed and send.",
    },
    send_key: {
      title: "Choose how to send messages",
      step1: "Open your user settings.",
      step2: "Choose the Chat tab.",
      step3:
        "Set Send message with to Enter or Shift+Enter. Alt+Enter always inserts a newline.",
    },
    arcana: {
      title: "Use Arcana for RAG",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Enable tools.",
      step3: "Select Arcana.",
      step4:
        "Enter your Arcana ID. Use the help link to create a collection if you do not have one.",
    },
    web_search: {
      title: "Use Web Search",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Enable tools.",
      step3: "Select Web Search and accept the disclaimer when it appears.",
    },
    image_generation: {
      title: "Generate images",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Enable tools.",
      step3: "Select Image Generation, then describe the image you want.",
    },
    image_modification: {
      title: "Modify images",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Enable tools.",
      step3: "Select Image Modification, then attach or describe the image.",
    },
    audio_generation: {
      title: "Generate audio",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Enable tools.",
      step3: "Select Audio Generation, then describe the audio you want.",
    },
    video_generation: {
      title: "Generate videos",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Enable tools.",
      step3:
        "Select Video Generation. The video queue shows the progress of your requests.",
    },
    mcp_server: {
      title: "Connect an MCP server",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Enable tools.",
      step3: "Select MCP Server.",
      step4: "Enter the MCP server configuration in the field below.",
    },
    tools_overview: {
      title: "Use GWDG Tools",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Enable tools.",
      step3:
        "Choose a tool. Tools appear only for models that support them.",
    },
    search_chats: {
      title: "Search chats",
      step1: "Click search in the sidebar.",
      step2: "Type part of a chat title to filter your conversations.",
    },
    manage_topics: {
      title: "Organize chats with topics",
      step1: "Click Create topic in the sidebar.",
      step2: "Name the topic and choose an icon and color.",
      step3:
        "Drag chats into topics, or use the conversation menu to move them.",
    },
    sort_organize: {
      title: "Sort & organize chats",
      step1: "Click Sort & organize in the sidebar header.",
      step2:
        "Review the suggested topics, titles, and deletions. Nothing changes until you apply them.",
      step3:
        "Select the suggestions you want and click Apply to reorganize your chats.",
    },
    sort_group_chats: {
      title: "Sort and group chats",
      step1: "Open the sort menu in the sidebar.",
      step2: "Choose grouping by topic, date, or creation date.",
    },
    close_chat: {
      title: "Close a chat",
      step1:
        "Use the close button at the top right. It removes the chat from your conversations; in the Meta chat it clears the conversation instead.",
    },
    export_conversation: {
      title: "Export a chat",
      step1: "Open the conversation menu in the sidebar.",
      step2: "Choose Export and select the export options.",
    },
    import_conversation: {
      title: "Import a chat",
      step1:
        "Click Import in the sidebar and choose a JSON chat file. You can also import from the Data tab in user settings.",
    },
    chat_with_persona: {
      title: "Chat with Persona",
      step1:
        "Click Chat with Persona in the sidebar to open the persona library.",
      step2:
        "Choose a category on the left, or use Quick Import to start right away.",
      step3:
        "Click a persona to start a new chat with its title, model, and system prompt.",
    },
    share_conversation: {
      title: "Share conversation settings",
      step1: "Open the conversation settings panel.",
      step2: "Click Share to copy a link with these settings.",
    },
    fork_conversation: {
      title: "Fork a conversation",
      step1:
        "Use Fork on an assistant message to continue in a new chat from that point.",
    },
    summarize_conversation: {
      title: "Summarize a chat",
      step1: "Open the conversation menu in the sidebar.",
      step2: "Choose Summarize. A new conversation containing the summary is created.",
    },
    settings_overview: {
      title: "Change settings",
      step1: "Open your user settings from the profile or the sidebar.",
      step2: "Choose the Chat tab. Memories and Data contain the other settings.",
      step3: "Change a preference such as rendering or document conversion. Changes are saved automatically.",
    },
    memories: {
      title: "Manage memories",
      step1: "Open your user settings.",
      step2:
        "Use the Memories tab to manage saved memories and the memory mode.",
    },
    chat_preferences: {
      title: "Open chat preferences",
      step1: "Open your user settings.",
      step2:
        "Choose the Chat tab to change the default model, send key, summaries, rendering, and document conversion.",
    },
    rendering: {
      title: "Configure rendering",
      step1: "Open your user settings.",
      step2: "Choose the Chat tab.",
      step3:
        "Enable Typst or LaTeX rendering. HTML rendering and external references are configured here too.",
    },
    document_conversion: {
      title: "Choose document conversion",
      step1: "Open your user settings.",
      step2: "Choose the Chat tab.",
      step3: "Select Server only, Browser only, or By choice.",
    },
    data_management: {
      title: "Manage your data",
      step1: "Open your user settings.",
      step2: "Choose the Data tab.",
      step3:
        "Export local data or clear chats, memories, settings, and attachments.",
    },
    dark_mode: {
      title: "Switch theme",
      step1: "Use the theme toggle in the footer to switch between light and dark mode.",
    },
    feedback: {
      title: "Send feedback",
      step1:
        "Use the feedback buttons under an assistant message when the feedback module is enabled.",
    },
    speech_output: {
      title: "Read answers aloud",
      step1:
        "Click the speaker icon under an assistant message when the speech module is enabled.",
    },
    meta_chat_catalogs: {
      title: "Find tutorials and settings in Meta chat",
      step1: "Browse all available tutorials and replay completed ones.",
      step2: "Browse complete workflows that combine several features. The Meta chat can also start either option for you.",
      step3: "You can also ask me to find a tutorial or recommend a persona. For example: “Find a tutorial about uploading a file.”",
      step4: "Ask about settings, or ask me to take you to a chat, message, topic, or setting. I can also search your chats for decisions and action items.",
    },
    meta_chat_actions: {
      title: "Rename and organize chats with the Meta chat",
      step1: "Open the Meta chat from the AI icon in the sidebar.",
      step2:
        "Ask it to rename a chat or move it to another topic. For example: “Rename ‘Pricing discussion’ to ‘Pricing strategy’.”",
      step3:
        "Review the proposed changes and click Accept changes. Nothing is applied before you accept.",
    },
    meta_chat_search: {
      title: "Search message contents with the Meta chat",
      step1: "Open the Meta chat from the AI icon in the sidebar.",
      step2:
        "Ask it to find something from your chats, for example: “Find where we decided the pricing model” or “What are the action items?”",
      step3:
        "Click a cited message to jump to the exact message and highlight it.",
    },
    meta_chat_navigation: {
      title: "Navigate and search with the Meta chat",
      step1: "Open the Meta chat from the AI icon in the sidebar.",
      step2:
        "Ask it to take you somewhere, for example: “Take me to chat settings” or “Open the chat about pricing.”",
      step3:
        "Ask it to search your chats, for example: “Find where we decided the pricing model” or “What are the action items?”. Click a cited message to jump to it.",
    },
    meta_chat_usage: {
      title: "Use the Meta chat",
      step1:
        "Click the AI icon in the sidebar to open the Meta chat. Ask it about features or where a chat is.",
    },
  },
  use_cases: {
    common: {
      start_new_chat: "Start a new chat for this workflow.",
    },
    catalog: {
      open: "Browse use cases",
      close: "Hide use cases",
      search: "Search use cases",
      hide_completed: "Hide completed",
      completed_successfully: "Completed successfully",
      empty: "No use cases found.",
      walk_through_again: "Walk me through again",
      start_walkthrough: "Walk me through",
      show_tutorial: "Show tutorial",
    },
    categories: {
      research: "Research",
      organize: "Organize",
      create: "Create",
      workflows: "Workflows",
    },
    analyze_paper: {
      title: "Analyze a research paper",
      description: "Upload a PDF, process it, then ask questions about its content.",
      step1: "Attach the paper with the paperclip.",
      step2: "Process the PDF in the browser or on the server.",
      step3: "Ask: “What are the references?”",
      step4: "Ask: “Summarize the methodology and main findings.”",
    },
    web_research: {
      title: "Research current information",
      description: "Enable Web Search, then ask a question that needs up-to-date sources.",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Enable tools and select Web Search.",
      step3: "Ask about a recent development and mention that you need current sources.",
      step4: "Follow the cited sources in the answer and ask follow-up questions.",
    },
    rag_documents: {
      title: "Answer questions from your own documents",
      description: "Use Arcana (RAG) to answer from a document collection you control.",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Enable tools and select Arcana.",
      step3: "Enter your Arcana ID.",
      step4: "Ask: “What does our internal policy say about this?”",
      step5: "Ask: “Which document supports this answer?”",
    },
    organize_topics: {
      title: "Organize chats by project",
      description: "Create topics and group related chats so a project stays together.",
      step1: "Create a topic such as “Thesis” or “Client work”.",
      step2: "Drag related chats into the topic, or group the sidebar by topic.",
    },
    find_chat: {
      title: "Find an old chat",
      description: "Search chat titles or ask the Meta chat where a conversation is.",
      step1: "Search the sidebar for part of the title.",
      step2: "Or ask: “Where is my chat about the paper analysis?”",
    },
    summarize_chat: {
      title: "Turn a long chat into notes",
      description: "Create a new conversation containing a summary of a long chat for your notes.",
      step1: "Open the conversation menu in the sidebar.",
      step2: "Choose Summarize and review the result.",
      step3: "Export the chat if you need a file for your notes.",
    },
    generate_image: {
      title: "Create an image for a slide",
      description: "Enable Image Generation and describe the visual you need.",
      step1: "Open Tools and enable Image Generation.",
      step2: "Ask: “Create a clean diagram of a three-stage research workflow.”",
      step3: "Refine the prompt until the image fits your slide.",
    },
    share_setup: {
      title: "Share a reusable setup",
      description: "Share the system prompt, model, and settings as a link.",
      step1: "Open conversation settings and choose Share.",
      step2: "Send the copied link to a colleague who needs the same setup.",
    },
    compare_models: {
      title: "Compare two models",
      description: "Fork a conversation, change the model, and ask the same question.",
      step1: "Fork the conversation from the message you want to compare.",
      step2: "Select a different model.",
      step3: "Send the same prompt and compare the two answers.",
    },
    local_conversion: {
      title: "Keep document conversion local",
      description: "Convert PDFs and DOCX files in the browser instead of on the server.",
      step1: "Open Chat preferences in user settings.",
      step2: "Choose Browser only under Document conversion.",
      step3: "Attach a PDF or DOCX file.",
      step4: "Process the file from the attachment card.",
    },
    memories: {
      title: "Remember preferences across chats",
      description: "Save context and preferences in memories so future chats can recall them.",
      step1: "Open user settings and add a memory.",
      step2: "Enable Recall or Learn for the conversations where it should be used.",
      step3: "Ask: “What do you remember about my preferences?”",
    },
    read_aloud: {
      title: "Listen to an answer",
      description: "Use the speech button to have an assistant answer read aloud.",
      step1: "Click the speaker icon under an assistant message.",
      step2: "Use the stop button to end playback at any time.",
    },
  },
  // Chat settings
  settings: {
    memory_mode: {
      label: "Memories",
      description: "Choose how this conversation uses your saved memories.",
      help_label: "Learn about memories",
      options: {
        default: {
          label: "Default",
          description:
            "Use the global memory preference (currently {{mode}}).",
        },
        none: {
          label: "Off",
          description: "Do not use saved memories in this conversation.",
        },
        recall: {
          label: "Recall",
          description:
            "Use saved memories to personalize responses in this conversation.",
        },
        learn: {
          label: "Learn",
          description:
            "Use saved memories and learn new details from this conversation.",
        },
      },
    },
    tools_enabled: "Tools are enabled",
    tools_disabled: "Tools are disabled",
    web_search_enabled: "Web search is enabled",
    web_search_disabled: "Web search is disabled",
    close_panel: "Close Settings",
    system_prompt_placeholder: "Enter the system prompt here",
    reasoning_effort: {
      title: "Reasoning",
      subtitle: "Configure the reasoning effort",
      options: {
          none: {
            label: "Off",
            description: "Reasoning is switched off",
          },
          off: {
            label: "Off",
            description: "Reasoning is switched off",
          },
          on: {
            label: "On",
            description: "Reasoning is switched on",
          },
          minimal: {
            label: "Minimal",
            description: "Minimal reasoning effort",
          },
          low: {
            label: "Low",
            description: "Low reasoning effort",
          },
          medium: {
            label: "Medium",
            description:
              "Medium reasoning effort",
          },
          high: {
            label: "High",
            description:
              "High reasoning effort",
          },
          xhigh: {
            label: "High+",
            description:
              "High reasoning effort",
          },
          max: {
            label: "Max",
            description:
              "Maximum reasoning effort",
          }
        },
    },
    reset_default: "Reset default",
    default: "Default",
    tools_title: "GWDG Tools",
    chat_settings: "Chat settings",
    label_web_search: "Web Search",
    label_image_generation: "Image Generation",
    label_image_modification: "Image Modification",
    label_audio_generation: "Audio Generation",
    label_video_generation: "Video Generation",
    label_arcana: "Arcana",
    label_mcp_server: "MCP Server",
    placeholder_arcana_id: "Arcana id",
    placeholder_mcp_id: "Server id",
    video_queue_title: "Video generation queue",
    video_queue_subtitle: "List of video generation tasks.",
    video_queue_job_label: "Video request #{{count}}",
    video_queue_status_queued: "Queued",
    video_queue_status_processing: "Processing",
    video_queue_status_ready: "Ready",
    video_queue_status_failed: "Failed",
    video_queue_delete: "Delete",
    video_queue_eta: "ETA ~{{seconds}}s",
    video_queue_eta_done: "Completed just now",
    video_queue_download: "Download",
    video_queue_empty: "No video requests in the queue yet.",
    video_queue_badge_label: "Video queue",
    video_queue_badge_tooltip_processing: "{{processing}} processing • {{ready}} ready",
    video_queue_badge_tooltip_ready: "{{ready}} ready to download",
    video_queue_modal_title: "Video generation queue",
    video_queue_modal_subtitle: "{{processing}} processing • {{ready}} ready to download",
  },

  // Conversation
  conversation: {
    close_chat: "Close chat",
    prompt: {
      placeholder: "Ask me",
      attach: "Attach File",
      attach_media: "Attach Media",
      attachments: "Attachments",
      clear_attachments: "Clear all",
    },
    attachment: {
      image_unsupported: "Switch model to process image",
      audio_unsupported: "Switch model to process audio",
      file_unsupported: "Switch model to process {{filetype}}",
      unprocessed: "Unprocessed file",
      process_browser: "Process (browser)",
      process_server: "Process (server)",
      must_process: "File must be processed",
    },
    reasoning: "Reasoning Process",
    copy_reasoning: "Copy reasoning process",
    action: "Action",
    html_block: {
      render: "Render HTML",
      show_code: "Show code",
    },
    typst_block: {
      render: "Render as Typst",
      show_code: "Show code",
    },
    latex_block: {
      render: "Render as LaTeX",
      show_code: "Show code",
    },
    sources: "Sources and References",
    references: "References",
    empty_message: "Your conversations are never stored on our servers",
    fork_empty: "No messages found to copy.",
    fork_created: "New conversation created.",
    fork_failed: "Conversation could not be copied.",
    untitled: "Untitled Chat",
  },
  // Footer
  footer: {
    imprint: "Imprint",
    terms: "Terms of Use",
    docs: "Docs",
    privacy: "Privacy",
    faq: "FAQ",
    contact: "Contact Us",
    about: "About",
    copyright: "{{year}} GWDG  ©  All Rights Reserved",
    iso_certified: "ISO 27001 Certified",
  },
  // User Settings Modal
  user_settings: {
    title: "User Profile Settings",
    tabs: {
      navigation_label: "Profile settings sections",
      profile: {
        label: "Profile",
        title: "Profile and usage",
        description: "Review your account details and usage information.",
      },
      chat: {
        label: "Chat",
        title: "Chat preferences",
        description:
          "Choose defaults that apply to every conversation on this device.",
      },
      memories: {
        label: "Memories",
        title: "Saved memories",
        description: "Review and manage details Chat AI has learned.",
      },
      data: {
        label: "Data",
        title: "Data and privacy",
        description: "Export or remove data stored in this browser.",
      },
    },
    account: {
      username: "Username",
      email: "Email address",
    },
    usage: {
      title: "Usage",
      description:
        "Monitor your monthly usage and organization budget usage.",
      monthly: "Monthly",
      total: "Total",
      personal: "Personal",
      organization: "Organization",
      personal_monthly: "Personal monthly",
      personal_total: "Personal total",
      organization_monthly: "Organization monthly",
      organization_total: "Organization total",
      resets_at: "Resets {{time}}",
      rate_limits: {
        "10s": "10 s",
        hourly: "Hourly",
        daily: "Daily",
        monthly: "Monthly",
      },
      sections: {
        budget: "Budget",
        rate_limits: "Rate limits",
        requests: "Requests",
      },
      scopes: {
        external: "External",
        internal: "Internal",
      },
    },
    monthly_usage: "Monthly Usage",
    org_usage: "Organization Budget Usage",
    sidebar_usage: {
      label: "Show usage in sidebar",
      description: "Keep your current usage visible while chatting.",
    },
    chat_preferences: {
      title: "Chat preferences",
      description:
        "These preferences apply to every conversation on this device.",
      memory: {
        label: "Memory",
        description: "Choose how Chat AI uses your saved memories.",
        help_label: "Learn about memory",
        options: {
          none: {
            label: "None",
            description: "Do not use saved memories in responses.",
          },
          recall: {
            label: "Recall",
            description: "Use saved memories to personalize responses.",
          },
          learn: {
            label: "Learn",
            description:
              "Use saved memories and learn relevant new details.",
          },
        },
      },
      suggestions: {
        section_label: "Suggestions",
        label: "Suggest follow-up prompts",
        description: "Show suggested ways to continue after each response.",
        help_label: "Learn about follow-up prompts",
        title_once: {
          label: "Set title only on first prompt",
          description:
            "Only generate the conversation title once, from the first prompt.",
        },
      },
      summaries: {
        section_label: "Conversation summaries",
        label: "Show summaries on hover",
        description:
          "Generate a short summary when you switch away from a chat, then show it when hovering over that chat in the sidebar.",
      },
      submission: {
        label: "Send message with",
        options: {
          enter: {
            label: "Enter",
            description:
              "Enter sends the message. Shift+Enter adds a new line.",
          },
          shift_enter: {
            label: "Shift+Enter",
            description:
              "Shift+Enter sends the message. Enter adds a new line. This is the default on mobile devices.",
          },
        },
      },
      html_render: {
        label: "Render HTML blocks",
        description:
          "Choose how HTML fenced blocks in responses are shown by default.",
        options: {
          render: {
            label: "Render",
            description:
              "Render HTML blocks as live content. You can still switch to code per block.",
          },
          code: {
            label: "Code",
            description:
              "Show HTML blocks as code by default. You can still render them per block.",
          },
          off: {
            label: "Off",
            description:
              "Do not render HTML blocks automatically. They start as code; you can still render them per block.",
          },
        },
        external_references: {
          label: "Load external references",
          description:
            "Allow HTML blocks to load images and links from external hosts. Off by default: when disabled, external references are removed so the browser only contacts this server.",
        },
        sanitization: {
          label: "Sanitization",
          description:
            "Control how strictly HTML blocks are sanitized before being rendered.",
          options: {
            strict: {
              label: "Strict",
              description:
                "Block interactive and scriptable HTML (buttons, forms, iframes, scripts, inline styles). Safest for untrusted content.",
            },
            relaxed: {
              label: "Relaxed",
              description:
                "Allow interactive HTML with JavaScript (buttons, forms, iframes, scripts, inline styles). Warning: model output can execute code — only enable if you trust the source.",
            },
          },
        },
      },
      rendering: {
        label: "Rendering",
      },
      typst: {
        label: "Render Typst blocks",
        description:
          "Choose whether Typst code blocks are rendered by default. You can still render or show code for each block.",
      },
      latex: {
        label: "Render LaTeX blocks",
        description:
          "Choose whether LaTeX code blocks are rendered by default. You can still render or show code for each block.",
      },
      document_conversion: {
        label: "Document conversion",
        options: {
          server: {
            label: "Server only",
            description:
              "Always process attached PDF and DOCX files on the server.",
          },
          browser: {
            label: "Browser only",
            description:
              "Always process attached PDF and DOCX files locally in your browser.",
          },
          choice: {
            label: "By choice",
            description:
              "Choose per document whether it is processed in the browser or on the server.",
          },
        },
      },
    },
    default_model: {
      title: "Default Model",
      current: "Current: {{currentModel}}",
      description: "Select the default model for new chats.",
      list_label: "Available default models",
    },
    timeout: {
      title: "Request Timeout",
      description: "Set how long to wait for AI responses before timing out.",
      seconds: "Timeout (seconds)",
      seconds_short: "sec",
      range: "Range: 5-900 seconds",
    },
    data: {
      title: "Manage Data",
      description:
        "Export a copy of your local data or permanently remove chats, memories, settings, and attachments from this browser.",
      export_success: "Local data exported successfully.",
      export_error: "Local data could not be exported.",
    },
    clear_data_button: "Clear Data",
    import_data_button: "Import Data",
    export_data_button: "Export Data",
    memory: {
      title: "User Memories",
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
    chat_label: "Persona chat",
    category_label: "Category",
    startChat: "Start chat",
    startChatWith: "Start a chat with {{title}}",
    startingChat: "Starting…",
    startError: "Could not load this persona. Please try again.",
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
    export_mcp_servers: "Include MCP server",
  },
  // Rename Conversation Modal
  rename_conversation: {
    title: "Rename chat",
    enter_name: "Enter chat title",
    alert_empty: "Title is required",
  },
  // Delete Conversation Modal
  delete_conversation: {
    title: "Delete Chat",
    description: "Are you sure you want to delete this chat?",
  },
  // Share Settings Modal
  share_settings: {
    description:
      "This feature creates a shareable link containing your model, system prompt, and settings (including tool configuration). Anyone who opens this link can use the same setup in their own conversations. Your conversation history will not be shared.",
    warn_arcana:
      "Warning: Sharing arcana details may compromise data uploaded in the arcana.",
    warn_mcp:
      "Warning: Sharing an MCP server may route prompts or data to that server when MCP is used.",
  },
  // Help modals
  help: {
    title: "Help",
    choiceproposer:
      "When enabled, Chat AI suggests relevant follow-up prompts after each response. This preference applies to every conversation on this device.",
    arcana:
      "Arcana is a unique feature of our service that empowers the LLM with specialized knowledge. When you enter a valid Arcana ID and its corresponding key, the LLM gains access to the knowledge contained within that Arcana. This enables the model to generate responses that are more informed and relevant to your needs. Leave the ID empty to use the model without any specialized knowledge.",
    mcp: "Enter the URL of your MCP (Model Context Protocol) Server (e.g., https://...). The MCP Server is a service that can provide the Chat AI with additional tools, data sources, or processing capabilities beyond its built‑in knowledge. By connecting to your specified MCP Server, the AI can interact with external systems, retrieve up‑to‑date or specialized information, and perform custom tasks according to the capabilities offered by that server.",
    models:
      "Chat AI provides access to a range of state-of-the-art Large Language Models (LLMs), each with distinct capabilities and performance characteristics. This allows you to explore and select the model that best aligns with your research goals and requirements. \
      Larger models typically offer higher-quality responses, but may have longer response times due to their increased complexity. Conversely, smaller models provide faster response times, but may sacrifice some accuracy and depth. With the list of available models, you can balance trade-offs between response quality and speed to suit your specific needs. For more details",
    reasoning:
      "The reasoning setting determines how deeply the model processes and analyzes information before generating a response. A higher reasoning effort level means the model will spend more time carefully considering the context, weighing possible interpretations, and refining its internal thought process to produce a more accurate, nuanced, and well-structured answer. A lower reasoning effort prioritizes speed over depth, resulting in faster but potentially less thorough responses. Adjust this setting based on whether you need quick replies or more deliberate, high-quality outputs",
    memory:
      "Memory is a global preference for all conversations on this device. 'None' does not use saved memories. 'Recall' uses saved memories to personalize responses. 'Learn' also stores relevant new details from your conversations. Memories are stored only in your browser.",
    system_prompt:
      "The system prompt is a special command or instruction given at the beginning of a conversation to set the tone, context, or constraints for our interaction. It's a way to guide the model's behavior and ensure that it responds in a helpful and appropriate manner.",
    temperature:
      "A low temperature (e.g., 0-1) produces more predictable and logical responses, while higher temperatures (e.g., above 1) increase the possibility of more creative and unconventional responses. You can adjust the temperature setting to achieve different levels of predictability and creativity.",
    tools:
      "Tools are a new and experimental feature designed to extend the capabilities of Chat AI. They allow the model to perform additional actions or access additional resources in order to provide more useful, accurate, or specialized responses. Current tools include Arcana (for all models) and Web Search (optional), with more tools planned for the future. As this feature is still evolving, functionality and available tools may change over time.",
    web_search:
      "The web search tool allows the AI to look up the latest information from the internet to improve its responses. When enabled, the AI can generate search queries based on your question and the full conversation history, send them to a search engine (such as Google), and use the retrieved results to provide more accurate and up-to-date answers. This is especially useful for topics where current or rapidly changing information is important.",
    top_p:
      "top_p is a slider from 0 to 1 which adjusts the total population of probabilities considered for the next token. A top_p of 0.1 would mean only the top 10% of cumulative probabilities is considered. Variating top_p has a similar effect on predictability and creativity as temperature.",
  },
  model_selector: {
    change_model: "Change model",
    docs_hint_text: "Need help deciding which model fits best?",
    docs_hint_link: "Read the model overview.",
    scope_filter: "Filter models",
    scope_all: "All models",
    scope_internal: "Internal only",
    scope_external: "External only",
  },
  // Tour
  tour: {
    welcome_message: "Welcome to Chat AI",
    start_tour: "Start Tour",
    skip_tour: "Skip tour",
    description:
      "Click the button below to begin the guided tour and explore the new user interface.",
    prompt:
      "Simply enter your message here to start the conversation with Chat AI. You can attach files; the model will use it if it supports the file type.",
    model:
      "Here you can select the model to chat with. Each model has its own characteristics, capabilities and limitations.",
    sidebar:
      "Create, remove, import, export, remove, search, and switch between conversations here. Organize your conversations with topics, and chat with pre-defined personas, if you like.",
    settings:
      "Here you can adjust conversation-specific settings, including the system prompt, temperature, top_p, and GWDG tools such as Arcana, image generation, and web search. Tools may not work with all models.",
    profile:
      "This button will open your user profile, where you can set your preferences, manage saved memories, and export or clear your data.",
    interface:
      "In this corner you can switch the theme and language of Chat AI.",
    memory: {
      off: "Memory - None: Chat AI won't remember anything from previous conversations, like before.",
      recall:
        "Recall: Chat AI can use relevant memories about you from previous conversations, but won't memorize anything from the current conversation.",
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
    bad_request:
      "Bad request was sent: Please clear conversation, reattempt within the limit, and save your chat history for future reference.",
    clear_data:
      "Caution! Clearing data will erase all your conversations, history, and settings. Are you sure?",
    clear_messages:
      "Are you sure you want to erase all messages in this conversation?",
    close_chat:
      "Close this chat? It will be removed from your conversations.",
    close_chat_yes: "Close chat",
    regenerate_confirm:
      "Regenerating will delete this response and every message after it, and will apply your current settings. This cannot be undone. To keep this conversation intact, use “Continue in a new chat” instead.",
    regenerate_yes: "Regenerate",
    fork_confirm:
      "This copies the conversation up to this message into a new chat. The current conversation stays as it is, so you can try a different answer or different settings without losing anything.",
    fork_yes: "Create copy",
    regenerate_fork: "Fork",
    regenerate_fork_success: "Chat forked successfully",
    regenerate_fork_fail: "Chat could not be forked",
    summarize_replace:
      "This will create a new chat containing a summary. Your current chat stays unchanged. Continue?",
    summarize_in_progress:
      "Your conversation is being summarized. Please wait while the summary is generated.",
    no: "No, go back",
    yes: "Yes, clear everything",
    system_prompt_empty: "System prompt is empty. Model may not respond.",
    data_security_notice: "Your data will be processed securely within our servers. No information will be transmitted outside of the GWDG.",
    data_security_warning: 
      "You are using an external model or external tools. Your messages may be processed outside of GWDG. Custom settings and GWDG tools may not be available. Please refrain from entering confidential or personal data.",
    data_security_warning_mpg:
      "You are using an external model or external tools. Your messages may be processed outside of GWDG. Custom settings and GWDG tools may not be available. Please refrain from entering confidential or personal data. External models can only be used by scientific employees for scientific work, provided that no personal data is entered.",
    arcana_usage:
      "Keep temperature at 0 and top_p at 0.05 for optimal arcana results",
    arcana_create_collection_prefix:
      "Create your own Document Collection",
    arcana_create_collection_link: "here",
    web_search_usage:
      "PRIVACY WARNING: Your chat history may be sent to a search engine (e.g., Google)",
    mcp_usage: "PRIVACY WARNING: Your data may be sent to external servers.",
    arcana_export:
      "Warning: Exporting Arcana details to a file may compromise your private data, as it can be accessed by others.",
    mcp_export:
      "Warning: Exporting MCP server details to a file may expose external endpoints and can lead to data being sent to third-party servers.",
    model_offline:
      "The model you selected is currently offline. By pressing OK below, the model starts up and will be online in a few minutes. In the meantime, feel free to choose another model.",
    session_expired: "Your session has expired. Please refresh the webpage.",
    unsent_files:
      "You have attached files that will be lost. Are you sure you want to leave?",
    unprocessed_files:
      "You have an unprocessed file. Please process or remove it first.",
    migrate_data:
      "It looks like you're using an older version of Chat AI. To continue, your previous conversations and data need to be upgraded. Please back up your data first if needed, then press 'Upgrade' to start the process.",
    // Hallucination warning
    hallucination: {
      note1: "Note: Chatbots are prone to",
      note2: "and their responses should not be considered accurate.",
      note3: "Hallucination",
    },
    // External models
    settings_external:
      "These settings will not affect external (OpenAI) models.",
    import_settings_title: "Review imported settings",
    import_settings_intro:
      "This shared settings link includes options that may send parts of your conversation to external services. Select what to import.",
    import_web_search_disclaimer:
      `When Web Search is enabled, the AI may generate search queries based on your message and conversation history and send them to a search engine (e.g., Google).\n\nOnly allow this if you are comfortable with your data being processed externally and you will not share any confidential, personal, or sensitive information while Web Search is active.`,
    import_mcp_disclaimer:
      `MCP servers can be hosted outside of GWDG. When enabled, the AI may send data to configured MCP servers to fulfill tool requests.\n\nOnly allow this if you trust the configured MCP servers and you will not share any confidential, personal, or sensitive information with them.`,
    web_search_disclaimer: `When web search is enabled, the AI may generate search queries based on your message and the full conversation history, and send them to a search engine (e.g., Google) to retrieve up-to-date information. This helps provide more accurate and current responses.\n\nBy clicking “I Understand,” you agree that your input may be processed in this way and acknowledge that you will not share any confidential, personal, or sensitive information while web search is active.`,
  },
  // Landing page
  landing: {
    title: "You are not logged in",
    description: "Please login to use Chat AI.",
    reasonsTitle: "You can login if you are:",
    reasons: {
      deleted: "• member of a German university or research institution",
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
  typst: {
    rendering: "Rendering Typst document...",
    render_error:
      "Failed to render Typst document. Showing source instead:",
  },
  latex: {
    rendering: "Rendering LaTeX document...",
    render_error:
      "Failed to render LaTeX document. Showing source instead:",
  },
  // Announcement
  announcement: "",
  // Editable tool forms
  tool_form: {
    submit: "Run tool",
    sending: "Running...",
    reset: "Reset",
    edit: "Edit",
    tool_call: "Tool call",
    select_placeholder: "Select…",
  },
};
