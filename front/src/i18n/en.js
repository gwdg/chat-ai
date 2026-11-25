export default {
  errors: {
    app_title: "Something went wrong",
    app_message:
      "The interface could not be rendered. Your saved chats are still in this browser unless you clear site data. Reload to try again.",
    database_title: "Local database unavailable",
    database_version:
      "This browser contains a newer local database version than this app build supports. Open the matching app version or a newer build. Do not clear site data.",
    database_blocked:
      "Another Chat AI tab is blocking the local database. Close the other tabs and reload.",
    database_quota:
      "The browser storage is full or unavailable. Export a backup, free some space, and reload.",
    database_generic:
      "The local database could not be opened. Your data may still be present. Reload or close other Chat AI tabs.",
    reload: "Reload",
  },
  // Common phrases
  common: {
    loading: "Loading...",
    back: "Back",
    undo: "Undo",
    scroll: "Scroll to bottom",
    scroll_to_top: "Scroll to top",
    scroll_to_message: "Jump to start of message",
    next_message: "Scroll to next message",
    previous_message: "Scroll to previous message",
    rename: "Rename",
    edit: "Edit",
    create: "Create",
    save: "Save",
    import: "Import Chat",
    export: "Export Chat",
    summarize: "Summarize",
    summarizing: "Summarizing...",
    received_words_one: "Received {{count}} word…",
    received_words_other: "Received {{count}} words…",
    reasoning_words_one: "Model is reasoning — {{count}} word received…",
    reasoning_words_other: "Model is reasoning — {{count}} words received…",
    elapsed_seconds: "{{count}} s",
    created: "Created {{date}}",
    modified: "Modified {{date}}",
    summarize_success: "Summary created in a new conversation.",
    summary_title: "Summary of {{title}}",
    summarize_error: "Summarization failed. Your conversation is unchanged.",
    clear: "Clear",
    abort: "Abort",
    send: "Send",
    send_shortcut: "Send (Enter)",
    send_shortcut_shift_enter: "Send (Shift+Enter)",
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
    send: "Send a detailed feedback describing your observation.",
    data_notice: "Your rating and this conversation are sent to the server for analysis.",
    comment_placeholder: "Describe what was wrong or what helped…",
    save_and_send: "Save and send",
    send_failed: "The feedback could not be sent: {{error}}",
    unknown_error: "unknown error"
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
    sync_now: "Sync now",
    sync_running: "Syncing…",
    sync_settings: "Open sync settings",
    sync_done: "Sync complete: {{pulled}} pulled, {{pushed}} pushed.",
    sync_failed: "Sync failed: {{error}}",
    sync_auto_on: "Automatic synchronization on — pause it",
    sync_auto_off: "Automatic synchronization off — resume it",
  },
  folders: {
    title: "Chats",
    all: "All chats",
    uncategorized: "Unsorted Chats",
    by_date: "By date",
    by_created: "By creation date",
    by_size: "By storage size",
    sort_label: "Sort chats",
    sort_by_topic: "By topic",
    sort_by_date: "By date",
    sort_by_created: "By creation date",
    sort_by_size: "By storage size",
    modified: "Modified {{date}}",
    storage_size: "Browser storage {{size}}",
    dateBuckets: {
      today: "Today",
      yesterday: "Yesterday",
      lastWeek: "Last week",
      lastMonth: "Last month",
      older: "Older",
    },
    topics_label: "Topics",
    create_button: "New topic",
    expand_topic: "Expand topic",
    collapse_topic: "Collapse topic",
    expand_all_topics: "Expand all topics",
    collapse_all_topics: "Collapse all topics",
    expand_all_chats: "Expand all chats",
    collapse_all_chats: "Collapse all chats",
    empty_topic: "Drag a chat here.",
    search_label: "Search",
    search_action: "Search chats",
    search_placeholder: "Search by title",
    search_no_results: 'No matches for "{{query}}"',
    clear_search: "Clear search",
    create_title: "Create topic",
    edit_title: "Edit topic",
    delete_title: "Delete topic",
    topic_options: "Topic options",
    unsorted_options: "Unsorted chats options",
    remove_all_unsorted: "Remove all chats",
    delete_unsorted_title: "Remove all unsorted chats",
    delete_unsorted_description:
      "Delete all {{count}} chats that are not in a topic? This cannot be undone.",
    removed_unsorted_chats: "Removed {{count}} unsorted chats.",
    remove_unsorted_error:
      "Could not remove the unsorted chats: {{error}}",
    pinned: "Pinned",
    pin_action: "Pin chat",
    unpin_action: "Unpin chat",
    pin_topic_action: "Pin topic",
    unpin_topic_action: "Unpin topic",
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
    kind: "Topic",
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
    button: "Smart Sort",
    title: "Smart Sort",
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
    name: "Chatty",
    title: "Meta chat",
    prompt_placeholder: "Ask the meta chat!",
    open: "Metachat: ask about your chats",
    help_label: "Help/Meta Assistant Chatty",
    help_tooltip:
      "Open the Meta chat: ask about your chats, topics, settings, and memories, or get step-by-step guidance for Chat AI features. Proposed changes apply only after you confirm them.",
    last_checked: "Last checked: {{date}}",
    changes_title: "What's New",
    files_tab: "Workspace",
    sessions_tab: "Sessions",
    agents_tab: "Agents",
    sessions_empty: "No chats in this workspace yet.",
    collapse_changes: "Collapse What's New",
    expand_changes: "Expand What's New",
    resize_changes: "Resize What's New",
    check_now: "Check now",
    changes_empty: "No check yet. Click “Check now” to inspect chats, agents, MCP servers, and recent agent files.",
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
    applied_not_reversible: "Applied — this action cannot be reverted.",
    changes_applied: "Changes applied",
    revert_changes: "Revert changes",
    reverting: "Reverting…",
    changes_reverted: "Changes reverted",
    revert_mismatch:
      "Cannot revert because the current state no longer matches the applied change.",
    apply_failed: "Could not apply the changes.",
    rename_summary: "Rename “{{from}}” to “{{to}}”",
    move_summary: "Move “{{title}}” to “{{topic}}”",
    pin_summary: "Pin “{{title}}”",
    unpin_summary: "Unpin “{{title}}”",
    pin_topic_summary: "Pin topic “{{topic}}”",
    unpin_topic_summary: "Unpin topic “{{topic}}”",
    pin_workspace_summary: "Pin workspace “{{workspace}}”",
    unpin_workspace_summary: "Unpin workspace “{{workspace}}”",
    pin_agent_summary: "Pin agent “{{agent}}”",
    unpin_agent_summary: "Unpin agent “{{agent}}”",
    setting_summary: "Change {{setting}} from “{{from}}” to “{{to}}”",
    setting_temperature: "Temperature",
    setting_top_p: "Top-p",
    conversation_setting_all_summary:
      "Set {{setting}} to “{{value}}” for all chats",
    conversation_setting_summary: "Set {{setting}} to “{{value}}” in “{{title}}”",
    create_chat_summary: "Create chat “{{title}}” with {{count}} initial messages",
    mcp_target_all: "all chats",
    mcp_target_global: "the MCP server list",
    agent_prompt_summary:
      "Send {{chars}} characters to agent {{agent}}: “{{preview}}”",
    agent_prompt_text_label: "Prompt text",
    agent_prompt_meta: "Agent {{agent}} · {{chars}} characters",
    agent_prompt_notice:
      "This text is sent verbatim to the agent, which can run commands on its machine.",
    agent_interrupt_summary: "Interrupt agent {{agent}}",
    agent_session_create_summary: "Create a new session on agent {{agent}}",
    agent_session_switch_summary: "Switch to session {{session}} on agent {{agent}}",
    agent_session_delete_summary: "Remove session {{session}} from agent {{agent}}",
    workspace_attach_summary: "Attach workspace {{workspace}} to {{target}}",
    workspace_detach_summary: "Detach workspace {{workspace}} from {{target}}",
    mcp_add_summary: "Add MCP server {{name}} to {{target}}",
    mcp_remove_summary: "Remove MCP server {{name}} from {{target}}",
    mcp_update_summary: "Update MCP server {{name}} in {{target}}",
    add_memory_summary: "Add memory “{{text}}”",
    add_memory_group_summary: "Add memory “{{text}}” to group “{{group}}”",
    update_memory_summary: "Update memory “{{from}}” to “{{to}}”",
    update_memory_group_summary: "Update memory “{{from}}” to “{{to}}” in group “{{group}}”",
    delete_memory_summary: "Delete memory “{{text}}”",
    clear_memories_summary: "Delete all saved memories",
    e2ee_assign_summary: "Encrypt model {{model}} with key “{{key}}”",
    e2ee_clear_summary: "Stop encrypting model {{model}}",
    memory_item: "Memory {{index}}",
    setting_on: "on",
    setting_off: "off",
    setting_device_default: "device default",
    setting_deployment_default: "deployment default",
    unsorted_topic: "Unsorted",
    error: "Could not answer. Please try again.",
    no_model: "No default model is configured.",
  },
  e2ee: {
    badge: "End-to-end encrypted",
    description:
      "A bound key adds a second layer of encryption on top of the transport encryption that already protects every request: your message is sealed in this browser and stays ciphertext until it reaches the machine that runs the model, usually a GPU. Keys are distributed out of band, so import only from a source you trust.",
    keys_title: "Encryption keys",
    no_keys: "No keys yet. Add one above.",
    invalid_key: "Not a valid 32-byte X25519 public key",
    download: "Download public key",
    remove: "Remove",
    remove_confirm: "Remove this key and its model bindings?",
    removed: "Key removed",
    clear_all: "Remove all keys",
    clear_all_confirm: "Remove every key and model binding?",
    clear_all_done: "All encryption keys removed",
    test: "Test",
    test_all: "Test all",
    test_ok: "Key works: {{count}} model(s) answered the sealed test.",
    test_failed: "No sealed answer from {{models}} ({{reason}}).",
    test_no_models: "Bind this key to a model before testing it",
    test_no_bindings: "No key is bound to a model, so there is nothing to test.",
    test_all_done: "{{working}} of {{tested}} tested keys work.",
    test_failed_keys: "Failing: {{keys}}",
    status_working: "Works",
    status_working_hint:
      "The last sealed test request passed for {{count}} model(s)",
    status_failed: "Test failed",
    status_failed_hint:
      "The last sealed test request did not pass for any bound model",
    status_untested: "Not tested",
    status_untested_hint:
      "The key is well formed, but it has not been tested against a model",
    verifying: "Testing key…",
    verified_added: "Key tested and bound to {{count}} model(s)",
    added_unverified:
      "Key added without a test. Enter at least one known model so it can be checked.",
    add_keys_title: "Add encryption keys",
    add_keys_description:
      "Each key is tested with one sealed request per model before it is stored. Models that fail the test stay unencrypted.",
    verify_failed_all:
      "The key was not added: the test request for {{model}} failed ({{reason}}).",
    verify_failed_models:
      "Not encrypted because the test failed for {{models}} ({{reason}}).",
    no_models_matched:
      "None of these are known models: {{models}}. The key was not added.",
    import_method: "How to add a key",
    modes: {
      published: "Published keys",
      paste: "Paste or file",
      url: "From URL",
      directory: "Key directory",
    },
    published_url: "Key base URL",
    published_hint:
      "Use only a key URL you trust. Each downloaded key is tested against its model before it is stored.",
    published_load: "Load keys for all models",
    published_loading: "Loading keys…",
    published_url_required: "Enter the URL of the key directory.",
    published_progress_fetch: "Downloading keys… {{done}}/{{total}}",
    published_progress_verify: "Verifying keys… {{done}}/{{total}}",
    published_imported: "Imported {{count}} verified key(s)",
    published_none:
      "No key passed verification. Check the key base URL and that the models have an E2EE node.",
    published_none_needed: "Every model already has a usable key.",
    published_summary:
      "{{imported}} imported · {{missing}} without a published key · {{failed}} failed",
    published_failed_title: "Not imported:",
    published_more: "and {{count}} more",
    models_field: "Applies to models",
    models_field_placeholder: "qwen3-235b-a22b, Mistral Large",
    models_field_hint:
      "Comma-separated model ids or names; a bridged \"(External)\" entry is a separate model. Unknown entries are skipped.",
    unknown_models: "Key added, but these are not known models: {{models}}",
    fallback_name: "Key {{fingerprint}}",
    public_key: "Public key",
    public_key_placeholder: "Base64url X25519 public key",
    add_key: "Add key",
    choose_file: "Choose .pub file…",
    key_url: "Key URL",
    fetch_key: "Download key",
    directory_url: "Directory URL",
    import_directory: "Import directory",
    directory_imported: "Imported {{count}} keys",
    directory_hint:
      "One document with every key and its model bindings. Each key is still tested before it is stored.",
    choose_folder: "Choose key folder…",
    folder_hint:
      "Reads every .pub file in a local folder. Files that are not valid public keys are reported and skipped.",
    folder_imported: "Imported {{count}} keys, bound {{bound}} models",
    folder_partial:
      "Imported {{count}} keys ({{bound}} models). Skipped {{skipped}} file(s): {{files}}",
    folder_empty: "No .pub files in that folder.",
    folder_no_valid: "No valid public key in that folder ({{count}} file(s) rejected).",
    folder_unsupported:
      "This browser cannot open a folder here. Use the directory URL instead, or open the app over HTTPS or localhost.",
    folder_error: "Could not read the folder: {{reason}}",
    import_error: "Could not import the key.",
    models_title: "Unencrypted models",
    models_keyed: "{{count}} encrypted",
    models_description:
      "These models are used by an internal feature and have no working key, so their requests only get the transport encryption.",
    models_empty:
      "No model used by an internal feature is missing a key.",
    used_for: "Used for",
    features: {
      titles: "Titles",
      memory: "Memory",
      proposals: "Proposals",
      summaries: "Summaries",
      image_analysis: "Image analysis",
    },
    models_blocked: "Key missing or invalid",
    not_encrypted: "Not encrypted",
    model_not_offered: "Not in model list",
    model_not_offered_hint:
      "An internal feature is configured to use this model, but the deployment's model list does not contain it, so no key can be bound to it here.",
  },
  mcp_confirmation: {
    title: "Run MCP tool?",
    description:
      "The assistant wants to run “{{tool}}” on {{server}}. Only allow this if you trust the server and the arguments.",
    allow: "Run tool",
    allow_always: "Always allow in this chat",
    always_allowed: "(always allowed)",
    deny: "Deny",
    denied: "The user denied running the MCP tool “{{tool}}” on {{server}}.",
  },
  feature_guide: {
    workspace_overview: {
      title: "Workspaces",
      step1: "The right-hand panel belongs to the workspace: What's new opens first, Files shows what the workspace stores, and Agents shows how it runs.",
      step2: "Sources can join a workspace at any time: Manage Workspace in its options menu opens the same dialog as Create workspace.",
      step3: "Browse the tree in the Files tab. The pill on each row says where that entry lives: browser, device, arcana, MCP or agent.",
      step4: "Choose how this workspace runs its agent: in the browser, through an OpenCode server, or with the Remote agent.",
    },
    manage_chat_data: {
      title: "Manage the files of a chat",
      step1: "Access storage is on by default and sits at the top of the Workspace menu, which appears while the chat belongs to a workspace. Switch it off to give the model no file tools at all; attachments are still included in the message where possible. A chat without a workspace has no such menu — attach it from the workspace first.",
      step2: "Choose Manage Workspace to manage the files behind this switch. One attached workspace opens its editor — the same dialog as Create workspace, with its storage locations, its name, icon and colour, and Apply Changes. With several, the menu turns into the list of attached workspaces: pick one to open that workspace's editor, or use the back arrow to return to these settings.",
    },
    workspace_saia_fs: {
      title: "Your SAIA files in a workspace",
      step1: "Start a new workspace with Create workspace. Its Sources rail is where a workspace gets its files.",
      step2: "SAIA Files is your account folder. It is listed only while this deployment's saia-fs service answers its health check; open it to pick a folder and add it to the workspace.",
    },
    workspace_edit_storage: {
      title: "Manage a workspace",
      step1: "Open the options menu of a workspace in the sidebar and choose Manage Workspace.",
      step2:
        "Manage Workspace is Create workspace for a workspace that already exists: rename it, change its icon and colour, and edit its storage in the same dialog. Pick a folder, mount a source, or add a local folder, a repository or an MCP server; storage changes are saved as you make them, and Apply Changes saves the name, icon and colour.",
    },
    workspace_clone: {
      title: "Import a Git repository",
      step1: "Open Create workspace, pick Git repository on the left, choose the local agent that runs the clone, then press Create.",
    },
    workspace_upload: {
      title: "Upload files into a workspace",
      step1: "Open a workspace, pick the Files tab on the right and choose Add file; the browser asks for a file from this computer.",
      step2: "The uploaded file appears in the folder you are viewing.",
    },
    workspace_multiselect: {
      title: "Remove a file from a workspace",
      step1: "The Files tab on the right lists everything the workspace stores, each row with its origin pill.",
      step2: "Every row ends with a trash button; it removes that file or folder after a confirmation.",
    },
    arcana_filesystem: {
      title: "Use an Arcana filesystem",
      step1: "Every workspace already includes an Arcana filesystem source, listed in the Files tab.",
      step2: "Each Arcana appears as a folder; open one to browse its files.",
    },
    attach_from_workspace: {
      title: "Attach files from a workspace",
      step1: "Attach this chat to a workspace with the workspace button in the prompt box.",
      step2:
        "Click the attach button and choose From workspace, then pick a file from the workspace tree.",
      step3: "Send the message with the attached file.",
    },
    agent_recovery: {
      title: "Recover an agent session",
      step1: "Open the agent's tools from the composer. If the agent server is unreachable, exports use the local cache instead.",
      step2: "Open the Recovery tab to see how much history is cached for this session.",
      step3: "Restore into new session writes the cached transcript into the instructions of a new session. Review the size and confirm first.",
    },
    remote_agents: {
      title: "Spawn a remote agent",
      step1: "Use the + button in the Agents section to add an agent. Pick the GWDG HPC agentic service and its HPC project, or connect an OpenCode server.",
      step2: "Agents appear in the list; click one to open its chat on the right.",
      step3:
        "Expand an agent with the chevron to see each workspace with the sessions attached there, plus “Unassigned sessions”. Click a session to switch, use + to create one, or open the ... menu to rename it, move it to a workspace, or close it.",
    },
    close_group_sessions: {
      title: "Close all sessions of a group",
      step1:
        "Expand an agent to see its sessions grouped by workspace and under “Unassigned sessions”.",
      step2: "The trash icon in the group header closes every session of that group. Running turns are interrupted first, and you must confirm the action in a dialog before any session is removed.",
    },
    session_workspaces: {
      title: "Move a session between workspaces",
      step1:
        "Expand an agent to see its sessions grouped by the workspaces the agent is attached to.",
      step2:
        "Drag a session row onto another workspace group to move it there. The session is detached from its old workspace and attached to the new one, and both groups update right away.",
      step3:
        "A workspace can also attach a session itself: open its “…” menu and choose Attach agent session, then pick a session. The list groups the unattached sessions by agent.",
    },
    agent_workspace_access: {
      title: "Give an agent access to workspace files",
      step1: "Open an agent. The left panel is its file browser.",
      step2: "Open the workspace button next to the prompt box and turn Agent workspace access on to provide the reverse proxy for this agent. Attach a workspace, choose which one the bridge uses, allow writes if the agent may change files, and keep this tab open while the agent works.",
      step3: "The same panel holds the MCP options. MCP tools lets the agent call your configured MCP servers through this tab; Inject external MCP tools also registers the servers OpenCode reaches itself, so those keep working without the tab while the rest stay on the bridge. Both routes belong to the session that is open: another session of the same agent, and every session of another agent, cannot use them.",
    },
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
      workspace: "Workspaces",
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
    browser_storage: {
      title: "Enable browser storage",
      step1: "Open Browser & local tools from the prompt box.",
      step2:
        "Select Browser storage so the assistant can read and write files in this chat's browser workspace.",
    },
    image_analysis: {
      title: "Analyze images",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Select Analyze images so the assistant can analyze image files with SAIA's Gemma vision model.",
    },
    audio_generation: {
      title: "Generate audio",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Enable tools.",
      step3: "Select Audio Generation, then describe the audio you want.",
    },
    arcana_tools: {
      title: "Use Arcana Tools",
      step1: "Open GWDG Tools from the prompt box.",
      step2: "Enable tools.",
      step3:
        "Select Arcana Tools so the assistant can inspect Arcana collections, manage their files and indexes, and handle sharing.",
    },
    diagram_renderers: {
      title: "Render diagrams from code blocks",
      step1: "Ask for a fenced code block: ```dot for Graphviz, ```vega-lite for Vega-Lite, or ```chart for a Chart.js JSON config.",
      step2: "Send the message. The block is rendered locally as an SVG or canvas chart.",
    },
    mcp_server: {
      title: "Connect an MCP server",
      step1: "Add an MCP server in the sidebar's MCP Servers section.",
      scan: "Or let the app search for local servers: Scan probes every port above 5000 on this machine for a /mcp endpoint and adds what it finds.",
      step2: "Enter the server URL and test the connection.",
      details:
        "Double-click a configured server, or open its options menu and choose Details, to see the name, version, protocol version, capabilities and tools it reports.",
      step3: "Open GWDG Tools, enable MCP Servers, and select the configured server.",
      policy:
        "In Settings → Advanced, choose whether chat turns may call tools of your MCP servers: Ask (the default, confirm each call), Always, or Never. This only affects your MCP servers; Chat AI's own file, workspace and agent tools stay available.",
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
      step4:
        "Use the button next to Create topic to collapse or expand all topics at once.",
    },
    attach_chat_to_workspace: {
      title: "Attach a chat to a workspace",
      step1:
        "Drag a chat from the sidebar onto a workspace row to attach it.",
      step2:
        "The attached chat appears under the workspace. Its files are available there too.",
      step3:
        "Drag the chat out of the workspace onto a topic to detach it again.",
    },
    sort_organize: {
      title: "Smart Sort",
      step1: "Click Smart Sort in the sidebar header.",
      step2:
        "Review the suggested topics, titles, and deletions. Nothing changes until you apply them.",
      step3:
        "Select the suggestions you want and click Apply to reorganize your chats.",
    },
    sort_group_chats: {
      title: "Sort and group chats",
      step1: "Open the sort menu in the sidebar.",
      step2:
        "Choose grouping by topic, date, creation date, or browser storage size.",
    },
    pin_chat: {
      title: "Pin a chat",
      step1: "Open the conversation menu of a chat in the sidebar.",
      step2:
        "Choose Pin chat. Pinned chats stay in their own area at the top, regardless of the selected grouping.",
    },
    pin_topic: {
      title: "Pin a topic",
      step1: "Open the options menu of a topic in the sidebar.",
      step2:
        "Choose Pin topic. Pinned topics stay in the pinned area at the top, regardless of the selected grouping.",
    },
    pin_workspace: {
      title: "Pin a workspace",
      step1: "Open the options menu of a workspace in the sidebar.",
      step2:
        "Choose Pin workspace. It is added to the pinned section at the top, above the chats, and stays in the workspace list.",
      step3:
        "Click the pin again in the pinned section to unpin the workspace.",
    },
    pin_agent: {
      title: "Pin an agent",
      step1: "Open the options menu of an agent in the sidebar.",
      step2:
        "Choose Pin agent. It is added to the pinned section at the top, above the chats, and stays in the agent list.",
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
    course_view: {
      title: "Open a course",
      step1:
        "Click Chat with Persona in the sidebar to open the persona library.",
      step2: "Choose the Courses folder on the left.",
      step3:
        "Click a course persona. The course page opens with the Learn and Review views.",
    },
    course_quiz_chat: {
      title: "Practise inside the course chat",
      step1:
        "Click Ask for a quiz question in the course chat banner. The tutor answers with an interactive quiz question that you can answer right here.",
      step2:
        "Click Show a learning page in the banner. The tutor embeds one of the course's own learning pages in its reply, where you can read and interact with it without leaving the chat.",
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
      step2: "Choose the Chat tab. Usage, Advanced, Memories and Data hold the other settings.",
      step3: "Change a preference such as document conversion. Changes are saved automatically.",
      step4: "Rendering engines and the reasoning indicator sit in the Advanced tab.",
    },
    institution: {
      title: "See what your institution restricts",
      step1: "Open your user settings from the profile or the sidebar.",
      step2: "Choose the Profile tab.",
      step3: "Open the Institution tab beside User.",
      step4:
        "The Institution section names who provides this installation and lists every limitation that applies here, such as a fixed model, disabled features and blocked external communication, with the contact and links.",
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
        "Choose the Chat tab to change the default model, send key, summaries, timestamps and document conversion; rendering is in the Advanced tab.",
    },
    advanced_mode: {
      title: "Show agents and MCP servers in the sidebar",
      step1: "Open your user settings.",
      step2: "Choose the Advanced tab.",
      step3:
        "Turn on Advanced mode to add the Agents and MCP Servers sections to the sidebar. With it off the sidebar shows chats, topics and workspaces only.",
    },
    e2ee: {
      title: "Encrypt a model end to end",
      step1: "Open your user settings.",
      step2: "Choose the Encryption tab.",
      step3:
        "Import the model's public key: paste it, choose a .pub file, load it from a URL, import a key directory, or pick a local folder and read every .pub file in it.",
      step_published:
        "Or load the keys the deployment publishes: the key base URL is prefilled from the configuration, and Load keys for all models imports and verifies every published .pub file.",
      step4:
        "Enter the models the key applies to when you add it. They then show a green lock and every request through them is encrypted in this browser.",
      step_test:
        "Test a key again against the models it is bound to. A key that answers the sealed test is marked green; an untested or failed key is not.",
    },
    message_timestamps: {
      title: "Show message timestamps",
      step1: "Open your user settings.",
      step2: "Choose the Chat tab.",
      step3:
        "In the Messages section, turn on Show message timestamps to see when each message was sent.",
    },
    rendering: {
      title: "Configure rendering",
      step1: "Open your user settings.",
      step2: "Choose the Advanced tab.",
      step3:
        "Enable Typst or LaTeX rendering. HTML rendering and external references are configured here too.",
    },
    reasoning_streaming: {
      title: "Follow the reasoning process",
      step1: "Open your user settings.",
      step2: "Choose the Chat tab.",
      step3:
        "The option is enabled by default. Keep it on to see a moving dot while the model reasons. Click the header to open the reasoning while it is streaming, or turn the option off if you prefer the box to open automatically.",
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
    sync_setup: {
      title: "Encrypted server synchronization",
      step1: "Open your user settings.",
      step2: "Choose the Data tab.",
      subtab: "Open the Server synchronization section.",
      step3:
        "The encrypted server synchronization keeps settings, conversations, workspaces and agents in step across your devices. Everything is encrypted in this browser before it is uploaded, and the passphrase is never stored.",
      step4:
        "Switch the server synchronization on, then create it with a passphrase you can remember, or unlock the copy another device already created for this account. Once it is open, you can add a passkey on this device so a reload does not ask for the passphrase again.",
    },
    backup_create: {
      title: "Create an encrypted backup",
      step1: "Open your user settings.",
      step2: "Choose the Data tab.",
      subtab: "Open the Encrypted backup section.",
      step3:
        "Under Encrypted backup, one file carries all chats, topics, settings, workspaces and agents. It is encrypted in this browser and stamped with the date and time.",
      step4:
        "Create it with a passphrase you can remember. The same passphrase restores the file later; matching items are overwritten and nothing is deleted.",
    },
    backup_restore: {
      title: "Restore an encrypted backup",
      step1: "Open your user settings.",
      step2: "Choose the Data tab.",
      subtab: "Open the Encrypted backup section.",
      step3:
        "Choose the backup file and type the passphrase it was created with. Confirm that matching items may be overwritten, then restore: items with the same id are replaced, new ones are added, and nothing is deleted.",
    },
    language_picker: {
      title: "Change the language",
      step1:
        "Open the language menu in the footer. English and German switch the interface immediately; Automatic follows your browser language again.",
    },
    pwa_install: {
      title: "Install the app",
      step1:
        "Use the install button in the footer to open your browser's installation dialog. The app then starts in its own window, without the address bar.",
    },
    bug_report: {
      title: "Report a problem",
      step1:
        "Open the bug report from the footer: choose a type, describe what happened and attach a screenshot if it helps.",
    },
    dark_mode: {
      title: "Switch theme",
      step1: "Use the theme toggle in the footer to switch between light and dark mode.",
    },
    brand_consent: {
      title: "Review your consents",
      step1: "Open your user settings.",
      step2: "Choose the Profile tab, then its Consents section.",
      step3:
        "Change the voluntary consents here; the terms of use and privacy links sit below the switches.",
    },
    feedback: {
      title: "Send feedback",
      step1:
        "Use the feedback buttons under an assistant message to rate an answer. A changed conversation is also sent to the feedback service for analysis while the feature is on.",
      step2:
        "Switch answer feedback and conversation analysis on or off in Chat preferences.",
      step3:
        "Under Profile → Feedback you can see everything this account sent and delete it again.",
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
    meta_chat_pins: {
      title: "Pin chats, topics, workspaces and agents with the Meta chat",
      step1: "Open the Meta chat from the AI icon in the sidebar.",
      step2:
        "Ask it to pin or unpin a chat, topic, workspace or agent, for example: “Pin the Pricing discussion chat” or “Unpin the Research topic.”",
      step3:
        "Review the proposed pin change and click Accept changes. Nothing is applied before you accept.",
    },
    meta_chat_navigation: {
      title: "Navigate and search with the Meta chat",
      step1: "Open the Meta chat from the AI icon in the sidebar.",
      step2:
        "Ask it to take you somewhere, for example: “Take me to chat settings” or “Open the chat about pricing.”",
      step3:
        "Ask it to search your chats, for example: “Find where we decided the pricing model” or “What are the action items?”. Click a cited message to jump to it.",
    },
    meta_chat_agents: {
      title: "Work with agents from the Meta chat",
      step1: "Open the Meta chat from the AI icon in the sidebar.",
      step2: "Ask for agent status or history, for example: “Check all agents and show recent files.”",
      step3: "Ask it to fetch a file, for example: “Show random.png from Research agent,” or review a prompt/interrupt proposal before accepting.",
    },
    meta_chat_workspaces: {
      title: "Attach workspaces from the Meta chat",
      step1: "Open the Meta chat from the AI icon in the sidebar.",
      step2: "Ask it to list workspaces and attach one, for example: “Attach Research workspace to agent 1.”",
      step3: "Review the workspace-link proposal and click Accept changes.",
    },
    meta_chat_digest: {
      title: "Get a what's-new digest",
      step1: "Open the Meta chat from the AI icon in the sidebar.",
      step2: "The banner shows when the last check ran. It is updated after each what's-new answer.",
      step3: "Ask “What's new?” to see changed chats, new topics and memories, agent status across all sessions and subagents, new or changed sessions, and recently modified agent files.",
    },
    meta_chat_mcp: {
      title: "Manage MCP servers from the Meta chat",
      step1: "Open the MCP Servers section in the sidebar or add a server there.",
      step2: "Return to the Meta chat from the AI icon.",
      step3: "Ask it to test servers, list their tools, or add/update/remove one. Sidebar changes require Accept.",
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
    backup_migration: {
      title: "Move your chats to a new device",
      description:
        "Carry chats, topics, settings, workspaces and agents to another browser with one encrypted backup file.",
      step1:
        "Create the backup under Encrypted backup, with a passphrase you can remember.",
      step2: "Copy the downloaded file to the other device or browser.",
      step3:
        "Restore it there with the same passphrase. Matching items are overwritten, new ones are added, and nothing is deleted.",
    },
  },
  // Chat settings
  settings: {
    memory_mode: {
      label: "Memories",
      description: "Choose how this conversation uses your saved memories.",
      help_label: "Learn about memories",
      default_group_name: "Default",
      group_label: "Memory group",
      group_default: "Default ({{group}})",
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
    audio_title: "Voice output",
    audio_description: "Voice and language for speech mode and read-aloud.",
    audio_unavailable: "Speech output is not configured.",
    label_audio_voice: "Voice",
    label_audio_language: "Language",
    audio_option_auto: "Automatic",
    audio_language_english: "English",
    audio_language_german: "German",
    audio_preview: "Preview voice",
    audio_preview_stop: "Stop preview",
    audio_sample_text_en: "Hi, this is how I sound in a conversation.",
    audio_sample_text_de: "Hallo, so klinge ich in einem Gespräch.",
    audio_voice_af_bella: "Bella — US English, female",
    audio_voice_af_nicole: "Nicole — US English, female",
    audio_voice_af_sarah: "Sarah — US English, female",
    audio_voice_am_adam: "Adam — US English, male",
    audio_voice_am_michael: "Michael — US English, male",
    audio_voice_bf_emma: "Emma — UK English, female",
    audio_voice_bm_george: "George — UK English, male",
    audio_voice_bm_lewis: "Lewis — UK English, male",
    reset_default: "Reset default",
    default: "Default",
    tools_title: "GWDG Tools",
    tools_enable_all: "Enable all",
    tools_disable_all: "Disable all",
    tools_enable_to_configure: "Turn this tool on to configure it.",
    tool_details: "{{name}} settings",
    chat_settings: "Chat settings",
    label_web_search: "Web Search",
    label_image_generation: "Image Generation",
    label_image_modification: "Image Modification",
    label_image_analysis: "Analyze images",
    label_audio_generation: "Audio Generation",
    label_arcana_tools: "Arcana Tools",
    label_arcana: "Arcana",
    label_mcp_server: "MCP Server",
    label_write_access: "Allow write",
    label_browser_storage: "Browser storage",
    label_create_docx: "Word document",
    tools_requires_browser_storage: "Enable browser storage or share a local folder first",
    tools_requires_workspace: "Attach a workspace first",
    tools_agent_unavailable: "Not available in agent mode",
    label_tool_limit: "Limit tool calls per response",
    tool_limit_hint: "Maximum tool invocations per response; calls made together count once",
    tools_agent_external: "This model runs without tools",
    model_no_tools_warning:
      "This model does not support tools. The chat runs without file access, web search, or MCP tools.",
    placeholder_arcana_id: "Arcana id",
    placeholder_mcp_url: "http://localhost:3000/mcp",
    placeholder_mcp_auth: "Authorization header (optional)",
    mcp_add: "Add MCP server",
    mcp_remove: "Remove server",
    mcp_test: "Test the server by establishing a direct connection from your computer",
    mcp_test_success: "{{name}} is reachable ({{count}} tools).",
    mcp_test_failed: "MCP test failed: {{error}}",
    mcp_test_invalid_url: "Enter a valid MCP server URL first.",
    mcp_toggle: "Use this server",
  },

  // Conversation
  conversation: {
    meta_tokens: "tokens",
    meta_cost: "cost",
    local_tools: "Browser & local tools",
    mount_folder: "Share local folder",
    folder_mounted: "Folder available to the assistant at {{path}}",
    tool_failed: "failed",
    codemode_running: "Running code…",
    codemode_output: "Code output",
    close_chat: "Close chat",
    speech_mode_title: "Voice conversation",
    speech_mode_button: "Start voice conversation",
    speech_mode_close: "Close voice conversation",
    speech_mode_listening: "Listening",
    speech_mode_capturing: "I'm listening",
    speech_mode_thinking: "Thinking",
    speech_mode_speaking: "Speaking",
    speech_mode_error: "Voice mode needs attention",
    speech_mode_hint_listening: "Speak naturally. I'll send your message when you pause.",
    speech_mode_hint_capturing: "Pause when you're done, or send now.",
    speech_mode_hint_interrupt: "Start talking at any time to interrupt.",
    speech_mode_hint_error: "Check microphone access and try again.",
    speech_mode_hint_start: "Microphone is live",
    speech_mode_send_now: "Send now",
    speech_mode_interrupt: "Interrupt",
    speech_mode_retry: "Try again",
    speech_mode_didnt_catch: "I didn't catch that. Please try again.",
    speech_mode_output_unavailable: "Speech output is unavailable, but the reply is in the chat.",
    speech_mode_error_insecure: "Microphone access requires HTTPS or localhost.",
    speech_mode_error_permission: "Microphone permission was denied. Allow access and try again.",
    speech_mode_error_no_microphone: "No microphone was found.",
    speech_mode_error_microphone: "The microphone could not be started.",
    speech_mode_error_timeout: "The response took too long. Please try again.",
    speech_mode_error_conversation: "This conversation is no longer available.",
    prompt: {
      placeholder: "Ask me",
      attach: "Attach File",
      attach_device: "From device",
      attach_workspace: "From workspace",
      attach_media: "Attach Media",
      attachments: "Attachments",
      clear_attachments: "Clear all",
    },
    attachment: {
      image_unsupported: "Switch model to process image",
      audio_unsupported: "Switch model to process audio",
      file_unsupported: "Switch model to process {{filetype}}",
      unprocessed: "Unprocessed file",
      transcript_of: "Transcript of {{name}}",
      converting: "Converting…",
      transcribing: "Transcribing…",
      process_browser: "Process (browser)",
      process_server: "Process (server)",
      must_process: "File must be processed",
      optional_process: "Optional: convert to text",
    },
    reasoning: "Reasoning Process",
    code: "Code",
    code_lines: "{{count}} lines",
    show_code: "Show code",
    hide_code: "Hide code",
    copy_reasoning: "Copy reasoning process",
    reasoning_streaming: "Reasoning in progress",
    reasoning_streaming_label: "Thinking",
    reasoning_received_words_one: "{{count}} word received",
    reasoning_received_words_other: "{{count}} words received",
    action: "Action",
    download_rendered: "Download rendered document",
    html_block: {
      render: "Render HTML",
      show_code: "Show code",
    },
    typst_block: {
      render: "Render as Typst",
      show_code: "Show code",
    },
    graphviz_block: {
      render: "Render as Graphviz",
      show_code: "Show code",
    },
    vega_block: {
      render: "Render as Vega-Lite",
      show_code: "Show code",
    },
    chartjs_block: {
      render: "Render as Chart.js",
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
    sitemap: "Sitemap",
    help: "Help",
    imprint: "Imprint",
    terms: "Terms of Use",
    docs: "Docs",
    privacy: "Data Privacy (ChatAI)",
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
        title: "Profile",
        description: "Review your account details.",
      },
      usage: {
        label: "Usage",
      },
      advanced: {
        label: "Advanced",
        title: "Advanced settings",
        description:
          "Rendering engines, the reasoning indicator and the advanced sidebar sections.",
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
      encryption: {
        label: "Encryption",
        title: "End-to-end encryption",
        description:
          "Manage the public keys of encryption-capable models and choose which models use them.",
      },
      data: {
        label: "Data",
        title: "Data and privacy",
        description:
          "Manage local data, download an encrypted backup, and keep your devices in step with encrypted server synchronization.",
      },
    },
    profile: {
      sections: {
        label: "Profile sections",
        user: "User",
        institution: "Institution",
        consents: "Consents",
      },
      feedback: {
        label: "Feedback sent from this account",
        description:
          "See the ratings, reports and conversations this account sent to the feedback service, and delete them.",
        open: "View collected feedback",
        modal_title: "Collected feedback",
        modal_intro:
          "Everything this account sent to the feedback service, newest first. Only your own submissions are listed.",
        loading: "Loading feedback…",
        load_failed: "The feedback could not be loaded.",
        retry: "Try again",
        empty: "This account has not sent any feedback yet.",
        count: "{{count}} entries",
        kind_report: "Report",
        kind_rating: "Rating",
        type_bug: "Bug",
        type_feedback: "Feedback",
        type_accessibility: "Accessibility",
        type_other: "Other",
        rating_up: "Thumbs up",
        rating_down: "Thumbs down",
        delete_all: "Delete all feedback",
        delete_confirm:
          "Delete all {{count}} entries? Ratings, reports and the conversations sent for analysis are removed permanently.",
        delete_confirm_action: "Delete permanently",
        deleting: "Deleting…",
        deleted: "Deleted {{count}} entries.",
        delete_failed: "The feedback could not be deleted: {{error}}",
      },
    },
    account: {
      username: "Username",
      email: "Email address",
      institute: {
        title: "Institution",
        description:
          "This Chat AI installation is provided by your institution, which may narrow the options available here.",
        limitations: "Limitations for this institution",
        links: "Links",
        contact: "Contact",
        model: "Model choice",
        model_fixed: "Fixed to {{model}}",
        model_allowed: "Limited to {{models}}",
        modules_label: "Disabled modules",
        features_label: "Disabled features",
        external_label: "Blocked external communication",
        locks_label: "Fixed settings",
        ui_label: "Hidden controls",
        modules: {
          tools: "Tools",
          feedback: "Feedback",
          choices: "Follow-up suggestions",
          agent: "Browser agent",
          agents: "Agents",
          arcanas: "Arcana Tools",
          speech: "Speech output",
          sync: "Server synchronization",
        },
        features: {
          meta_chat: "Meta chat",
          workspaces: "Workspaces",
          mcp_servers: "MCP servers",
          e2ee: "End-to-end encryption",
          tutorials: "Tutorials",
          import_git: "Cloning Git repositories",
        },
        external: {
          web_search: "Web search",
          external_models: "External models",
          mcp: "MCP servers",
          external_references: "External references in rendered content",
        },
        locks: {
          model: "Model choice",
          tools: "GWDG Tools",
          chat_settings: "Chat settings",
        },
        ui: {
          model_selector: "Model name",
          external_warning: "Data-safety warning",
        },
      },
    },
    usage: {
      title: "Usage",
      description:
        "Monitor your monthly usage and organization budget usage.",
      empty: "No usage limits are recorded for this account.",
      expand: "Show details",
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
        label: "Suggest follow-up prompts",
        description: "Show suggested ways to continue after each response.",
        title_once: {
          label: "Set title only on first prompt",
          description:
            "Only generate the conversation title once, from the first prompt.",
        },
      },
      summaries: {
        label: "Show summaries on hover",
        description:
          "Generate a short summary when you switch away from a chat, then show it when hovering over that chat in the sidebar.",
      },
      sidebar: {
        advanced: {
          label: "Advanced mode",
          description:
            "Show Agents and MCP servers in the sidebar. When this is off, the sidebar shows only chats and workspaces.",
        },
      },
      mcp_tools: {
        label: "MCP tool calls in chats",
        description:
          "Choose whether the assistant may call tools of the MCP servers you added. The app's own file, workspace and agent tools are not affected.",
        note: "This setting only covers your MCP servers; Chat AI's own read, write and workspace tools are always available.",
        options: {
          ask: {
            label: "Ask",
            description:
              "Ask before each MCP tool call. You can allow a tool for the current chat.",
          },
          always: {
            label: "Always",
            description:
              "Run MCP tools without asking. Only use this with servers you trust.",
          },
          never: {
            label: "Never",
            description:
              "Do not offer tools of your MCP servers in chats. The app's own tools stay available.",
          },
        },
      },
      messages: {
        timestamps: {
          label: "Show message timestamps",
          description:
            "Display the date and time each message was sent below the message.",
        },
      },
      feedback: {
        label: "Send feedback to the operator",
        description:
          "Show thumbs up/down under each answer and send the conversation to the server for analysis whenever it changes. Turning this off removes the rating buttons and stops the conversation from being sent.",
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
      graphviz: {
        label: "Render Graphviz diagrams",
        description:
          "Render ```dot and ```graphviz blocks locally. The first render downloads the Graphviz engine (about 1.4 MB) after your confirmation.",
      },
      vega: {
        label: "Render Vega-Lite charts",
        description:
          "Render ```vega-lite and ```vega blocks locally. External data URLs stay blocked unless external references are enabled.",
      },
      chartjs: {
        label: "Render Chart.js charts",
        description:
          "Render ```chart and ```chartjs blocks locally from a Chart.js JSON configuration.",
      },
      reasoning_streaming: {
        label: "Keep reasoning collapsed while streaming",
        description:
          "Keep the reasoning box closed while the model is streaming and show a small moving activity dot instead. Click the header to open it while streaming, or open it after the response is complete.",
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
      sections: {
        label: "Data sections",
        manage: "Manage data",
        backup: "Encrypted backup",
        sync: "Server synchronization",
      },
      export_success: "Local data exported successfully.",
      export_error: "Local data could not be exported.",
      storage_title: "Browser storage",
      storage_unavailable: "Storage information is not available in this browser.",
      storage_persisted:
        "Persistent storage is enabled. The browser should keep your chats when storage is low.",
      storage_not_persisted:
        "Persistent storage is not enabled. The browser may remove local chats when storage is low or the site is inactive. Export a backup regularly.",
      storage_usage: "Using {{used}} of {{quota}}.",
      storage_request: "Request persistent storage",
      storage_requesting: "Requesting…",
      storage_request_granted:
        "Persistent storage was granted. The browser should keep your chats when storage is low.",
      storage_request_denied:
        "The browser did not make storage persistent. Chrome grants this only to installed apps or sites you use regularly; Firefox may ask for permission. See the browser console for details.",
      storage_request_unsupported:
        "This browser does not support requesting persistent storage.",
      storage_request_failed: "Persistent storage request failed: {{error}}",
      backup: {
        title: "Encrypted backup",
        description:
          "Download one encrypted file of all chats, topics, settings, workspaces and agents, and restore it later with the same passphrase.",
        notice:
          "The backup is encrypted in this browser before it is downloaded. The passphrase is never stored and cannot be recovered; without it the file cannot be opened. Keep the file and the passphrase somewhere safe.",
        create_title: "Create a backup",
        create_description:
          "The file is stamped with the current date and time. Files larger than 8 MB are left out and reported.",
        passphrase: "Passphrase",
        passphrase_confirm: "Repeat passphrase",
        passphrase_hint: "At least {{count}} characters.",
        create_button: "Create and download backup",
        creating: "Creating backup…",
        created: "Backup {{file}} downloaded ({{records}} items).",
        missing_passphrase: "Enter a passphrase.",
        mismatch: "The passphrases do not match.",
        create_error: "The backup could not be created: {{error}}",
        restore_title: "Restore a backup",
        restore_description:
          "Choose a backup file and enter its passphrase. The backup is merged into this browser: items with the same id are overwritten and nothing is deleted.",
        choose_file: "Backup file",
        choose_file_first: "Choose a backup file first.",
        file_summary: "Backup from {{date}} · {{records}} items",
        inspect_error: "This is not a readable Chat AI backup: {{error}}",
        restore_passphrase: "Backup passphrase",
        restore_confirm:
          "I understand that matching chats, topics, workspaces, agents and settings are overwritten.",
        confirm_required: "Confirm that the restore may overwrite matching items.",
        restore_button: "Restore backup",
        restoring: "Restoring…",
        restored: "Backup restored: {{records}} items.",
        restore_error: "The backup could not be restored: {{error}}",
        unknown_namespaces: "Data from a newer version was skipped: {{namespaces}}.",
      },
      sync: {
        title: "Encrypted server synchronization",
        description:
          "Keep conversations, settings, workspaces and agents in step across your devices by storing an encrypted copy on your SAIA filesystem.",
        notice:
          "Everything is encrypted in this browser before it is uploaded. The passphrase never leaves your device, the server cannot read the copy, and without the passphrase the data cannot be recovered. Use a passphrase you can remember and keep it safe.",
        enable_label: "Store an encrypted copy on my SAIA filesystem",
        enable_description:
          "Off by default. Nothing is uploaded until you create or unlock the copy below.",
        create_title: "Create the encrypted copy",
        create_description:
          "The passphrase protects the key that encrypts the archive. Losing it means losing access to the copy.",
        unlock_title: "Unlock the existing copy",
        unlock_description:
          "Another device already created a copy for this account. Enter its passphrase to use it here.",
        passphrase: "Passphrase",
        passphrase_confirm: "Repeat passphrase",
        passphrase_hint: "At least {{count}} characters.",
        create_button: "Create encrypted copy",
        unlock_button: "Unlock",
        checking: "Checking the server…",
        check_again: "Check again",
        exists_hint:
          "A copy already exists. Unlock it, or replace it with a new vault and re-upload everything.",
        replace_warning:
          "Replacing the vault makes every uploaded file unreadable. This device uploads its data again.",
        replace_button: "Replace the vault",
        unlocked_title: "Connected",
        vault: "Vault",
        device: "This device",
        last_sync: "Last sync",
        never: "Not synced yet",
        conflicts: "Conflicts",
        skipped: "Skipped files",
        skipped_hint:
          "Files larger than 8 MB are not uploaded. The chat or workspace keeps a placeholder.",
        conflict_hint:
          "Conflicts keep both versions. A conversation is copied with “ (conflict copy)” in its title.",
        sync_now: "Sync now",
        syncing: "Syncing…",
        lock: "Lock vault",
        auto_label: "Sync automatically",
        auto_description:
          "Runs every five minutes while this tab is open and the vault is unlocked.",
        change_title: "Change the passphrase",
        change_button: "Change passphrase",
        changed: "The passphrase was changed. The archive was not re-encrypted.",
        rotate_title: "Replace the vault",
        rotate_description:
          "Creates a new vault key and a new key derivation salt. Every uploaded file becomes unreadable, then this device uploads its data again. Use this to revoke a device that should no longer read the copy.",
        rotate_button: "Replace vault and re-upload",
        rotated: "The vault was replaced. Run a sync to upload this device again.",
        cleanup: "Clean up remote files",
        cleanup_description:
          "Deletes record revisions and attachments that no device index references any more.",
        cleanup_done: "Removed {{records}} revisions and {{assets}} attachments.",
        disable_hint:
          "Turning the server synchronization off stops syncing and locks the vault. The encrypted files stay on your filesystem until you clean them up or delete them there.",
        passkey_title: "Passkey on this device",
        passkey_description:
          "Keep the vault unlocked across reloads without saving the passphrase. The passkey stores only a wrapped copy of the vault key; the key itself stays in your browser's memory.",
        passkey_add: "Add a passkey",
        passkey_default_label: "Sync vault",
        passkey_label: "Passkey name",
        passkey_label_placeholder: "e.g. Work laptop",
        passkey_enrolled: "Enrolled: {{label}}",
        passkey_forget: "Forget this passkey",
        passkey_unlock: "Unlock with passkey",
        passkey_unlock_hint:
          "Your browser asks for the passkey (fingerprint, face or device PIN) and the vault opens without the passphrase.",
        passkey_session_hint:
          "This session unlocked with a passkey. After a reload it is requested again automatically; your browser may need a click first.",
        passkey_click_hint:
          "Browsers may require a click before showing the passkey prompt.",
        passkey_added:
          "The passkey was added. This device can unlock the vault after a reload.",
        passkey_unlocked: "Unlocked with the passkey.",
        passkey_forgotten:
          "The passkey was forgotten. The passphrase still opens the vault.",
        passkey_unsupported:
          "This browser cannot use passkeys. The passphrase remains the only way to unlock the vault here.",
        onboarding_title: "Keep your chats in step across devices",
        onboarding_intro:
          "Chat AI can keep an encrypted copy of your conversations, topics, settings, workspaces and agents in your SAIA filesystem. Your other devices read that copy, so a chat you start here continues there.",
        onboarding_point_encrypted:
          "Encrypted before upload: everything is encrypted in this browser, the passphrase never leaves your device, and the server cannot read the copy.",
        onboarding_point_passphrase:
          "One passphrase protects the key. Without it the copy cannot be recovered, so use a passphrase you can remember and keep safe (at least {{min}} characters).",
        onboarding_point_passkey:
          "Optional passkey: once the copy is open, a passkey on this device (fingerprint, face or device PIN) opens it again after a reload without asking for the passphrase. Only a wrapped copy of the vault key is stored in this browser.",
        onboarding_point_nothing:
          "Nothing is uploaded until you create the copy, and you can switch the synchronization off whenever you want.",
        onboarding_where:
          "The copy lives in your SAIA filesystem account folder. If another device already created one for this account, unlock that copy instead of creating a second one.",
        onboarding_privacy:
          "The passphrase and the vault key are never stored. The Meta chat cannot read them and cannot create or unlock the copy; that stays in Data settings.",
        onboarding_setup: "Set up synchronization",
        onboarding_existing_title:
          "An encrypted synchronization already exists for this account",
        onboarding_existing_intro:
          "Another device already stores an encrypted copy of your conversations, topics, settings, workspaces and agents in your SAIA filesystem. Set that copy up on this device to read it — you need the passphrase it was created with.",
        onboarding_existing_point_passphrase:
          "Enter the passphrase that copy was created with on the other device. Without it the copy cannot be read here, and there is no recovery.",
        onboarding_existing_point_nothing:
          "Nothing is uploaded from this device until you unlock that copy, and you can switch the synchronization off whenever you want.",
        onboarding_existing_setup: "Set it up on this device",
        onboarding_later: "Not now",
        onboarding_footer:
          "You can find this later in User settings → Data → Server synchronization.",
        missing_passphrase: "Enter the passphrase.",
        mismatch: "The passphrases do not match.",
        session_expired: "The vault was locked. Enter the passphrase again.",
        error: "Sync failed: {{error}}",
      },
    },
    clear_data_button: "Delete All Local Data",
    import_data_button: "Import Data",
    export_data_button: "Export Data",
    memory: {
      title: "User Memories",
      description:
        "Manage your personal memories that help the AI remember important details about you. You currently have {{count}} memories saved.",
      manage: "Manage Memory",
      groups: {
        title: "Memory groups",
        description:
          "Group memories like folders. The default group is used unless a chat selects another group.",
        default_name: "Default",
        default_label: "Default group",
        default_badge: "Default",
        name_placeholder: "New group name",
        add: "Add",
        rename: "Rename group",
        delete: "Delete group",
      },
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
  course: {
    title: "Course",
    badge: "Course",
    open_course: "Open course",
    open_named: "Open the course {{title}}",
    banner_label: "Course chat",
    loading: "Loading course…",
    load_error: "The course could not be loaded.",
    load_error_detail: "Details:",
    not_a_course: "This persona is not a course.",
    retry: "Retry",
    chat_error: "The course chat could not be started.",
    start_chat: "Start course chat",
    starting_chat: "Starting…",
    mode_label: "View",
    mode_learn: "Learn",
    mode_review: "Review",
    tabs_label: "Course sections",
    tab_skills: "Skills",
    tab_quiz: "Quiz",
    tab_lernseiten: "Learning pages",
    tab_skills_review: "Skills (review)",
    tab_quiz_review: "Quiz (review)",
    stat_topics: "{{n}} topics",
    stat_skills: "{{n}} skills",
    stat_questions: "{{n}} questions",
    stat_lernseiten: "{{n}} learning pages",
    skills: {
      search: "Search skills",
      empty: "No skills found.",
      questions: "{{n}} questions",
      needs: "Needs: {{names}}",
      lernseite: "Learning page",
      open_lernseite: "Open learning page",
      quiz: "Practise",
      chat: "Ask",
      chat_about: "Ask the course tutor about this skill",
      chat_prompt:
        "Explain the skill “{{name}}” from this course to me.\n\n{{description}}",
    },
    quiz: {
      empty: "There are no questions for this filter.",
      filter_label: "Skill:",
      all_skills: "All skills",
      draft: "Draft",
      progress: "Question {{current}} of {{total}}",
      question_label: "Answer",
      sample_answer: "Sample answer",
      open_note:
        "Open questions are not graded automatically. Compare your answer with the sample answer.",
      correct: "Correct.",
      incorrect: "Not correct yet.",
      explanation: "Explanation",
      check: "Check",
      show_solution: "Show solution",
      reset: "Reset",
      previous: "Previous",
      next: "Next",
      type_single: "Single answer",
      type_multiple: "Multiple answers",
      type_open: "Open question",
    },
    material_chat: {
      hint: "The tutor can show a quiz question or a learning page from this course here in the chat.",
    },
    quiz_chat: {
      button: "Ask for a quiz question",
      prompt: "Please give me an example quiz question from this course to practise.",
      block_error: "This quiz question could not be loaded.",
      block_missing: "This question is no longer part of the course.",
      block_loading: "Loading quiz question…",
    },
    page_chat: {
      button: "Show a learning page",
      prompt: "Please show me an example learning page from this course.",
      block_loading: "Loading learning page…",
      block_error: "This learning page could not be loaded.",
      block_missing: "This learning page is no longer part of the course.",
    },
    lernseiten: {
      title: "Learning pages",
      description:
        "Interactive explanations that build a skill step by step.",
      empty: "This course has no learning pages yet.",
      loading: "Loading learning page…",
      load_error: "The learning page could not be loaded.",
      belongs_to: "Belongs to: {{name}}",
      unknown_skill: "No skill assigned",
      close: "Close",
      pick: "Pick a learning page above.",
    },
    review: {
      description:
        "The review view shows the solutions and the course coverage. It is meant for lecturers, not for practising.",
      coverage: "Coverage",
      skills_with_lernseite: "{{with}} of {{total}} skills have a learning page.",
      questions_by_type:
        "{{single}} single choice, {{multiple}} multiple choice, {{open}} open questions.",
      drafts: "{{n}} questions are still marked as draft.",
      no_explanations:
        "No question has an explanation, so checking only shows correct/incorrect.",
      missing: "This course has no review view yet.",
      loading: "Loading review view…",
      load_error: "The review view could not be loaded.",
    },
  },
  // Memory Modal
  memory: {
    userMemory: "User Memory",
    userMemoryGroup: "User Memory (Group: {{group}})",
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
      "Tools are a new and experimental feature designed to extend the capabilities of Chat AI. They allow the model to perform additional actions or access additional resources in order to provide more useful, accurate, or specialized responses. Current tools include Arcana, Arcana Tools, Web Search, image and audio generation, and MCP servers. Arcana Tools lets the assistant inspect and manage Arcana collections, their files, indexes, and sharing. As this feature is still evolving, functionality and available tools may change over time.",
    web_search:
      "The web search tool allows the AI to look up the latest information from the internet to improve its responses. When enabled, the AI can generate search queries based on your question and the full conversation history, send them to a search engine (such as Google), and use the retrieved results to provide more accurate and up-to-date answers. This is especially useful for topics where current or rapidly changing information is important.",
    top_p:
      "top_p is a slider from 0 to 1 which adjusts the total population of probabilities considered for the next token. A top_p of 0.1 would mean only the top 10% of cumulative probabilities is considered. Variating top_p has a similar effect on predictability and creativity as temperature.",
  },
  model_selector: {
    change_model: "Change model",
    locked: "The model is set by your institution",
    docs_hint_text: "Need help deciding which model fits best?",
    docs_hint_link: "Read the model overview.",
    scope_filter: "Filter models",
    scope_all: "All models",
    scope_internal: "Internal only",
    scope_external: "External only",
  },
  // Tour
  tour: {
    welcome_message: "Welcome to {{app}}",
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
    mcp_unreachable: "MCP server {{url}} is not reachable. Make sure it is running, or turn it off in the tool settings to continue.",
    mcp_name_changed_title: "MCP server name changed",
    mcp_name_changed:
      "The server at {{server}} now reports the name \"{{actualName}}\" instead of \"{{previousName}}\". Connect to it and update the saved name?",
    mcp_name_changed_connect: "Connect and update",
    folder_access:
      "The assistant wants to use the local folder <strong>{{name}}</strong> again. Your browser needs you to allow access after a reload.",
    title: "Warning",
    bad_request:
      "Bad request was sent: Please clear conversation, reattempt within the limit, and save your chat history for future reference.",
    clear_data:
      "Caution! This permanently deletes all conversations, attachments, and local settings from this browser. Export a backup first if you may need them. Are you sure?",
    clear_messages:
      "Are you sure you want to erase all messages in this conversation?",
    clear_agent_history:
      "Clear this agent's history? This deletes the OpenCode session and starts a new one without the previous context.",
    clear_agent_history_yes: "Clear history",
    close_chat:
      "Close this chat? It will be removed from your conversations.",
    close_chat_yes: "Close chat",
    close_agent_session: "Close this session? It will be removed from OpenCode.",
    close_agent_session_yes: "Close session",
    close_agent_group_sessions:
      "Close all {{count}} sessions in “{{group}}”? Running turns are interrupted and the sessions are removed from OpenCode.",
    close_agent_group_sessions_yes: "Close all sessions",
    restore_agent_sessions:
      "Create new sessions on the agent server and write each cached transcript into its instructions? The old sessions are not recreated, and the cached history is sent to this agent's server.",
    restore_agent_sessions_yes: "Restore sessions",
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
    data_security_notice_e2ee:
      "Your data will be processed securely within our servers. No information will be transmitted outside of the GWDG. This model is additionally end-to-end encrypted: your messages are sealed in this browser.",
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
  document_panel: {
    resize: "Resize preview",
    back_to_chat: "Back",
  },
  mcp: {
    section_title: "MCP Servers",
    add: "Add MCP server",
    add_empty: "Add an MCP server",
    edit_title: "Edit MCP server",
    empty: "No MCP servers configured yet.",
    name_label: "Name",
    name_placeholder: "My file server",
    url_label: "Server URL",
    auth_label: "Authorization (optional)",
    test: "Test connection",
    remove: "Remove",
    options: "MCP server options",
    tooltip: "MCP servers expose extra tools and files to the assistant through the Model Context Protocol. This app connects to them directly from this device.",
    configured: "Configured MCP Servers",
    policy_never_notice:
      "MCP tool calls in chats are set to Never in Settings → Advanced, so these servers are not used in chats. Your selection is kept and applies again when you switch the setting. Chat AI's own file and workspace tools stay available.",
    invalid_url: "Invalid MCP server URL. Edit the server to fix it.",
    status_unchecked: "Not tested — click to test",
    status_checking: "Testing connection",
    status_ready: "Connected",
    status_error: "Not reachable — click to retry",
    details: "Details",
    details_title: "MCP server details",
    details_name: "Configured as",
    details_server_name: "Server name",
    details_address: "Address",
    details_version: "Version",
    details_protocol: "Protocol version",
    details_website: "Website",
    details_description: "Description",
    details_capabilities: "Capabilities",
    details_tools: "Tools ({{count}})",
    details_no_tools: "This server exposes no tools.",
    details_instructions: "Instructions",
    details_loading: "Reading what the server reports…",
    details_failed: "Could not read the server details.",
    details_retry: "Try again",
    details_none: "Not provided",
    none_configured: "Add a server in the MCP Servers section first.",
    scan_title: "Scan for local MCP servers",
    scan_hint:
      "Checks every port above 5000 on this device for a /mcp endpoint and adds every server it finds. Only works when this app is opened in a browser on the same machine.",
    scan_action: "Scan",
    scan_cancel: "Stop",
    scan_progress:
      "{{scanned}} of {{total}} ports checked · {{found}} found",
    scan_server_name: "Local MCP server (port {{port}})",
    scan_done: "Added {{servers}} local MCP server(s).",
    scan_empty: "No local MCP server found on ports above 5000.",
    scan_failed: "Scan failed: {{error}}",
  },
  agents: {
    section_title: "Agents",
    sessions: "Sessions",
    new_session: "New session",
    no_sessions: "No sessions yet.",
    no_workspace_sessions: "No sessions attached to this workspace yet.",
    unassigned_sessions: "Unassigned sessions",
    no_unassigned_sessions: "Every session is attached to a workspace.",
    sessions_in_workspace: "Sessions in {{workspace}}",
    detach_session: "Remove from workspace",
    attach_to_workspace: "Attach to workspace",
    offline_cached:
      "The agent is not reachable. Showing the history cached at {{time}}.",
    offline_no_cache:
      "The agent is not reachable and no history has been cached for this session yet.",
    sessions_cached:
      "The agent is not reachable. These sessions come from the local cache.",
    sessions_cached_short: "cached",
    restore_sessions_banner_one:
      "The agent is reachable, but 1 cached session no longer exists on its server. Restore it from the local cache?",
    restore_sessions_banner_other:
      "The agent is reachable, but {{count}} cached sessions no longer exist on its server. Restore them from the local cache?",
    restore_sessions_action: "Restore from cache",
    restore_sessions_busy: "Restoring…",
    restore_sessions_done_one:
      "Restored {{count}} session from the local cache.",
    restore_sessions_done_other:
      "Restored {{count}} sessions from the local cache.",
    restore_sessions_none: "There was no cached history to restore.",
    restored_history:
      "This transcript was restored into the session's instructions from the local cache. The agent server has no messages for it yet.",
    restore_session_title: "{{name}} (restored)",
    session_missing:
      "This session no longer exists on the agent server and no cached history is available. Clear the history to start a new session.",
    subagent_short: "sub",
    rename_session: "Rename session",
    close_session: "Close session",
    session_options: "Session options",
    session_renamed: "Session renamed",
    session_closed: "Session closed",
    close_group_sessions: "Close all sessions in this group",
    group_sessions_closed_one: "1 session closed.",
    group_sessions_closed_other: "{{count}} sessions closed.",
    group_sessions_failed_one: "1 session could not be closed: {{message}}",
    group_sessions_failed_other:
      "{{count}} sessions could not be closed: {{message}}",
    session_name_placeholder: "Session name",
    tooltip: "Remote agents running on GWDG infrastructure.",
    status_ready: "Connected and idle",
    status_working: "Working",
    status_error: "Connection issue",
    status_checking: "Checking connection",
    bridge: {
      title: "Agent workspace access",
      none: "No workspace bridge",
      disabled_hint:
        "Off. The agent cannot see workspace files. Turn access on to provide the reverse proxy for this agent.",
      use_workspace: "Use for the bridge",
      working: "Agent bridge working",
      connecting: "Agent bridge connecting…",
      not_working: "Agent bridge not working",
      off: "Agent bridge off",
      unavailable: "Agent bridge not available",
      unavailable_detail: "No bridge endpoint at {{url}} (HTTP {{status}}).",
      disabled_by_server:
        "An older back service refuses bridge sessions when it has no shared secret (HTTP 503). Update it, or set bridgeSharedSecret in back.json (or BRIDGE_SHARED_SECRET) and the same value as bridgeKey in front.json, then restart both services.",
      key_rejected:
        "The back service rejected the bridge key (HTTP 401). bridgeKey in front.json must match bridgeSharedSecret in back.json (or BRIDGE_SHARED_SECRET).",
      unreachable:
        "The browser could not reach the bridge at {{url}}. Check that the service is running and that the app origin is allowed: a front end on another port is a different origin, so name it in corsOrigins in back.json (or CORS_ORIGINS).",
      unavailable_hint:
        "This deployment does not provide the agent bridge. It is served by the Chat AI back service (/bridge/*) or by the SAIA agent service (/agents/<id>/bridge).",
      offline_hint:
        "The browser lost its connection to the bridge. It reconnects automatically.",
      disabled_after_failure:
        "Access was switched off because the bridge could not start. Turn it on to try again.",
      needs_workspace:
        "Attach a workspace first. The bridge exposes only attached workspaces.",
      options: "Options",
      writable: "Allow writes",
      writable_hint:
        "Lets the agent create, change and delete files in the attached workspace. Without it the workspace stays read-only.",
      mcp: "MCP tools",
      mcp_hint:
        "Lets the agent call the configured MCP servers through this browser session; this needs agent workspace access. Their results and data leave the app through those servers.",
      mcp_servers: "MCP servers",
      inject: "Inject external MCP tools",
      inject_hint:
        "OpenCode connects to the MCP servers it can reach that need no password, so their tools work without this tab and without workspace access. The others stay on the local MCP relay.",
      inject_running: "Adding MCP servers to OpenCode…",
      inject_summary: "Direct in OpenCode: {{direct}} · via bridge: {{bridge}}",
      inject_fallback:
        "OpenCode could not connect {{servers}}, so they stay on the bridge relay",
      inject_relay_off_one:
        "The MCP tools switch above is off, so {{count}} server is not relayed in this session.",
      inject_relay_off_other:
        "The MCP tools switch above is off, so {{count}} servers are not relayed in this session.",
      inject_none: "No MCP server without a password is configured.",
      inject_error: "Could not add the MCP servers to OpenCode: {{message}}",
      wrapped_summary:
        "MCP servers with a stored token, as native stdio: {{count}}",
      wrapped_failed:
        "The stdio proxy for {{servers}} could not start, so they stay on the bridge relay",
      session_scope:
        "Both routes are limited to the session that is open: the entries carry its id and every other session of this agent is denied, including its subagents' siblings.",
      rescope_failed:
        "Could not move the bridge to this session: {{message}}",
      keep_open: "Keep this tab open. Workspace files and the MCP servers kept on the bridge are available only while the browser is connected.",
      tab_warning: "The agent bridge needs this tab to stay connected. Workspace files and the MCP servers kept on the bridge may stop until you return.",
      start_failed: "Could not start the workspace bridge: {{message}}",
    },
    spawn: "Spawn agent",
    add_empty: "Add an agent",
    add_title: "Add agent",
    name_label: "Agent name",
    name_placeholder: "e.g. Research assistant",
    edit_title: "Edit agent",
    options: "Agent options",
    pin_action: "Pin agent",
    unpin_action: "Unpin agent",
    connection_label: "Connection",
    mode_service: "GWDG HPC agentic service",
    mode_external: "OpenCode server",
    hpc_project_hint: "Select one of the HPC projects available to you.",
    default_name: "OpenCode agent",
    service_hint:
      "The agent service starts an OpenCode container for this agent and stops it when you remove the agent. No server URL or password is needed.",
    service_unavailable:
      "The GWDG HPC agentic service is not enabled for your account.",
    service_request_access:
      "If you are eligible for an HPC account, you can request access to this service by sending a request to support@gwdg.de.",
    service_checking:
      "Checking whether the GWDG HPC agentic service is available for your account…",
    service_forced_hint:
      "In a deployment agents run through the agent service (SAIA). Direct OpenCode connections are only possible when Chat AI runs locally.",
    hpc_project_label: "HPC project",
    server_url_label: "opencode server",
    server_password_label: "Server password",
    connect_hint:
      "The agent connects directly to your opencode serve instance with these credentials.",
    connect_failed: "Could not connect to the opencode server: {{error}}",
    connecting: "Connecting…",
    add: "Add agent",
    empty: "No agents yet.",
    not_found: "Agent not found.",
    remove: "Remove agent",
    clear_history: "Clear agent history",
    removed_locally: "Agent removed locally; its server could not be reached or authenticated.",
    service_conflict_removed:
      "Agent {{name}} was removed: the agent service can no longer run it ({{status}}). Add a new agent to continue.",
    service_conflict_unknown: "unusable state",
    workspaces: "Workspace",
    workspaces_hint:
      "Attach this agent to workspaces. The first attached workspace becomes the active bridge unless another is selected.",
    workspaces_empty: "No workspaces available.",
    workspace_active: "Active",
    plan: "Plan",
    shell: "Shell",
    shell_tooltip: "Send this input directly to the terminal. Output appears in the chat.",
    shell_placeholder: "Enter a shell command…",
    shell_running: "Running command…",
    shell_status_running: "Running",
    shell_status_done: "Done",
    shell_status_failed: "Failed",
    shell_status_aborted: "Aborted",
    shell_exit: "Exit code {{code}}",
    shell_timeout: "The shell command did not finish in time.",
    shell_copy: "Copy output",
    shell_copied: "Shell output copied.",
    shell_abort: "Abort shell command",
    plan_tooltip: "Switch the OpenCode agent between Plan mode and its normal build mode.",
    commands_tooltip: "Run an OpenCode command in this session.",
    tools: {
      title: "OpenCode tools",
      tabs: {
        changes: "Changes",
        permissions: "Permissions",
        policies: "Policies",
        stats: "Usage",
        mcp: "MCP",
        connection: "Connection",
        recovery: "Recovery",
      },
      workspace: "Workspace / Git",
      tracked_files: "Tracked files",
      export_md: "Export MD",
      export_json: "Export JSON",
      exported: "Agent history exported.",
      exported_cached:
        "Agent server unreachable — exported cached history.",
      export_no_cache:
        "The agent server is unreachable and no cached history is available.",
      recovery_hint:
        "Exports fall back to the local cache when the agent server is unreachable. A cached transcript can also be restored into a new session.",
      cache_messages: "Cached messages: {{count}}",
      cache_synced: "Last cached: {{date}}",
      cache_never: "No cached history for this session yet.",
      restore_action: "Restore into new session",
      restore_hint:
        "Writes the cached transcript into the instructions of a new session.",
      restore_confirm_title: "Create a new session from the cache?",
      restore_warning:
        "This creates a new session and writes {{size}} of cached transcript into its instructions. The current session is not changed. Chat data is sent to this agent's server.",
      restore_cancel: "Cancel",
      restore_confirm: "Create session",
      restore_created: "Restored the cached history into a new session.",
      restore_empty: "No cached history is available to restore.",
      restore_session_title: "{{name}} (restored history)",
      restore_failed: "The new session could not be created.",
      policies_hint:
        "Policies automatically answer future permission requests for this agent. Use a wildcard such as bash* or * carefully.",
      policy_action: "Action pattern",
      policy_decision: "Decision",
      policy_once: "Allow once",
      policy_always: "Always allow",
      policy_reject: "Reject",
      policy_add: "Add policy",
      no_policies: "No permission policies.",
      test_connection: "Test connection",
      copy_diagnostics: "Copy diagnostics",
      copied: "Copied.",
      no_diagnostics: "No diagnostics loaded.",
      mcp_reconnected: "MCP server reconnected.",
      reconnect: "Reconnect",
      unsupported_field: "Unsupported field: {{field}}",
      working: "Working…",
      submit: "Submit",
      mcp_synced: "MCP server added to OpenCode.",
      mcp_removed: "MCP server removed from OpenCode.",
      reverted: "Session reverted.",
      revert: "Revert to message",
      revert_cleared: "Staged revert cleared.",
      clear_revert: "Clear revert",
      no_changes: "No file changes.",
      no_messages: "No messages available",
      no_saved_permissions: "No saved permissions.",
      permission_removed: "Permission removed.",
      remove: "Remove",
      no_stats: "No statistics available.",
      opencode_mcp: "OpenCode MCP servers",
      no_mcp: "No MCP servers configured in OpenCode.",
      chatai_mcp: "Chat AI MCP servers",
      no_chatai_mcp: "No MCP server with an address is configured in Chat AI.",
      add_to_opencode: "Add to OpenCode",
      added: "Added to OpenCode",
      mcp_transfer_hint:
        "Adding a server sends its name, URL and configured headers (including authorization) to your local OpenCode server. Chat data is not copied.",
    },
    hpc_project: "HPC project {{n}}",
    remote_hint: "Runs on GWDG infrastructure",
    chat_empty: "No messages yet. Ask the agent something.",
    form_result_title: "Form results",
    form_submitted: "Submitted",
    form_yes: "Yes",
    form_no: "No",
    form_not_answered: "Not answered",
    form_custom_answer: "Type your own answer",
    tool_call: "Tool call",
    tool_input: "Input",
    tool_output: "Output",
    open_preview: "Preview",
    open_preview_of: "Preview {{name}}",
    reasoning: "Reasoning",
    files: "Files",
    search_files: "Search files",
    search: "Search",
    no_search_results: "No matching files.",
    send: "Send",
    working: "Agent is working…",
    package_message: "Message from the package owner",
    session_busy: "This agent is still working. Wait for it to finish or stop it before sending another message.",
    chat_timeout: "The agent did not finish in time.",
    aborted_by_user: "Aborted by user",
    permission_title: "Permission required",
    permission_once: "Allow once",
    permission_always: "Always allow",
    permission_reject: "Reject",
    commands: "Commands",
    compact_command: "Compact the conversation",
  },
  workspace: {
    new_folder: "New folder",
    new_file: "New file",
    upload_file: "Upload file",
    add_file: "Add file",
    upload_success: "Uploaded {{count}} file(s)",
    upload_not_supported: "This source does not support uploads.",
    create_in: "Create in {{path}}",
    folder_name_placeholder: "Folder name",
    file_name_placeholder: "File name",
    entry_name_invalid: "Names cannot contain slashes.",
    rename_entry: "Rename entry",
    rename_in: "Rename in {{path}}",
    rename_success: "Renamed to {{name}}.",
    git_log: "Git log",
    git_log_empty: "No Git log entries found.",
    root_empty_hint: "Create a folder or file, or mount a folder from a source.",
    edit_title: "Manage Workspace",
    edit_storage: "Edit storage",
    manage_workspace: "Manage Workspace",
    file_manager: "File manager",
    resize_files_split: "Resize file tree and preview",
    back_to_workspace: "Back to workspace",
    edit_storage_hint:
      "Storage locations of {{name}}. Every change is applied immediately.",
    edit_storage_hint_no_name: "Every change is applied immediately.",
    workspace_options: "Workspace options",
    pin_action: "Pin Workspace",
    unpin_action: "Unpin Workspace",
    workspace_root: "Workspace Root",
    tab_preview: "Preview",
    tab_agents: "Agents",
    root_hint: "Files and folders kept in this workspace.",
    storage: "Storage",
    available_storage: "Available storage",
    add_folder: "Add folder",
    clone_repo_url: "Public repository URL",
    clone_branch: "Branch or tag (optional)",
    clone_default_branch: "Default branch",
    clone_folder: "Target subfolder",
    clone_agent: "Agent for git clone",
    clone_agent_required: "Select a local agent to run the clone.",
    clone_configure_agent_soon: "Configure another agent (coming soon)",
    clone_remote_agent_soon: "Remote agent (coming soon)",
    clone_target: "Clone into storage",
    clone_target_browser: "Browser storage",
    clone_target_local: "Choose a local folder…",
    clone_target_agent: "Agent storage ({{name}})",
    clone_target_agent_selected: "Agent storage: {{name}}",
    clone_target_local_selected: "Local folder: {{name}}",
    clone_target_required: "Select a writable storage target.",
    clone_target_missing: "The selected storage is no longer available.",
    clone_target_exists: "The target subfolder already exists.",
    clone_no_agent: "No local OpenCode agent is configured. Add a local agent before cloning.",
    mount_local_hint: "The selected folder is mounted read-write at its folder name.",
    mount_local_action: "Mount folder",
    choose_local_folder: "Choose local folder…",
    clone_prepare: "Clone and inspect",
    clone_preparing: "Preparing clone…",
    clone_progress_clone: "Cloning repository with the agent…",
    clone_progress_manifest: "Reading manifest…",
    clone_progress_measure: "Measuring repository…",
    clone_progress_copy: "Copying repository into storage…",
    clone_progress_files: "Copying {{files}} files · {{size}}",
    clone_progress_agent_storage: "Keeping clone in agent storage…",
    clone_progress_agent: "Creating agent…",
    clone_progress_chats: "Creating chats…",
    clone_progress_mount: "Mounting folder…",
    clone_applying: "Applying workspace setup…",
    clone_confirm_title: "Confirm repository import",
    clone_confirm_intro: "Review what will be created. Nothing has been copied into your workspace yet.",
    clone_summary_repo: "Repository",
    clone_summary_workspace: "Workspace",
    clone_summary_agent: "Agent",
    clone_summary_chats: "Chats",
    clone_summary_files: "{{files}} files{{size}}",
    clone_manifest_warning: "The manifest is untrusted repository content. It can configure chats and an agent, but cannot provide commands, scripts, credentials, or server URLs.",
    clone_manifest_present: "A workspace manifest was found. This clone copies repository files only; it does not create chats or agents.",
    clone_manifest_none: "No workspace manifest was found. Only repository files will be copied.",
    clone_browser_hint: "The repository is copied into this workspace's browser storage.",
    clone_review_action: "Copy into workspace",
    clone_confirm_action: "Create workspace",
    clone_new_session: "New session",
    clone_agent_connection: "Create the agent using this local connection",
    clone_continue: "Continue",
    clone_discard: "Discard",
    clone_discarded: "Clone discarded.",
    kind_git: "Git repository",
    sources_included: "Included",
    source_included_hint:
      "Created automatically with the workspace and cannot be removed here.",
    row_pending: "Pending",
    row_working: "Working…",
    row_done: "Done",
    row_failed: "Failed · {{message}}",
    clone_row_remove: "Remove source",
    advanced: "Advanced",
    create_applying: "Creating workspace…",

    mounts: "Folders",
    no_mounts: "Add a folder from any source to this workspace.",
    remove_mount: "Remove folder",
    mount_source: "Source",
    mount_source_path: "Folder in the source",
    mount_parent: "Folder in the workspace",
    make_read_only: "Make read-only",
    make_writable: "Make writable",
    make_source_read_only: "Make source read-only",
    make_source_writable: "Make source writable",
    source_read_only_error: "This source is read-only.",
    source_read_only: "Read-only source",
    source_unavailable: "This source is unavailable.",
    source_read_only_hint: "Block writes and deletions in this source.",
    mount_read_only_error: "This mount is read-only.",
    cannot_move_mount: "Mounted folders cannot be moved.",
    mount_read_only: "Read-only",
    mount_read_only_hint: "Do not allow changes through this mount.",
    folder_picker_up: "Up one level",
    folder_picker_loading: "Loading folders…",
    folder_picker_empty: "No subfolders here.",
    folder_picker_result: "Mounts at {{path}}",
    folder_picker_error: "Could not load folders.",
    mount_source_required: "Select a source.",
    mount_target_folder: "The workspace already has a folder at {{path}}.",
    mount_target_nonempty: "The folder {{path}} already contains files.",
    mount_target_file: "A file already exists at {{path}}.",
    mount_target_covers: "The folder {{path}} already contains a mounted folder.",
    mount_target_nested: "{{path}} is inside the mounted folder {{mount}}.",
    mount_target_reserved: "The folder {{path}} is reserved for chat uploads.",
    attached_chats: "Chats",
    attached_items: "Attached chats, agents and sessions",
    no_attached_chats: "No chats attached yet.",
    attach_chat: "Attach chat",
    attach_chat_error: "Could not attach the chat to the workspace",
    attach_session_error: "Could not attach the session to the workspace",
    new_chat: "New chat in this workspace",
    detach_chat: "Detach chat",
    attach_chat_hint: "Attach any chat to this workspace.",
    attach_agent: "Attach agent",
    attach_agent_hint:
      "Attach an agent to this workspace. The agent can then use it as a bridge workspace.",
    attach_agent_session: "Attach Agent Session",
    attach_agent_session_hint:
      "Pick the sessions of this agent that belong to this workspace. Other workspaces keep their own list.",
    attach_agent_session_picker_hint:
      "Pick a session to attach to this workspace. Its agent is attached too when it is not in the workspace yet.",
    no_unattached_sessions: "Every session is already attached to this workspace.",
    session_attached: "{{name}} attached to this workspace.",
    no_available_agents: "No unattached agents available.",
    agents: "Agents",
    agent: {
      title: "Agent",
      browser_title: "In-browser Pi agent",
      browser_description:
        "Runs in the browser. No shell, but it can read and write files in the workspace.",
      opencode_title: "OpenCode server",
      opencode_description:
        "Connect to an OpenCode server by address and use it with Chat AI.",
      remote_title: "Remote agent",
      remote_description:
        "The GWDG HPC agentic service agent that also appears in the sidebar.",
      choose_existing: "Choose an existing agent",
      add_new: "Add new agent",
      no_agents: "No agents of this kind yet.",
      in_use: "In use",
      available: "Available",
      back: "Back",
    },
    no_attached_agents: "No agents attached yet.",
    detach_agent: "Detach agent",
    chat_workspaces: "Workspace",
    chat_workspaces_attached_hint:
      "This chat is attached to {{names}} and can use all files there.",
    access_storage: "Access storage",
    access_storage_hint:
      "The model may read the files of this chat and of its attached workspaces. It may always write in this chat; an attached workspace has its own switch below.",
    access_storage_off_hint:
      "The model gets no file tools. Attachments are still included in the message where their text can be read.",
    workspace_write_access_hint:
      "Let the model change files in the attached workspaces.",
    settings_title: "Local agent",
    attach_from_workspace: "Attach from workspace",
    attach_from_workspace_hint:
      "Pick a file from an attached workspace and add it to this message.",
    attach_from_workspace_loading: "Loading files…",
    sidebar_title: "Workspaces",
    new_workspace: "New workspace",
    empty_sidebar_title: "Create a workspace",
    create_title: "Create workspace",
    name_label: "Workspace name",
    name_placeholder: "e.g. Research",
    create_workspace: "Create workspace",
    apply_changes: "Apply Changes",
    apply_applying: "Saving…",
    create_tree_title: "Workspace",
    create_add: "Add to workspace",
    create_empty_hint:
      "Nothing added yet — pick a folder or a repository on the left.",
    create_sources_hint:
      "Pick a folder or clone a repository — it appears in the workspace.",
    name_required: "Enter a workspace name",
    name_prompt: "Select a name for your workspace",
    name_taken: "A workspace with this name already exists",
    create_error: "Could not create the workspace",
    update_error: "Could not save the workspace",
    not_found: "Workspace not found",
    files_title: "Workspace files",
    detach: "Detach",
    detach_hint: "Detach this folder from the workspace",
    detach_mount_only:
      "Only a folder mounted into this workspace can be detached",
    kind: "Workspace",
    chat_count_one: "{{count}} chat",
    chat_count_other: "{{count}} chats",
    empty_title: "No chats in this workspace yet",
    empty_body: "Write a prompt below to start the first chat here.",
    composer_placeholder: "Ask anything — starts a new chat in {{name}}",
    files_tab: "Files",
    preview_tab: "Preview",
    storage_browser_private: "Private to this workspace",
    repositories: "Repositories",
    repositories_count_one: "{{count}} repository",
    repositories_count_other: "{{count}} repositories",
    storage_mcp_servers: "MCP servers",
    connect_mcp: "Connect MCP server",
    clone_repository: "Clone repository",
    mcp_transport_streamable_http: "Streamable HTTP",
    mcp_transport_sse: "SSE",
    delete_workspace: "Delete Workspace",
    delete_confirm:
      "Delete this workspace? Its source list and transfer history are removed. Device files stay on this device; Arcana files stay in their collection.",
    delete_error: "Could not delete the workspace",
    sources: "Sources",
    source_browser: {
      title: "Storage locations",
      source_broken: "{{name}} is not working right now.",
      source_needs_permission:
        "{{name}} has lost access permission — open it and allow access again.",
      source_unreachable:
        "{{name}} could not be reached — the service is not answering right now.",
      source_error_detail: "{{name}} could not be opened: {{detail}}",
      device: "Your Device",
      chats: "Browser",
      arcanas: "Arcanas",
      mcp: "MCP",
      saia_fs: "SAIA Files",
      saia_hint: "Your SAIA account folder",
      add_to_workspace: "Add to Workspace",
      add_to_workspace_count: "Add to Workspace ({{count}})",
      unmount: "Unmount",
      unmount_count: "Unmount ({{count}})",
      unmount_hint:
        "Remove this folder from Chat AI entirely — every workspace stops using it and it leaves this list. You can add it again at any time.",
      selected_one: "{{count}} selected",
      selected_many: "{{count}} selected",
      empty: "Nothing here yet",
      add_current_folder: "Add this folder to the workspace",
      add_current_dir: "Add current dir to workspace",
      empty_folder_hint:
        "The folder is empty now, but it stays linked: files you create or upload here later appear in it.",
      loading: "Loading...",
      unavailable: "This source is unavailable.",
      back: "Back",
      select_all: "Select all",
      clear: "Clear",
      add_device_folder: "Add folder from this device",
      device_empty_title: "There's nothing here yet.",
      device_empty_body:
        "Drag and drop a folder here, or click to mount one from this device.",
      device_drop_rejected:
        "That drop did not carry a folder. Click to mount a folder from this device.",
      in_workspace: "In workspace",
      untitled_chat: "Untitled chat",
      pick_source: "Pick a source on the left to browse its files.",
      added: "Added {{count}} items",
      added_one: "Added {{count}} item",
      added_other: "Added {{count}} items",
      add_failed: "{{count}} items failed",
      add_failed_one: "{{count}} item failed",
      add_failed_other: "{{count}} items failed",
      adding_progress: "Adding {{done}} of {{total}}…",
      folders_one: "{{count}} folder",
      folders_other: "{{count}} folders",
      chats_count_one: "{{count}} chat",
      chats_count_other: "{{count}} chats",
      collections_one: "{{count}} collection",
      collections_other: "{{count}} collections",
      servers_one: "{{count}} server",
      servers_other: "{{count}} servers",
      usage: "{{used}} of {{quota}} used",
      chat_usage: "{{used}} of {{quota}} used — shared with this app",
    },
    storage_badge_browser: "browser",
    storage_badge_device: "device",
    storage_badge_arcana: "arcana",
    storage_badge_mcp: "MCP",
    storage_badge_agent: "agent",
    storage_badge_saia: "SAIA",
    add_source: "Add source",
    source_kind: "Source type",
    choose_folder: "Choose folder…",
    no_sources: "Add a local folder, a Git repository, or an MCP server.",
    select_source: "Select a source to browse its files.",
    source_label: "Label",
    source_folder: "Folder",
    choose_folder_required: "Choose a folder first.",
    no_folder_chosen: "No folder chosen yet.",
    source_browser_label: "Browser storage",
    kind_browser: "Browser",
    kind_local: "Local folder",
    kind_agent: "Agent filesystem",
    kind_chat: "Chat folder",
    kind_arcana: "Arcana",
    "kind_arcana-filesystem": "Arcana filesystem",
    kind_mcp: "MCP",
    "kind_saia-fs": "SAIA filesystem",
    local_hint:
      "The browser asks for access to the folder. The folder stays on this device and is never uploaded.",
    local_unsupported: "This browser cannot open local folders.",
    local_insecure:
      "Opening local folders needs a secure page: use https:// or http://localhost.",
    local_aborted:
      "No folder was taken over. If no dialog appeared, Chrome blocked the folder dialog or the system file dialog could not open. Check the site permission for editing files and use a normal project folder, not your whole home or downloads folder.",
    mcp_endpoint: "MCP endpoint",
    mcp_transport: "Transport",
    mcp_allowlist: "Tool allowlist (comma separated, optional)",
    mcp_hint:
      "Use an MCP server with streamable-HTTP or SSE transport and CORS headers. Only file tools it advertises are used.",
    mcp_required: "Enter an MCP endpoint",
    device_only_hint: "This source is available on this device only.",
    device_only: "This device only",
    unavailable_on_device: "Unavailable on this device",
    reconnect: "Reconnect folder",
    status_error: "Error",
    root: "Root",
    retry: "Retry",
    refresh: "Refresh",
    empty_folder: "This folder is empty.",
    folder_open_failed: "Could not open “{{name}}”",
    drop_hint: "Drop files here to copy them into this source.",
    load_more: "Load more",
    select_all: "Select all",
    clear_selection: "Clear selection",
    selected_count_one: "{{count}} item selected",
    selected_count_other: "{{count}} items selected",
    download: "Download",
    downloading: "Saving files…",
    preview_too_large: "This file is too large to preview.",
    preview_unavailable: "No preview is available for this file type.",
    remove_source: "Remove source",
    remove_source_confirm:
      "Remove this source from the workspace? Files themselves are not deleted.",
    transfer_title: "Transfer files",
    transfer_summary:
      "{{strategy}} {{count}} item(s) ({{size}}) from {{from}} to {{to}}?",
    transfer_move_note:
      "The original is deleted only after the copy is verified.",
    transfer_copy_note: "The original stays in the source.",
    transfer_move: "Move",
    transfer_copy: "Copy",
    move_to: "Move to…",
    move_selection_hint_one:
      "Move the selected item to another source? The original is deleted only after the copy is verified.",
    move_selection_hint_other:
      "Move the {{count}} selected items to another source? The original is deleted only after the copy is verified.",
    delete_file_confirm: "Delete this file? This cannot be undone.",
    delete_folder_confirm:
      "Delete this folder and everything inside it? This cannot be undone.",
    delete_selection_confirm_one:
      "Delete the selected item? This cannot be undone.",
    delete_selection_confirm_other:
      "Delete the {{count}} selected items? This cannot be undone.",
    delete_success: "Deleted {{name}}.",
    delete_selection_success_one: "Deleted {{count}} item.",
    delete_selection_success_other: "Deleted {{count}} items.",
    move_to_hint: "Move “{{name}}” to another source? The original is deleted only after the copy is verified.",
    move_to_target: "Destination source",
    move_to_no_targets: "Add another source first.",
    transferring: "Transferring…",
    transfer_success_one: "Transferred {{count}} item.",
    transfer_success_other: "Transferred {{count}} items.",
    transfer_blocked: "This transfer cannot be started.",
    transfer_conflict: "“{{name}}” already exists at the destination.",
    transfer_conflict_many:
      "{{count}} items already exist at the destination.",
    transfer_multiple_sources: "several sources",
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
  file_preview: {
    no_file: "No file to preview",
    no_data: "No data available",
    no_content: "No content available",
    unsupported: "Unsupported file type",
    error: "Error: {{message}}",
    error_display: "Error displaying content: {{message}}",
    csv_parse_failed: "Failed to parse CSV content",
    image_failed: "Failed to load image",
    video_failed: "Failed to load video",
    video_unsupported: "Your browser does not support the video tag.",
    html_mode: "HTML rendering",
    html_strict: "Strict",
    html_relaxed: "Relaxed",
    html_relaxed_hint:
      "Strict only shows the page; relaxed also runs its scripts. Network access follows the \"Load external references\" preference, as in rendered HTML blocks.",
    html_relaxed_warning:
      "This page can run scripts and load external resources.",
    pdf_failed: "Failed to display PDF",
    pdf_mobile_title: "PDF preview is not available on mobile devices",
    pdf_mobile_hint: "Please use a desktop browser to preview PDF files",
    pdf_original_title: "Original PDF Preview",
    pdf_original_hint: "This PDF hasn't been processed yet. Click \"Process\" to extract text content.",
    pdf_missing_title: "PDF content not available",
    pdf_missing_hint: "The original PDF file data is not available for preview",
    docx_failed: "Failed to display Word document",
    describe_image: "Describe image",
    describe_unavailable: "No vision model is available for this deployment",
    describe_byline: "Automatically described with {{model}}",
    describe_opened: "Opened {{name}}",
    describe_saved: "Saved {{name}}",
    describe_downloaded: "Downloaded {{name}}",
    describe_failed: "Could not describe the image: {{message}}",
    save: "Save to device",
    save_failed: "Failed to download file",
    download_aria: "Download file",
    close_aria: "Close",
  },
  typst: {
    rendering: "Rendering Typst document...",
    render_error:
      "Failed to render Typst document. Showing source instead:",
  },
  latex: {
    download_failed: "Failed to download the LaTeX document.",
    rendering: "Rendering LaTeX document...",
    render_error:
      "Failed to render LaTeX document. Showing source instead:",
  },
  wasm_download: {
    title: "Download {{feature}} renderer?",
    body: "Rendering this block downloads WebAssembly and fonts the first time. They stay in your browser cache afterwards.",
    size: "About {{size}} MB",
    confirm: "Download and render",
    keep_code: "Keep as code",
    feature_typst: "Typst",
    feature_latex: "LaTeX",
    feature_tikz: "TikZ",
    feature_graphviz: "Graphviz",
  },
  graphviz: {
    rendering: "Rendering Graphviz diagram...",
    render_error: "Failed to render Graphviz diagram.",
  },
  vega: {
    rendering: "Rendering chart...",
    render_error: "Failed to render Vega-Lite chart.",
    external_blocked: "This chart loads external data from {{url}}. Enable external references to render it.",
  },
  chartjs: {
    rendering: "Rendering chart...",
    render_error: "Failed to render Chart.js chart.",
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
  // Theme selector (footer): light/dark plus any extra brand themes
  theme: {
    label: "Switch theme",
    light: "Light",
    dark: "Dark",
    brand_themes: "Brand themes",
  },
  // Brand consent gate and its later settings section
  consent: {
    terms_checkbox: "I have read the terms of use.",
    terms_required: "Please accept the terms of use to continue.",
    continue: "Continue",
    back: "Back",
    save: "Save and continue",
    settings_title: "Your consents",
    settings_intro:
      "Participation is voluntary. You can change these choices at any time.",
    accepted_on: "Accepted on {{date}}.",
    not_accepted_yet: "Not accepted yet on this device.",
  },
  // Dev-only preview at /dev/tool-form
  tool_form_demo: {
    title: "Tool form test",
    description:
      "Development-only preview of the form that tool results render in a chat. Submitting shows the values here instead of sending a message.",
    submitted: "Submitted values",
  },

  // Footer: language picker, PWA install, bug report
  language: {
    label: "Language",
    automatic: "Automatic (browser language)",
    auto_short: "Auto",
    english: "English",
    german: "German",
  },
  pwa: {
    install: "Install this app",
  },
  // Brand-owned information pages (/about, /accessibility) and the sitemap
  info: {
    back_to_chat: "Back to chat",
    page_external: "This page is provided by the institution behind this app.",
    open_page: "Open the page",
  },
  about: {
    title: "About",
  },
  accessibility: {
    title: "Accessibility",
  },
  sitemap: {
    title: "Sitemap",
    general: "General",
    pages: "Information",
  },
  bug_report: {
    title: "Report a problem",
    intro:
      "Describe what happened. The report goes to the operators of this service, together with the page address and your browser version.",
    type_label: "Type",
    type_bug: "Bug",
    type_feedback: "Feedback",
    type_accessibility: "Accessibility",
    type_other: "Other",
    message_label: "Description",
    message_placeholder:
      "What did you do, what did you expect, and what happened instead?",
    screenshot_label: "Screenshots (optional)",
    screenshot_hint: "Up to {{count}} files, {{size}} each (PNG, JPEG or WebP).",
    email_label: "Contact address (optional)",
    email_placeholder: "you@example.org",
    diagnostics_label: "Diagnostics that will be sent",
    unavailable:
      "This deployment has no feedback receiver, so the report cannot be sent. You can copy it and pass it on to the operator instead.",
    copy: "Copy report",
    copied: "Copied",
    sent: "Thank you — the report was sent.",
    success: "Report sent.",
    sending: "Sending…",
    submit: "Send report",
    error_type: "Only PNG, JPEG and WebP images can be attached.",
    error_size: "Each screenshot may be at most {{size}}.",
    error_count: "You can attach at most {{count}} screenshots.",
    error_description: "Please describe the problem.",
    error_rejected:
      "The report was rejected. Please shorten it or remove an attachment.",
    error_failed: "The report could not be sent. Please try again later.",
  },
};
