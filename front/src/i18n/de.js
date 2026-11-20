export default {
  errors: {
    app_title: "Etwas ist schiefgelaufen",
    app_message:
      "Die Oberfläche konnte nicht gerendert werden. Ihre gespeicherten Chats bleiben in diesem Browser, solange Sie keine Websitedaten löschen. Laden Sie die Seite neu.",
    database_title: "Lokale Datenbank nicht verfügbar",
    database_version:
      "Dieser Browser enthält eine neuere lokale Datenbankversion, als diese App unterstützt. Öffnen Sie die passende App-Version oder einen neueren Build. Löschen Sie keine Websitedaten.",
    database_blocked:
      "Ein anderer Chat-AI-Tab blockiert die lokale Datenbank. Schließen Sie die anderen Tabs und laden Sie neu.",
    database_quota:
      "Der Browserspeicher ist voll oder nicht verfügbar. Exportieren Sie eine Sicherung, schaffen Sie Speicherplatz und laden Sie neu.",
    database_generic:
      "Die lokale Datenbank konnte nicht geöffnet werden. Ihre Daten sind möglicherweise noch vorhanden. Laden Sie neu oder schließen Sie andere Chat-AI-Tabs.",
    reload: "Neu laden",
  },
  // Common phrases
  common: {
    loading: "Lädt...",
    back: "Zurück",
    undo: "Rückgängig",
    scroll: "Nach unten scrollen",
    scroll_to_top: "Nach oben scrollen",
    scroll_to_message: "Zum Anfang der Nachricht springen",
    next_message: "Zur nächsten Nachricht scrollen",
    previous_message: "Zur vorherigen Nachricht scrollen",
    rename: "Umbenennen",
    edit: "Bearbeiten",
    create: "Erstellen",
    save: "Speichern",
    import: "Chat importieren",
    export: "Chat exportieren",
    summarize: "Zusammenfassen",
    summarizing: "Zusammenfassen...",
    received_words_one: "{{count}} Wort empfangen…",
    received_words_other: "{{count}} Wörter empfangen…",
    reasoning_words_one: "Das Modell überlegt — {{count}} Wort empfangen…",
    reasoning_words_other: "Das Modell überlegt — {{count}} Wörter empfangen…",
    elapsed_seconds: "{{count}} s",
    created: "Erstellt {{date}}",
    modified: "Geändert {{date}}",
    summarize_success: "Zusammenfassung in einer neuen Unterhaltung erstellt.",
    summary_title: "Zusammenfassung von {{title}}",
    summarize_error: "Zusammenfassung fehlgeschlagen. Ihre Unterhaltung ist unverändert.",
    clear: "Löschen",
    abort: "Abbrechen",
    send: "Senden",
    send_shortcut: "Senden (Enter)",
    send_shortcut_shift_enter: "Senden (Umschalt+Enter)",
    share: "Teilen",
    delete: "Löschen",
    cancel: "Abbrechen",
    close: "Schließen",
    allow: "Erlauben",
    disallow: "Nicht erlauben",
    refresh: "Aktualisieren",
    notice: "Hinweis",
    disclaimer: "Haftungsausschluss",
    understand: "Ich verstehe",
    ok: "OK",
    record_start: "Aufnehmen (klicken/halten)",
    record_stop: "Stopp (klicken/loslassen)",
    dont_show_again: "Nicht mehr anzeigen",
    regenerate: "Antwort neu generieren",
    fork: "In neuem Chat fortfahren",
    backup_data: "Daten sichern",
    skip_backup: "Backup überspringen",
    upgrade_chat_ai: "Chat AI aktualisieren",
  },
  feedback:{
    thumbsup:"The response is good.",
    thumbsdown: "The response is not so good.",
    send: "Send a detailed feedback describing your observation."
  },
  // Sidebar
  sidebar: {
    new_conversation: "Neuer Chat",
    import_persona: "Mit Persona chatten",
    expand: "Ausklappen",
    extend: "Ausklappen",
    open_sidebar: "Seitenleiste öffnen",
    close_sidebar: "Seitenleiste schließen",
    rename_tooltip: "Umbenennen: {{title}}",
    shortcut_new_conversation: "Strg + Shift + O",
    user_section: "Benutzer",
  },
  folders: {
    title: "Chats",
    all: "Alle Chats",
    uncategorized: "Nicht zugeordnete Chats",
    by_date: "Alle Chats nach Datum",
    by_created: "Alle Chats nach Erstellungsdatum",
    by_size: "Alle Chats nach Speichergröße",
    sort_label: "Chats sortieren",
    sort_by_topic: "Nach Thema",
    sort_by_date: "Nach Datum",
    sort_by_created: "Nach Erstellungsdatum",
    sort_by_size: "Nach Speichergröße",
    modified: "Geändert {{date}}",
    storage_size: "Browserspeicher {{size}}",
    dateBuckets: {
      today: "Heute",
      yesterday: "Gestern",
      lastWeek: "Letzte Woche",
      lastMonth: "Letzter Monat",
      older: "Älter",
    },
    create_button: "Neues Thema",
    expand_topic: "Thema ausklappen",
    collapse_topic: "Thema einklappen",
    expand_all_topics: "Alle Themen ausklappen",
    collapse_all_topics: "Alle Themen einklappen",
    empty_topic: "Ziehen Sie einen Chat hierher.",
    search_label: "Suche",
    search_action: "Chats durchsuchen",
    search_placeholder: "nach Titel durchsuchen",
    search_no_results: 'Keine Treffer für "{{query}}"',
    clear_search: "Suche löschen",
    create_title: "Thema erstellen",
    edit_title: "Thema bearbeiten",
    delete_title: "Thema löschen",
    topic_options: "Thema-Optionen",
    pinned: "Angeheftet",
    pin_action: "Chat anheften",
    unpin_action: "Nicht mehr anheften",
    pin_topic_action: "Thema anheften",
    unpin_topic_action: "Thema nicht mehr anheften",
    delete_description:
      'Thema "{{name}}" löschen? Chats bleiben erhalten und erscheinen unter "Nicht zugeordnete Chats".',
    name_label: "Themenname",
    name_placeholder: "Themenname eingeben",
    error_required: "Bitte einen Themennamen eingeben.",
    create_blurb: "Fassen Sie zusammengehörige Chats in einem Thema zusammen. Konfigurieren Sie den Namen, die Farbe und das Symbol des Themas.",
    blurb_examples: "Beispiele",
    suggestion_homework: "Hausaufgaben",
    suggestion_writing: "Schreiben",
    suggestion_health: "Gesundheit",
    suggestion_research: "Forschung",
    creating: "Wird erstellt…",
    done: "Fertig",
    choose_color: "Farbe wählen",
    choose_icon: "Symbol wählen",
    error_generic: "Aktion konnte nicht ausgeführt werden. Bitte erneut versuchen.",
    move_title: "Zu Thema verschieben",
    move_description: 'Thema für "{{title}}" auswählen',
    move_action: "Verschieben",
    new_folder_prompt: "Neues Thema anlegen",
    create_inline: "Erstellen",
  },
  topic_view: {
    chat_count_one: "{{count}} Chat",
    chat_count_other: "{{count}} Chats",
    empty_title: "Noch keine Chats in diesem Thema",
    empty_body:
      "Schreiben Sie unten eine Eingabe, um den ersten Chat hier zu starten.",
    composer_placeholder: "Fragen Sie etwas — startet einen neuen Chat in {{name}}",
    create_error:
      "Neuer Chat konnte nicht gestartet werden. Bitte erneut versuchen.",
    missing_topic: "Dieses Thema existiert nicht mehr",
    missing_topic_body:
      "Es wurde möglicherweise gelöscht. Wählen Sie ein anderes Thema in der Seitenleiste.",
    back_to_chats: "Zurück zu den Chats",
    loading: "Thema wird geladen…",
  },
  sorter: {
    button: "Smart Sort",
    title: "Smart Sort",
    intro:
      "Prüfen Sie die Vorschläge unten. Änderungen werden erst beim Anwenden übernommen.",
    ai_model_note:
      "Chat-Titel, vorhandene Zusammenfassungen und bestehende Themennamen werden vom Standard-ChatAI-Modell analysiert.",
    ai_analyzing: "Ihre Chats werden mit {{model}} analysiert…",
    ai_error:
      "Das Modell konnte Ihre Chats nicht analysieren. Es werden keine Änderungen angezeigt.",
    ai_retry: "Modell erneut versuchen",
    ai_limited:
      "Die {{analyzed}} neuesten von {{total}} Chats wurden analysiert. Ältere Chats bleiben unverändert.",
    ai_default_model: "das Standardmodell",
    assessment_title: "Einschätzung des Modells",
    preview_title: "Vorgeschlagene Struktur",
    include_topic_rename: "Themenumbenennung übernehmen",
    include_title_change: "Titeländerung übernehmen",
    new_topic: "Neues Thema",
    existing_topic: "Bestehendes Thema",
    no_changes: "Keine Themenänderungen vorgeschlagen.",
    select_all_moves: "Alle auswählen",
    deselect_all_moves: "Alle abwählen",
    deletions_title: "Vorgeschlagene Löschungen",
    deletions_hint:
      "Vom Modell vorgeschlagene Löschungen werden hier angezeigt. Sie sind standardmäßig nicht ausgewählt.",
    no_deletions: "Keine Löschungen vorgeschlagen.",
    reason_empty: "Leerer Chat",
    reason_duplicate: 'Duplikat von "{{title}}"',
    reason_duplicate_generic: "Doppelter Chat",
    select_all_deletions: "Alle Löschungen auswählen",
    deselect_all_deletions: "Alle Löschungen abwählen",
    summary_moves: "{{count}} Verschiebungen",
    summary_new_topics: "{{count}} neue Themen",
    summary_titles: "{{count}} Titeländerungen",
    summary_topic_renames: "{{count}} Themenumbenennungen",
    summary_deletions: "{{count}} Löschungen",
    apply: "Änderungen anwenden",
    applying: "Wird angewendet…",
    error_name: "Bitte geben Sie jedem neuen Thema einen Namen.",
    error_generic:
      "Die Änderungen konnten nicht angewendet werden. Bitte erneut versuchen.",
    success: "Chats wurden neu organisiert.",
    categories: {
      code: "Programmierung",
      writing: "Schreiben",
      research: "Forschung",
      data: "Daten & Analyse",
      planning: "Planung",
      learning: "Lernen",
      health: "Gesundheit",
      travel: "Reisen",
      finance: "Finanzen",
      creative: "Kreatives Arbeiten",
    },
  },
  meta_chat: {
    name: "Chatty",
    title: "Meta-Chat",
    prompt_placeholder: "Frag den Meta-Chat!",
    open: "Metachat: Chats durchsuchen",
    help_label: "Hilfe/Meta-Assistent Chatty",
    help_tooltip:
      "Öffnet den Metachat: Fragen Sie nach Ihren Chats, Themen, Einstellungen und Erinnerungen oder lassen Sie sich Funktionen von Chat AI Schritt für Schritt erklären. Vorgeschlagene Änderungen werden erst nach Ihrer Bestätigung übernommen.",
    last_checked: "Zuletzt geprüft: {{date}}",
    changes_title: "Was ist neu",
    files_tab: "Arbeitsbereich",
    sessions_tab: "Sitzungen",
    agents_tab: "Agenten",
    sessions_empty: "Noch keine Chats in diesem Arbeitsbereich.",
    collapse_changes: "Was ist neu einklappen",
    expand_changes: "Was ist neu ausklappen",
    resize_changes: "Breite von Was ist neu ändern",
    check_now: "Jetzt prüfen",
    changes_empty: "Noch keine Prüfung. Klicken Sie auf „Jetzt prüfen“, um Chats, Agenten, MCP-Server und neue Agentendateien zu prüfen.",
    banner_description: "Metachat kann Ihnen auf zwei Arten helfen:",
    purposes: {
      tutor: "Die Funktionen von Chat AI kennenlernen",
      tutor_example: "„Wie finde ich ein Tutorial oder prüfe meine Einstellungen?“",
      find: "Bisherige Chats und Themen finden",
      find_example: "„Wo ist mein Chat über meine Essensbestellung?“",
    },
    clear_chat: "Chat leeren",
    proposed_changes: "Vorgeschlagene Änderungen",
    mutation_warning:
      "Diese Änderungen bearbeiten Ihre Chats, Einstellungen oder Erinnerungen. Prüfen Sie sie vor dem Übernehmen.",
    accept_changes: "Änderungen übernehmen",
    applying_changes: "Wird übernommen…",
    applied_not_reversible: "Angewendet – diese Aktion kann nicht rückgängig gemacht werden.",
    changes_applied: "Änderungen übernommen",
    revert_changes: "Änderungen zurücksetzen",
    reverting: "Wird zurückgesetzt…",
    changes_reverted: "Änderungen zurückgesetzt",
    revert_mismatch:
      "Ein Zurücksetzen ist nicht möglich, weil der aktuelle Zustand nicht mehr der übernommenen Änderung entspricht.",
    apply_failed: "Die Änderungen konnten nicht übernommen werden.",
    rename_summary: "„{{from}}“ in „{{to}}“ umbenennen",
    move_summary: "„{{title}}“ nach „{{topic}}“ verschieben",
    pin_summary: "„{{title}}“ anheften",
    unpin_summary: "„{{title}}“ nicht mehr anheften",
    pin_topic_summary: "Thema „{{topic}}“ anheften",
    unpin_topic_summary: "Thema „{{topic}}“ nicht mehr anheften",
    pin_workspace_summary: "Arbeitsbereich „{{workspace}}“ anheften",
    unpin_workspace_summary: "Arbeitsbereich „{{workspace}}“ nicht mehr anheften",
    pin_agent_summary: "Agenten „{{agent}}“ anheften",
    unpin_agent_summary: "Agenten „{{agent}}“ nicht mehr anheften",
    setting_summary: "{{setting}} von „{{from}}“ auf „{{to}}“ ändern",
    setting_temperature: "Temperatur",
    setting_top_p: "Top-p",
    conversation_setting_all_summary:
      "{{setting}} für alle Chats auf „{{value}}“ setzen",
    conversation_setting_summary:
      "{{setting}} in „{{title}}“ auf „{{value}}“ setzen",
    create_chat_summary: "Chat „{{title}}“ mit {{count}} Anfangsnachrichten erstellen",
    mcp_target_all: "alle Chats",
    mcp_target_global: "die MCP-Serverliste",
    agent_prompt_summary:
      "{{chars}} Zeichen an Agenten {{agent}} senden: „{{preview}}“",
    agent_prompt_text_label: "Prompt-Text",
    agent_prompt_meta: "Agent {{agent}} · {{chars}} Zeichen",
    agent_prompt_notice:
      "Dieser Text wird unverändert an den Agenten gesendet, der Befehle auf seinem Rechner ausführen kann.",
    agent_interrupt_summary: "Agenten {{agent}} unterbrechen",
    agent_session_create_summary: "Neue Sitzung für Agenten {{agent}} erstellen",
    agent_session_switch_summary: "Zu Sitzung {{session}} von Agent {{agent}} wechseln",
    agent_session_delete_summary: "Sitzung {{session}} vom Agenten {{agent}} entfernen",
    workspace_attach_summary: "Arbeitsbereich {{workspace}} mit {{target}} verknüpfen",
    workspace_detach_summary: "Arbeitsbereich {{workspace}} von {{target}} trennen",
    mcp_add_local_summary:
      "Lokalen MCP-Server {{name}} zu {{target}} hinzufügen",
    mcp_add_remote_summary:
      "Entfernten MCP-Server {{name}} zu {{target}} hinzufügen",
    mcp_remove_local_summary:
      "Lokalen MCP-Server {{name}} aus {{target}} entfernen",
    mcp_remove_remote_summary:
      "Entfernten MCP-Server {{name}} aus {{target}} entfernen",
    mcp_update_local_summary:
      "Lokalen MCP-Server {{name}} in {{target}} aktualisieren",
    mcp_update_remote_summary:
      "Entfernten MCP-Server {{name}} in {{target}} aktualisieren",
    add_memory_summary: "Erinnerung „{{text}}“ hinzufügen",
    add_memory_group_summary: "Erinnerung „{{text}}“ zur Gruppe „{{group}}“ hinzufügen",
    update_memory_summary: "Erinnerung „{{from}}“ in „{{to}}“ ändern",
    update_memory_group_summary: "Erinnerung „{{from}}“ in „{{to}}“ in Gruppe „{{group}}“ ändern",
    delete_memory_summary: "Erinnerung „{{text}}“ löschen",
    clear_memories_summary: "Alle gespeicherten Erinnerungen löschen",
    e2ee_assign_summary: "Modell {{model}} mit Schlüssel „{{key}}“ verschlüsseln",
    e2ee_clear_summary: "Verschlüsselung für Modell {{model}} beenden",
    memory_item: "Erinnerung {{index}}",
    setting_on: "an",
    setting_off: "aus",
    setting_device_default: "Gerätestandard",
    unsorted_topic: "Nicht zugeordnet",
    error: "Antwort fehlgeschlagen. Bitte versuchen Sie es erneut.",
    no_model: "Kein Standardmodell konfiguriert.",
  },
  e2ee: {
    badge: "Ende-zu-Ende verschlüsselt",
    description:
      "Ein gebundener Schlüssel ergänzt eine zweite Verschlüsselungsebene über der Transportverschlüsselung, die jede Anfrage ohnehin schützt: Ihre Nachricht wird in diesem Browser versiegelt und bleibt Geheimtext bis zu der Maschine, die das Modell ausführt, in der Regel eine GPU. Schlüssel werden außerhalb des Kanals verteilt, importieren Sie sie deshalb nur aus einer vertrauenswürdigen Quelle.",
    keys_title: "Verschlüsselungsschlüssel",
    no_keys: "Noch keine Schlüssel. Fügen Sie oben einen hinzu.",
    invalid_key: "Kein gültiger 32-Byte-X25519-Public-Key",
    download: "Public Key herunterladen",
    remove: "Entfernen",
    remove_confirm: "Diesen Schlüssel und seine Modellzuordnungen entfernen?",
    removed: "Schlüssel entfernt",
    clear_all: "Alle Schlüssel entfernen",
    clear_all_confirm: "Jeden Schlüssel und jede Modellzuordnung entfernen?",
    clear_all_done: "Alle Verschlüsselungsschlüssel entfernt",
    test: "Testen",
    test_all: "Alle testen",
    test_ok: "Schlüssel funktioniert: {{count}} Modell(e) haben die versiegelte Testanfrage beantwortet.",
    test_failed: "Keine versiegelte Antwort von {{models}} ({{reason}}).",
    test_no_models: "Ordnen Sie den Schlüssel zuerst einem Modell zu",
    test_no_bindings:
      "Kein Schlüssel ist einem Modell zugeordnet, es gibt nichts zu testen.",
    test_all_done: "{{working}} von {{tested}} getesteten Schlüsseln funktionieren.",
    test_failed_keys: "Fehlerhaft: {{keys}}",
    status_working: "Funktioniert",
    status_working_hint:
      "Die letzte versiegelte Testanfrage war für {{count}} Modell(e) erfolgreich",
    status_failed: "Test fehlgeschlagen",
    status_failed_hint:
      "Die letzte versiegelte Testanfrage war für kein gebundenes Modell erfolgreich",
    status_untested: "Nicht getestet",
    status_untested_hint:
      "Der Schlüssel ist wohlgeformt, wurde aber noch nicht gegen ein Modell getestet",
    verifying: "Schlüssel wird getestet…",
    verified_added: "Schlüssel getestet und {{count}} Modell(en) zugeordnet",
    added_unverified:
      "Schlüssel ohne Test hinzugefügt. Geben Sie mindestens ein bekanntes Modell an, damit er geprüft werden kann.",
    add_keys_title: "Verschlüsselungsschlüssel hinzufügen",
    add_keys_description:
      "Jeder Schlüssel wird vor dem Speichern mit einer versiegelten Anfrage je Modell getestet. Modelle, deren Test scheitert, bleiben unverschlüsselt.",
    verify_failed_all:
      "Der Schlüssel wurde nicht hinzugefügt: Die Testanfrage für {{model}} ist fehlgeschlagen ({{reason}}).",
    verify_failed_models:
      "Nicht verschlüsselt, weil der Test für {{models}} fehlgeschlagen ist ({{reason}}).",
    no_models_matched:
      "Keines davon ist ein bekanntes Modell: {{models}}. Der Schlüssel wurde nicht hinzugefügt.",
    import_method: "Schlüssel hinzufügen",
    modes: {
      published: "Veröffentlichte Schlüssel",
      paste: "Einfügen oder Datei",
      url: "Aus URL",
      directory: "Schlüsselverzeichnis",
    },
    published_url: "Basis-URL der Schlüssel",
    published_hint:
      "Verwenden Sie nur eine Schlüssel-URL, der Sie vertrauen. Jeder heruntergeladene Schlüssel wird vor dem Speichern gegen sein Modell getestet.",
    published_load: "Schlüssel für alle Modelle laden",
    published_loading: "Schlüssel werden geladen …",
    published_url_required: "Geben Sie die URL des Schlüsselverzeichnisses an.",
    published_progress_fetch: "Schlüssel werden geladen … {{done}}/{{total}}",
    published_progress_verify: "Schlüssel werden geprüft … {{done}}/{{total}}",
    published_imported: "{{count}} geprüfte Schlüssel importiert",
    published_none:
      "Kein Schlüssel hat die Prüfung bestanden. Prüfen Sie die Basis-URL und ob die Modelle einen E2EE-Knoten haben.",
    published_none_needed:
      "Jedes Modell hat bereits einen nutzbaren Schlüssel.",
    published_summary:
      "{{imported}} importiert · {{missing}} ohne veröffentlichten Schlüssel · {{failed}} fehlgeschlagen",
    published_failed_title: "Nicht importiert:",
    published_more: "und {{count}} weitere",
    models_field: "Gilt für Modelle",
    models_field_placeholder: "qwen3-235b-a22b, Mistral Large",
    models_field_hint:
      "Kommagetrennte Modell-IDs oder -Namen; eine Brücken-Variante mit „(External)“ ist ein eigenes Modell. Unbekannte Einträge werden übersprungen.",
    unknown_models:
      "Schlüssel hinzugefügt, aber diese Modelle sind unbekannt: {{models}}",
    fallback_name: "Schlüssel {{fingerprint}}",
    public_key: "Public Key",
    public_key_placeholder: "Base64url-X25519-Public-Key",
    add_key: "Schlüssel hinzufügen",
    choose_file: ".pub-Datei wählen…",
    key_url: "Schlüssel-URL",
    fetch_key: "Schlüssel laden",
    directory_url: "Verzeichnis-URL",
    import_directory: "Verzeichnis importieren",
    directory_imported: "{{count}} Schlüssel importiert",
    directory_hint:
      "Ein Dokument mit allen Schlüsseln und ihren Modellzuordnungen. Jeder Schlüssel wird weiterhin vor dem Speichern getestet.",
    choose_folder: "Schlüsselordner wählen…",
    folder_hint:
      "Liest alle .pub-Dateien in einem lokalen Ordner. Dateien, die keine gültigen Public Keys sind, werden gemeldet und übersprungen.",
    folder_imported: "{{count}} Schlüssel importiert, {{bound}} Modelle gebunden",
    folder_partial:
      "{{count}} Schlüssel importiert ({{bound}} Modelle). {{skipped}} Datei(en) übersprungen: {{files}}",
    folder_empty: "Keine .pub-Dateien in diesem Ordner.",
    folder_no_valid: "Kein gültiger Public Key in diesem Ordner ({{count}} Datei(en) abgelehnt).",
    folder_unsupported:
      "Dieser Browser kann hier keinen Ordner öffnen. Nutze stattdessen die Verzeichnis-URL oder öffne die App über HTTPS bzw. localhost.",
    folder_error: "Der Ordner konnte nicht gelesen werden: {{reason}}",
    import_error: "Der Schlüssel konnte nicht importiert werden.",
    models_title: "Unverschlüsselte Modelle",
    models_keyed: "{{count}} verschlüsselt",
    models_description:
      "Diese Modelle werden von einer internen Funktion verwendet und haben keinen funktionierenden Schlüssel, ihre Anfragen erhalten also nur die Transportverschlüsselung.",
    models_empty:
      "Kein von einer internen Funktion verwendetes Modell ist ohne Schlüssel.",
    used_for: "Verwendet für",
    features: {
      titles: "Titel",
      memory: "Gedächtnis",
      proposals: "Vorschläge",
      summaries: "Zusammenfassungen",
      image_analysis: "Bildanalyse",
    },
    models_blocked: "Schlüssel fehlt oder ist ungültig",
    not_encrypted: "Nicht verschlüsselt",
    model_not_offered: "Nicht in der Modellliste",
    model_not_offered_hint:
      "Ein internes Feature ist für dieses Modell konfiguriert, aber die Modellliste des Deployments enthält es nicht; hier kann ihm kein Schlüssel zugeordnet werden.",
  },
  mcp_confirmation: {
    title: "MCP-Werkzeug ausführen?",
    description:
      "Der Assistent möchte „{{tool}}“ auf {{server}} ausführen. Erlauben Sie dies nur, wenn Sie dem Server und den Argumenten vertrauen.",
    allow: "Werkzeug ausführen",
    allow_always: "Immer in diesem Chat erlauben",
    always_allowed: "(immer erlaubt)",
    deny: "Ablehnen",
    denied: "Der Benutzer hat die Ausführung des MCP-Werkzeugs „{{tool}}“ auf {{server}} abgelehnt.",
  },
  feature_guide: {
    workspace_overview: {
      title: "Arbeitsbereiche",
      step1: "Das rechte Fenster gehört zum Arbeitsbereich: Zuerst öffnet sich Neuigkeiten, Dateien zeigt den gespeicherten Inhalt, Agenten die Ausführung.",
      step2: "Quellen kommen beim Erstellen hinein: „Arbeitsbereich erstellen“ listet links Browserspeicher, dieses Gerät, Arcanas, Repositories und MCP-Server auf.",
      step3: "Durchsuchen Sie den Baum im Reiter Dateien. Die Markierung jeder Zeile zeigt, wo der Eintrag liegt: Browser, Gerät, Arcana, MCP oder Agent.",
      step4: "Wählen Sie, wie der Agent in diesem Arbeitsbereich läuft: im Browser, über einen OpenCode-Server oder mit dem Remote-Agenten.",
    },
    manage_chat_data: {
      title: "Dateien eines Chats verwalten",
      step1: "Auf Speicher zugreifen ist standardmäßig an und steht oben im Arbeitsbereich-Menü. Schalten Sie es aus, erhält das Modell keine Dateiwerkzeuge; Anhänge werden weiterhin in die Nachricht aufgenommen, sofern möglich.",
      step2: "Wählen Sie Daten verwalten, um die Dateien hinter diesem Schalter zu sehen. Chats, die einem Arbeitsbereich zugeordnet sind, öffnen diesen, dessen Reiter Dateien das Dateisystem zeigt; Chats ohne Arbeitsbereich durchsuchen die für den Chat in diesem Browser gespeicherten Dateien.",
      step3: "Laden Sie die Dateien des Chats hier hoch, erstellen, benennen Sie sie um, laden Sie sie herunter oder löschen Sie sie.",
    },
    workspace_clone: {
      title: "Git-Repository importieren",
      step1: "Öffnen Sie „Arbeitsbereich erstellen“, wählen Sie links „Git-Repository“, den lokalen Agenten für den Klon und drücken Sie dann „Erstellen“.",
    },
    workspace_upload: {
      title: "Dateien in einen Arbeitsbereich hochladen",
      step1: "Öffnen Sie einen Arbeitsbereich, wählen Sie rechts den Reiter Dateien und dort Datei hinzufügen; der Browser fragt nach einer Datei von diesem Computer.",
      step2: "Die hochgeladene Datei erscheint in dem Ordner, den Sie gerade ansehen.",
    },
    workspace_multiselect: {
      title: "Eine Datei aus einem Arbeitsbereich entfernen",
      step1: "Der Reiter Dateien rechts listet alles, was der Arbeitsbereich speichert — jede Zeile mit ihrer Herkunft.",
      step2: "Jede Zeile endet mit einem Papierkorb; er entfernt diese Datei oder diesen Ordner nach einer Bestätigung.",
    },
    arcana_filesystem: {
      title: "Ein Arcana-Dateisystem verwenden",
      step1: "Jeder Arbeitsbereich enthält bereits eine Arcana-Dateisystem-Quelle, aufgeführt im Reiter Dateien.",
      step2: "Jede Arcana erscheint als Ordner; öffnen Sie einen, um seine Dateien zu durchsuchen.",
    },
    attach_from_workspace: {
      title: "Dateien aus einem Arbeitsbereich anhängen",
      step1: "Verknüpfen Sie diesen Chat über die Arbeitsbereich-Schaltfläche im Eingabefeld mit einem Arbeitsbereich.",
      step2:
        "Klicken Sie auf „Anhängen“ und wählen Sie „Aus dem Arbeitsbereich“, dann eine Datei aus dem Arbeitsbereichsbaum.",
      step3: "Senden Sie die Nachricht mit der angehängten Datei.",
    },
    agent_recovery: {
      title: "Eine Agent-Sitzung wiederherstellen",
      step1: "Öffnen Sie die Werkzeuge des Agenten im Eingabefeld. Ist der Agent-Server nicht erreichbar, verwenden Exporte den lokalen Cache.",
      step2: "Öffnen Sie den Tab Wiederherstellung, um zu sehen, wie viel Verlauf für diese Sitzung gespeichert ist.",
      step3: "In neuer Sitzung wiederherstellen schreibt den zwischengespeicherten Verlauf in die Anweisungen einer neuen Sitzung. Prüfen und bestätigen Sie zuerst die Größe.",
    },
    remote_agents: {
      title: "Einen Remote-Agenten starten",
      step1: "Verwenden Sie die +-Schaltfläche im Bereich Agenten, um einen Agenten hinzuzufügen. Wählen Sie den GWDG HPC-Agenten-Dienst und sein HPC-Projekt oder verbinden Sie einen OpenCode-Server.",
      step2: "Agenten erscheinen in der Liste; klicken Sie auf einen, um seinen Chat rechts zu öffnen.",
      step3:
        "Klappen Sie einen Agenten über das Chevron auf, um jeden Arbeitsbereich mit den zugeordneten Sitzungen sowie „Nicht zugeordnete Sitzungen“ zu sehen. Klicken Sie eine Sitzung zum Wechseln an, erstellen Sie mit + eine neue oder öffnen Sie das ...-Menü zum Umbenennen, Zuordnen zu einem Arbeitsbereich oder Schließen.",
    },
    close_group_sessions: {
      title: "Alle Sitzungen einer Gruppe schließen",
      step1:
        "Klappen Sie einen Agenten auf, um seine Sitzungen nach Arbeitsbereich gruppiert und unter „Nicht zugeordnete Sitzungen“ zu sehen.",
      step2: "Das Papierkorb-Symbol in der Gruppenüberschrift schließt alle Sitzungen dieser Gruppe. Laufende Antworten werden zuerst unterbrochen, und Sie müssen die Aktion in einem Dialog bestätigen, bevor eine Sitzung entfernt wird.",
    },
    session_workspaces: {
      title: "Eine Sitzung zwischen Arbeitsbereichen verschieben",
      step1:
        "Klappen Sie einen Agenten auf, um seine Sitzungen nach den Arbeitsbereichen gruppiert zu sehen, denen er zugeordnet ist.",
      step2:
        "Ziehen Sie eine Sitzungszeile auf eine andere Arbeitsbereichsgruppe, um sie dorthin zu verschieben. Die Sitzung wird aus dem alten Arbeitsbereich entfernt und dem neuen hinzugefügt; beide Gruppen aktualisieren sich sofort.",
    },
    agent_workspace_access: {
      title: "Einem Agenten Zugriff auf Arbeitsbereichsdateien geben",
      step1: "Öffnen Sie einen Agenten. Das Fenster links ist sein Dateibrowser.",
      step2: "Öffnen Sie die Arbeitsbereich-Schaltfläche neben dem Eingabefeld und schalten Sie den Arbeitsbereich-Zugriff ein, um den Reverse-Proxy für diesen Agenten bereitzustellen. Verbinden Sie einen Arbeitsbereich, wählen Sie, welchen die Brücke nutzt, erlauben Sie Schreibzugriff, wenn der Agent Dateien ändern darf, und lassen Sie diesen Tab geöffnet, während der Agent arbeitet.",
    },
    catalog: {
      open: "Tutorials durchsuchen",
      close: "Tutorials ausblenden",
      title: "Tutorials",
      search: "Tutorials durchsuchen",
      empty: "Keine Tutorials gefunden.",
      hide_completed: "Abgeschlossene ausblenden",
      completed_successfully: "Erfolgreich abgeschlossen",
      completed: "Abgeschlossen",
      start: "Starten",
      replay: "Wiederholen",
      steps: "{{count}} Schritte",
    },
    walkthrough_complete: "Durchlauf abgeschlossen",
    dont_show_again: "Nicht mehr anzeigen",
    completed_title: "Tutorial abgeschlossen",
    more_tutorials: "Weitere Tutorials",
    categories: {
      meta_chat: "Den Metachat verwenden",
      prompt: "Eingabe und Chat",
      tools: "Tools und RAG",
      chats: "Chats und Organisation",
      personas: "Personas",
      workspace: "Arbeitsbereiche",
      settings: "Einstellungen",
      other: "Mehr",
    },
    show_me: "Zeigen: {{title}}",
    show_me_short: "Zeigen",
    step: "Schritt {{current}} von {{total}}",
    status_title: "Tutorial-Fortschritt",
    status_waiting: "Warten auf Ihre Aktion",
    status_ready: "Schritt abgeschlossen",
    status_manual: "Weiter, wenn Sie bereit sind",
    status_done: "Tutorial abgeschlossen",
    complete_step: "Schließen Sie diesen Schritt ab, um fortzufahren.",
    next: "Weiter",
    back: "Zurück",
    done: "Fertig",
    close: "Schließen",
    attach_media: {
      title: "Medien an einen Chat anhängen",
      step1: "Klicken Sie auf die Bildschaltfläche im Eingabefeld.",
      step2:
        "Wählen Sie eine Bild-, Audio- oder Videodatei, wenn das aktuelle Modell sie unterstützt. Die Datei erscheint über dem Eingabefeld.",
      step3: "Geben Sie eine Nachricht ein und klicken Sie auf Senden.",
    },
    upload_file: {
      title: "Eine Datei an einen Chat anhängen",
      step1:
        "Klicken Sie auf die Büroklammer im Eingabefeld, um die Dateiauswahl zu öffnen.",
      step2:
        "Wählen Sie eine Datei. Sie erscheint über dem Eingabefeld; PDF- und DOCX-Dateien müssen eventuell zuerst verarbeitet werden.",
      step3:
        "Geben Sie Ihre Nachricht ein und klicken Sie auf Senden. Das Modell verwendet die Datei, wenn es diesen Dateityp unterstützt.",
    },
    process_attachment: {
      title: "Einen Anhang verarbeiten",
      step1: "Hängen Sie ein PDF oder DOCX an oder suchen Sie die Anhang-Karte über dem Eingabefeld.",
      step2: "Wählen Sie Im Browser verarbeiten oder Auf dem Server verarbeiten.",
      step3:
        "Warten Sie auf die verarbeitete Markdown-Datei und senden Sie dann Ihre Nachricht.",
    },
    select_model: {
      title: "Ein Modell auswählen",
      step1:
        "Öffnen Sie hier die Modellauswahl, um verfügbare Modelle und ihre Fähigkeiten zu sehen. Auf kleinen Bildschirmen wird die Auswahl im Kopfbereich verwendet.",
    },
    conversation_settings: {
      title: "Unterhaltungseinstellungen ändern",
      step1: "Klicken Sie auf das Einstellungssymbol im Eingabefeld.",
      step2:
        "Passen Sie Erinnerungsmodus, Temperatur, top_p, Denkaufwand oder den System-Prompt für diesen Chat an.",
    },
    voice_input: {
      title: "Eine Sprachnachricht aufnehmen",
      step1:
        "Klicken Sie auf das Mikrofon. Erlauben Sie den Mikrofonzugriff, wenn der Browser danach fragt.",
      step2:
        "Die Aufnahme wird an den Prompt angehängt. Ergänzen Sie bei Bedarf Text und senden Sie.",
    },
    send_key: {
      title: "Festlegen, wie Nachrichten gesendet werden",
      step1: "Öffnen Sie Ihre Benutzereinstellungen.",
      step2: "Wählen Sie den Tab Chat.",
      step3:
        "Stellen Sie Nachricht senden mit auf Eingabe oder Umschalt+Eingabe. Alt+Eingabe fügt immer einen Zeilenumbruch ein.",
    },
    arcana: {
      title: "Arcana für RAG verwenden",
      step1: "Öffnen Sie GWDG Tools im Eingabefeld.",
      step2: "Aktivieren Sie die Tools.",
      step3: "Wählen Sie Arcana.",
      step4:
        "Geben Sie Ihre Arcana-ID ein. Über den Hilfe-Link können Sie eine Sammlung erstellen.",
    },
    web_search: {
      title: "Websuche verwenden",
      step1: "Öffnen Sie GWDG Tools im Eingabefeld.",
      step2: "Aktivieren Sie die Tools.",
      step3: "Wählen Sie Websuche und akzeptieren Sie den Hinweis.",
    },
    image_generation: {
      title: "Bilder erzeugen",
      step1: "Öffnen Sie GWDG Tools im Eingabefeld.",
      step2: "Aktivieren Sie die Tools.",
      step3:
        "Wählen Sie Bilderzeugung und beschreiben Sie das gewünschte Bild.",
    },
    image_modification: {
      title: "Bilder bearbeiten",
      step1: "Öffnen Sie GWDG Tools im Eingabefeld.",
      step2: "Aktivieren Sie die Tools.",
      step3:
        "Wählen Sie Bildbearbeitung und hängen Sie das Bild an oder beschreiben Sie es.",
    },
    browser_storage: {
      title: "Browserspeicher aktivieren",
      step1: "Öffnen Sie Browser & lokale Werkzeuge im Eingabefeld.",
      step2:
        "Wählen Sie Browserspeicher, damit der Assistent Dateien im Browser-Arbeitsbereich dieses Chats lesen und schreiben kann.",
    },
    image_analysis: {
      title: "Bilder analysieren",
      step1: "Öffnen Sie die GWDG-Tools im Eingabefeld.",
      step2:
        "Wählen Sie Bilder analysieren, damit der Assistent Bilddateien mit dem Gemma-Visionsmodell von SAIA analysieren kann.",
    },
    audio_generation: {
      title: "Audio erzeugen",
      step1: "Öffnen Sie GWDG Tools im Eingabefeld.",
      step2: "Aktivieren Sie die Tools.",
      step3:
        "Wählen Sie Audioerzeugung und beschreiben Sie das gewünschte Audio.",
    },
    arcana_tools: {
      title: "Arcana Tools verwenden",
      step1: "Öffnen Sie GWDG Tools im Eingabefeld.",
      step2: "Aktivieren Sie die Tools.",
      step3:
        "Wählen Sie Arcana Tools, damit der Assistent Arcana-Sammlungen, ihre Dateien und Indizes sowie Freigaben verwalten kann.",
    },
    diagram_renderers: {
      title: "Diagramme aus Codeblöcken rendern",
      step1: "Fragen Sie nach einem Codeblock: ```dot für Graphviz, ```vega-lite für Vega-Lite oder ```chart für eine Chart.js-JSON-Konfiguration.",
      step2: "Senden Sie die Nachricht. Der Block wird lokal als SVG oder Canvas-Diagramm gerendert.",
    },
    mcp_server: {
      title: "Einen MCP-Server verbinden",
      step1: "Fügen Sie einen MCP-Server im Bereich MCP-Server der Seitenleiste hinzu.",
      scan: "Oder lassen Sie die App nach lokalen Servern suchen: „Suchen“ prüft auf diesem Rechner alle Ports über 5000 auf einen /mcp-Endpunkt und fügt die Funde hinzu.",
      step2: "Geben Sie die Server-URL oder Gateway-ID ein und testen Sie die Verbindung.",
      step3: "Öffnen Sie die GWDG-Tools, aktivieren Sie MCP-Server und wählen Sie den konfigurierten Server aus.",
    },
    tools_overview: {
      title: "GWDG Tools verwenden",
      step1: "Öffnen Sie GWDG Tools im Eingabefeld.",
      step2: "Aktivieren Sie die Tools.",
      step3:
        "Wählen Sie ein Tool. Tools erscheinen nur bei Modellen, die sie unterstützen.",
    },
    search_chats: {
      title: "Chats durchsuchen",
      step1: "Klicken Sie in der Seitenleiste auf Suchen.",
      step2: "Geben Sie einen Teil eines Chat-Titels ein, um zu filtern.",
    },
    manage_topics: {
      title: "Chats mit Themen organisieren",
      step1: "Klicken Sie in der Seitenleiste auf Thema erstellen.",
      step2: "Benennen Sie das Thema und wählen Sie Symbol und Farbe.",
      step3:
        "Ziehen Sie Chats in Themen oder verschieben Sie sie über das Chat-Menü.",
      step4:
        "Nutzen Sie die Schaltfläche neben „Thema erstellen“, um alle Themen auf einmal ein- oder auszuklappen.",
    },
    attach_chat_to_workspace: {
      title: "Chat mit einem Arbeitsbereich verknüpfen",
      step1:
        "Ziehen Sie einen Chat aus der Seitenleiste auf eine Zeile eines Arbeitsbereichs, um ihn zu verknüpfen.",
      step2:
        "Der verknüpfte Chat erscheint unter dem Arbeitsbereich. Seine Dateien sind dort ebenfalls verfügbar.",
      step3:
        "Ziehen Sie den Chat aus dem Arbeitsbereich auf ein Thema, um die Verknüpfung wieder zu lösen.",
    },
    sort_organize: {
      title: "Smart Sort",
      step1: "Klicken Sie in der Kopfzeile der Seitenleiste auf „Smart Sort“.",
      step2:
        "Prüfen Sie die vorgeschlagenen Themen, Titel und Löschungen. Änderungen werden erst beim Anwenden übernommen.",
      step3:
        "Wählen Sie die gewünschten Vorschläge aus und klicken Sie auf „Änderungen anwenden“.",
    },
    sort_group_chats: {
      title: "Chats sortieren und gruppieren",
      step1: "Öffnen Sie das Sortiermenü in der Seitenleiste.",
      step2:
        "Wählen Sie die Gruppierung nach Thema, Datum, Erstellungsdatum oder Browserspeichergröße.",
    },
    pin_chat: {
      title: "Einen Chat anheften",
      step1: "Öffnen Sie das Chat-Menü eines Chats in der Seitenleiste.",
      step2:
        "Wählen Sie „Chat anheften“. Angeheftete Chats bleiben unabhängig von der Gruppierung in einem eigenen Bereich oben.",
    },
    pin_topic: {
      title: "Ein Thema anheften",
      step1: "Öffnen Sie das Optionenmenü eines Themas in der Seitenleiste.",
      step2:
        "Wählen Sie „Thema anheften“. Angeheftete Themen bleiben unabhängig von der Gruppierung im Bereich „Angeheftet“ oben.",
    },
    pin_workspace: {
      title: "Einen Arbeitsbereich anheften",
      step1: "Öffnen Sie das Optionenmenü eines Arbeitsbereichs in der Seitenleiste.",
      step2:
        "Wählen Sie „Arbeitsbereich anheften“. Er wird zusätzlich im angehefteten Bereich oben über den Chats angezeigt und bleibt in der Arbeitsbereichsliste.",
      step3:
        "Klicken Sie im angehefteten Bereich erneut auf die Nadel, um den Arbeitsbereich nicht mehr anzuheften.",
    },
    pin_agent: {
      title: "Einen Agenten anheften",
      step1: "Öffnen Sie das Optionenmenü eines Agenten in der Seitenleiste.",
      step2:
        "Wählen Sie „Agenten anheften“. Er wird zusätzlich im angehefteten Bereich oben über den Chats angezeigt und bleibt in der Agentenliste.",
    },
    close_chat: {
      title: "Einen Chat schließen",
      step1:
        "Verwenden Sie die Schließen-Schaltfläche oben rechts. Sie entfernt den Chat aus Ihren Unterhaltungen; im Metachat wird stattdessen die Unterhaltung geleert.",
    },
    export_conversation: {
      title: "Einen Chat exportieren",
      step1: "Öffnen Sie das Chat-Menü in der Seitenleiste.",
      step2: "Wählen Sie Exportieren und legen Sie die Optionen fest.",
    },
    import_conversation: {
      title: "Einen Chat importieren",
      step1:
        "Klicken Sie in der Seitenleiste auf Importieren und wählen Sie eine JSON-Chatdatei. Alternativ können Sie im Tab Daten importieren.",
    },
    chat_with_persona: {
      title: "Mit Persona chatten",
      step1:
        "Klicken Sie in der Seitenleiste auf „Mit Persona chatten“, um die Persona-Bibliothek zu öffnen.",
      step2:
        "Wählen Sie links eine Kategorie oder nutzen Sie den Schnellimport, um direkt zu starten.",
      step3:
        "Klicken Sie auf eine Persona, um einen neuen Chat mit Titel, Modell und Systemprompt zu starten.",
    },
    share_conversation: {
      title: "Unterhaltungseinstellungen teilen",
      step1: "Öffnen Sie die Unterhaltungseinstellungen.",
      step2: "Klicken Sie auf Teilen, um einen Link mit diesen Einstellungen zu kopieren.",
    },
    fork_conversation: {
      title: "Eine Unterhaltung abzweigen",
      step1:
        "Verwenden Sie Abzweigen an einer Assistenten-Nachricht, um von dort in einem neuen Chat fortzufahren.",
    },
    summarize_conversation: {
      title: "Einen Chat zusammenfassen",
      step1: "Öffnen Sie das Chat-Menü in der Seitenleiste.",
      step2: "Wählen Sie Zusammenfassen. Eine neue Unterhaltung mit der Zusammenfassung wird erstellt.",
    },
    settings_overview: {
      title: "Einstellungen ändern",
      step1: "Öffnen Sie Ihre Benutzereinstellungen über das Profil oder die Seitenleiste.",
      step2: "Wählen Sie den Tab Chat. Nutzung, Erweitert, Erinnerungen und Daten enthalten die weiteren Einstellungen.",
      step3: "Ändern Sie eine Einstellung wie Dokumentkonvertierung. Änderungen werden automatisch gespeichert.",
      step4: "Darstellungsmodule und die Denkprozess-Anzeige finden Sie im Tab Erweitert.",
    },
    memories: {
      title: "Erinnerungen verwalten",
      step1: "Öffnen Sie Ihre Benutzereinstellungen.",
      step2:
        "Verwalten Sie im Tab Erinnerungen gespeicherte Erinnerungen und den Erinnerungsmodus.",
    },
    chat_preferences: {
      title: "Chat-Einstellungen öffnen",
      step1: "Öffnen Sie Ihre Benutzereinstellungen.",
      step2:
        "Wählen Sie den Tab Chat, um Standardmodell, Sendetaste, Zusammenfassungen, Zeitstempel und Dokumentkonvertierung zu ändern; die Darstellung liegt im Tab Erweitert.",
    },
    e2ee: {
      title: "Ein Modell Ende-zu-Ende verschlüsseln",
      step1: "Öffnen Sie Ihre Benutzereinstellungen.",
      step2: "Wählen Sie den Tab Verschlüsselung.",
      step3:
        "Importieren Sie den Public Key des Modells: einfügen, .pub-Datei wählen, aus einer URL laden, ein Schlüsselverzeichnis importieren oder einen lokalen Ordner wählen und alle .pub-Dateien darin einlesen.",
      step_published:
        "Oder laden Sie die vom Deployment veröffentlichten Schlüssel: Die Basis-URL ist aus der Konfiguration vorbelegt, und „Schlüssel für alle Modelle laden“ importiert und prüft jede veröffentlichte .pub-Datei.",
      step4:
        "Geben Sie beim Hinzufügen die Modelle an, für die der Schlüssel gilt. Sie zeigen dann ein grünes Schloss, und jede Anfrage darüber wird in diesem Browser verschlüsselt.",
      step_test:
        "Testen Sie einen Schlüssel erneut gegen die Modelle, denen er zugeordnet ist. Ein Schlüssel, der die versiegelte Testanfrage beantwortet, wird grün markiert; ein ungetesteter oder fehlgeschlagener nicht.",
    },
    message_timestamps: {
      title: "Zeitstempel für Nachrichten anzeigen",
      step1: "Öffnen Sie Ihre Benutzereinstellungen.",
      step2: "Wählen Sie den Tab Chat.",
      step3:
        "Aktivieren Sie im Abschnitt Nachrichten die Option Zeitstempel für Nachrichten anzeigen, um zu sehen, wann jede Nachricht gesendet wurde.",
    },
    rendering: {
      title: "Darstellung konfigurieren",
      step1: "Öffnen Sie Ihre Benutzereinstellungen.",
      step2: "Wählen Sie den Tab Erweitert.",
      step3:
        "Aktivieren Sie die Typst- oder LaTeX-Darstellung. Auch HTML-Darstellung und externe Verweise werden hier konfiguriert.",
    },
    reasoning_streaming: {
      title: "Denkprozess verfolgen",
      step1: "Öffnen Sie Ihre Benutzereinstellungen.",
      step2: "Wählen Sie den Tab Erweitert.",
      step3:
        "Die Option ist standardmäßig aktiviert. Lassen Sie sie an, um während des Denkens einen bewegten Punkt zu sehen. Klicken Sie auf die Kopfzeile, um den Denkprozess während des Streamings zu öffnen, oder schalten Sie die Option aus, wenn sich die Box automatisch öffnen soll.",
    },
    document_conversion: {
      title: "Dokumentkonvertierung wählen",
      step1: "Öffnen Sie Ihre Benutzereinstellungen.",
      step2: "Wählen Sie den Tab Chat.",
      step3: "Wählen Sie Nur Server, Nur Browser oder Nach Wahl.",
    },
    data_management: {
      title: "Ihre Daten verwalten",
      step1: "Öffnen Sie Ihre Benutzereinstellungen.",
      step2: "Wählen Sie den Tab Daten.",
      step3:
        "Exportieren Sie lokale Daten oder löschen Sie Chats, Erinnerungen, Einstellungen und Anhänge.",
    },
    dark_mode: {
      title: "Design wechseln",
      step1:
        "Verwenden Sie den Design-Schalter in der Fußzeile, um zwischen hellem und dunklem Modus zu wechseln.",
    },
    feedback: {
      title: "Feedback senden",
      step1:
        "Verwenden Sie die Feedback-Schaltflächen unter einer Assistenten-Nachricht, wenn das Feedback-Modul aktiviert ist.",
    },
    speech_output: {
      title: "Antworten vorlesen lassen",
      step1:
        "Klicken Sie auf das Lautsprecher-Symbol unter einer Assistenten-Nachricht, wenn das Sprachmodul aktiviert ist.",
    },
    meta_chat_catalogs: {
      title: "Tutorials und Einstellungen im Metachat finden",
      step1: "Durchsuchen Sie alle verfügbaren Tutorials und wiederholen Sie abgeschlossene.",
      step2: "Durchsuchen Sie vollständige Abläufe, die mehrere Funktionen kombinieren. Der Metachat kann beide Optionen auch für Sie starten.",
      step3: "Sie können mich auch bitten, ein Tutorial zu finden oder eine Persona zu empfehlen. Zum Beispiel: „Finde ein Tutorial zum Hochladen einer Datei.“",
      step4: "Fragen Sie nach Einstellungen oder lassen Sie sich zu einem Chat, einer Nachricht, einem Thema oder einer Einstellung führen. Ich kann auch nach Entscheidungen und Aufgaben in Ihren Chats suchen.",
    },
    meta_chat_actions: {
      title: "Chats mit dem Metachat umbenennen und organisieren",
      step1: "Öffnen Sie den Metachat über das KI-Symbol in der Seitenleiste.",
      step2:
        "Bitten Sie ihn, einen Chat umzubenennen oder in ein anderes Thema zu verschieben. Zum Beispiel: „Benenne ‚Preisdiskussion‘ in ‚Preisstrategie‘ um.“",
      step3:
        "Prüfen Sie die vorgeschlagenen Änderungen und klicken Sie auf „Änderungen übernehmen“. Erst dann werden sie angewendet.",
    },
    meta_chat_search: {
      title: "Nachrichteninhalte mit dem Metachat durchsuchen",
      step1: "Öffnen Sie den Metachat über das KI-Symbol in der Seitenleiste.",
      step2:
        "Bitten Sie ihn, etwas in Ihren Chats zu finden, zum Beispiel: „Finde, wo wir das Preismodell entschieden haben“ oder „Welche Aufgaben gibt es?“",
      step3:
        "Klicken Sie auf eine zitierte Nachricht, um zur genauen Nachricht zu springen und sie hervorzuheben.",
    },
    meta_chat_pins: {
      title: "Chats, Themen, Arbeitsbereiche und Agenten mit dem Metachat anheften",
      step1: "Öffnen Sie den Metachat über das KI-Symbol in der Seitenleiste.",
      step2:
        "Bitten Sie ihn, einen Chat, ein Thema, einen Arbeitsbereich oder einen Agenten anzuheften oder nicht mehr anzuheften, zum Beispiel: „Hefte den Chat Preisdiskussion an“ oder „Hefte das Thema Forschung nicht mehr an“.",
      step3:
        "Prüfen Sie die vorgeschlagene Änderung und klicken Sie auf „Änderungen übernehmen“. Erst dann wird sie angewendet.",
    },
    meta_chat_navigation: {
      title: "Navigieren und suchen mit dem Metachat",
      step1: "Öffnen Sie den Metachat über das KI-Symbol in der Seitenleiste.",
      step2:
        "Bitten Sie ihn, Sie irgendwohin zu führen, zum Beispiel: „Bring mich zu den Chat-Einstellungen“ oder „Öffne den Chat über die Preise“.",
      step3:
        "Bitten Sie ihn, Ihre Chats zu durchsuchen, zum Beispiel: „Finde, wo wir das Preismodell entschieden haben“ oder „Welche Aufgaben gibt es?“. Klicken Sie auf eine zitierte Nachricht, um dorthin zu springen.",
    },
    meta_chat_agents: {
      title: "Agenten über den Metachat bedienen",
      step1: "Öffnen Sie den Metachat über das KI-Symbol in der Seitenleiste.",
      step2: "Fragen Sie nach Agentenstatus oder Verlauf, zum Beispiel: „Prüfe alle Agenten und zeige neue Dateien.“",
      step3: "Lassen Sie eine Datei abrufen, zum Beispiel: „Zeige random.png vom Research-Agenten“, oder prüfen Sie einen Prompt-/Unterbrechungsvorschlag vor dem Annehmen.",
    },
    meta_chat_workspaces: {
      title: "Arbeitsbereiche über den Metachat verknüpfen",
      step1: "Öffnen Sie den Metachat über das KI-Symbol in der Seitenleiste.",
      step2: "Fragen Sie nach Arbeitsbereichen und lassen Sie einen verknüpfen, zum Beispiel: „Verknüpfe den Arbeitsbereich Research mit Agent 1.“",
      step3: "Prüfen Sie den Vorschlag und klicken Sie auf Änderungen übernehmen.",
    },
    meta_chat_digest: {
      title: "Eine Was-ist-neu-Übersicht erhalten",
      step1: "Öffnen Sie den Metachat über das KI-Symbol in der Seitenleiste.",
      step2: "Das Banner zeigt, wann zuletzt geprüft wurde. Es wird nach jeder Was-ist-neu-Antwort aktualisiert.",
      step3: "Fragen Sie „Was gibt es Neues?“, um geänderte Chats, neue Themen und Erinnerungen, den Agentenstatus über alle Sitzungen und Subagenten, neue oder geänderte Sitzungen und neue Agentendateien zu sehen.",
    },
    meta_chat_mcp: {
      title: "MCP-Server über den Metachat verwalten",
      step1: "Öffnen Sie den Bereich MCP-Server in der Seitenleiste oder fügen Sie dort einen Server hinzu.",
      step2: "Kehren Sie über das KI-Symbol zum Metachat zurück.",
      step3: "Lassen Sie Server testen, Werkzeuge auflisten oder Server hinzufügen/aktualisieren/entfernen. Änderungen an der Seitenleiste erfordern eine Bestätigung.",
    },
    meta_chat_usage: {
      title: "Den Metachat verwenden",
      step1:
        "Klicken Sie auf das KI-Symbol in der Seitenleiste, um den Metachat zu öffnen. Fragen Sie nach Funktionen oder wo ein Chat ist.",
    },
  },
  use_cases: {
    common: {
      start_new_chat: "Starten Sie für diesen Ablauf einen neuen Chat.",
    },
    catalog: {
      open: "Anwendungsfälle durchsuchen",
      close: "Anwendungsfälle ausblenden",
      search: "Anwendungsfälle durchsuchen",
      hide_completed: "Abgeschlossene ausblenden",
      completed_successfully: "Erfolgreich abgeschlossen",
      empty: "Keine Anwendungsfälle gefunden.",
      walk_through_again: "Noch einmal Schritt für Schritt zeigen",
      start_walkthrough: "Schritt für Schritt zeigen",
      show_tutorial: "Tutorial zeigen",
    },
    categories: {
      research: "Recherche",
      organize: "Organisieren",
      create: "Erstellen",
      workflows: "Arbeitsabläufe",
    },
    analyze_paper: {
      title: "Ein wissenschaftliches Paper analysieren",
      description: "Laden Sie ein PDF hoch, verarbeiten Sie es und stellen Sie dann Fragen zum Inhalt.",
      step1: "Hängen Sie das Paper über die Büroklammer an.",
      step2: "Verarbeiten Sie das PDF im Browser oder auf dem Server.",
      step3: "Fragen Sie: „What are the references?“",
      step4: "Fragen Sie: „Summarize the methodology and main findings.“",
    },
    web_research: {
      title: "Aktuelle Informationen recherchieren",
      description: "Aktivieren Sie die Websuche und stellen Sie eine Frage, die aktuelle Quellen benötigt.",
      step1: "Öffnen Sie GWDG Tools im Eingabefeld.",
      step2: "Aktivieren Sie die Tools und wählen Sie die Websuche.",
      step3: "Fragen Sie nach einer aktuellen Entwicklung und erwähnen Sie, dass Sie aktuelle Quellen benötigen.",
      step4: "Folgen Sie den zitierten Quellen und stellen Sie Rückfragen.",
    },
    rag_documents: {
      title: "Fragen aus eigenen Dokumenten beantworten",
      description: "Verwenden Sie Arcana (RAG), um aus einer eigenen Dokumentensammlung zu antworten.",
      step1: "Öffnen Sie GWDG Tools im Eingabefeld.",
      step2: "Aktivieren Sie die Tools und wählen Sie Arcana.",
      step3: "Geben Sie Ihre Arcana-ID ein.",
      step4: "Fragen Sie: „Was sagt unsere interne Richtlinie dazu?“",
      step5: "Fragen Sie: „Welches Dokument belegt diese Antwort?“",
    },
    organize_topics: {
      title: "Chats nach Projekt organisieren",
      description: "Erstellen Sie Themen und gruppieren Sie zusammengehörige Chats.",
      step1: "Erstellen Sie ein Thema wie „Abschlussarbeit“ oder „Kundenprojekt“.",
      step2: "Ziehen Sie passende Chats in das Thema oder gruppieren Sie die Seitenleiste nach Thema.",
    },
    find_chat: {
      title: "Einen alten Chat finden",
      description: "Durchsuchen Sie Chat-Titel oder fragen Sie den Metachat, wo eine Unterhaltung ist.",
      step1: "Suchen Sie in der Seitenleiste nach einem Teil des Titels.",
      step2: "Oder fragen Sie: „Wo ist mein Chat über die Paper-Analyse?“",
    },
    summarize_chat: {
      title: "Einen langen Chat in Notizen verwandeln",
      description: "Erstellen Sie eine neue Unterhaltung mit einer Zusammenfassung einer langen Unterhaltung für Ihre Notizen.",
      step1: "Öffnen Sie das Chat-Menü in der Seitenleiste.",
      step2: "Wählen Sie Zusammenfassen und prüfen Sie das Ergebnis.",
      step3: "Exportieren Sie den Chat, wenn Sie eine Datei für Ihre Notizen benötigen.",
    },
    generate_image: {
      title: "Ein Bild für eine Folie erstellen",
      description: "Aktivieren Sie die Bilderzeugung und beschreiben Sie das gewünschte Bild.",
      step1: "Öffnen Sie Tools und aktivieren Sie die Bilderzeugung.",
      step2: "Fragen Sie: „Erstelle ein klares Diagramm eines dreistufigen Forschungsablaufs.“",
      step3: "Verfeinern Sie den Prompt, bis das Bild zur Folie passt.",
    },
    share_setup: {
      title: "Eine wiederverwendbare Einrichtung teilen",
      description: "Teilen Sie System-Prompt, Modell und Einstellungen als Link.",
      step1: "Öffnen Sie die Unterhaltungseinstellungen und wählen Sie Teilen.",
      step2: "Senden Sie den kopierten Link an eine Person, die dieselbe Einrichtung braucht.",
    },
    compare_models: {
      title: "Zwei Modelle vergleichen",
      description: "Zweigen Sie eine Unterhaltung ab, wechseln Sie das Modell und stellen Sie dieselbe Frage.",
      step1: "Zweigen Sie die Unterhaltung an der gewünschten Nachricht ab.",
      step2: "Wählen Sie ein anderes Modell.",
      step3: "Senden Sie denselben Prompt und vergleichen Sie die Antworten.",
    },
    local_conversion: {
      title: "Dokumentkonvertierung lokal halten",
      description: "Konvertieren Sie PDFs und DOCX-Dateien im Browser statt auf dem Server.",
      step1: "Öffnen Sie die Chat-Einstellungen in den Benutzereinstellungen.",
      step2: "Wählen Sie Nur Browser unter Dokumentkonvertierung.",
      step3: "Hängen Sie ein PDF oder DOCX an.",
      step4: "Verarbeiten Sie die Datei über die Anhang-Karte.",
    },
    memories: {
      title: "Einstellungen chatübergreifend merken",
      description: "Speichern Sie Kontext und Vorlieben in Erinnerungen, damit spätere Chats sie abrufen können.",
      step1: "Öffnen Sie die Benutzereinstellungen und fügen Sie eine Erinnerung hinzu.",
      step2: "Aktivieren Sie Abrufen oder Lernen für die passenden Unterhaltungen.",
      step3: "Fragen Sie: „Was erinnerst du dich über meine Vorlieben?“",
    },
    read_aloud: {
      title: "Eine Antwort anhören",
      description: "Lassen Sie eine Assistentenantwort über die Sprachschaltfläche vorlesen.",
      step1: "Klicken Sie auf das Lautsprecher-Symbol unter einer Assistenten-Nachricht.",
      step2: "Beenden Sie die Wiedergabe jederzeit mit der Stopp-Schaltfläche.",
    },
  },
  // Settings panel
  settings: {
    memory_mode: {
      label: "Erinnerungen",
      description:
        "Legen Sie fest, wie diese Unterhaltung Ihre gespeicherten Erinnerungen verwendet.",
      help_label: "Mehr über Erinnerungen erfahren",
      default_group_name: "Standard",
      group_label: "Erinnerungsgruppe",
      group_default: "Standard ({{group}})",
      options: {
        default: {
          label: "Standard",
          description:
            "Verwendet die globale Erinnerungseinstellung (aktuell: {{mode}}).",
        },
        none: {
          label: "Aus",
          description:
            "Gespeicherte Erinnerungen werden in dieser Unterhaltung nicht verwendet.",
        },
        recall: {
          label: "Abrufen",
          description:
            "Gespeicherte Erinnerungen werden in dieser Unterhaltung für persönlichere Antworten verwendet.",
        },
        learn: {
          label: "Lernen",
          description:
            "Gespeicherte Erinnerungen werden verwendet und neue Details aus dieser Unterhaltung gelernt.",
        },
      },
    },
    tools_enabled: "Werkzeuge sind aktiviert",
    tools_disabled: "Werkzeuge sind deaktiviert",
    web_search_enabled: "Websuche ist erlaubt",
    web_search_disabled: "Websuche ist deaktiviert",
    close_panel: "Einstellungen schließen",
    system_prompt_placeholder: "System-Prompt hier eingeben",
    reasoning_effort: {
      title: "Reasoning",
      subtitle: "Legen Sie den Reasoning-Aufwand fest",
      options: {
        none: {
            label: "Aus",
            description: "Reasoning ist deaktiviert"
        },
        off: {
            label: "Aus",
            description: "Reasoning ist deaktiviert"
        },
        on: {
            label: "An",
            description: "Reasoning ist aktiviert"
        },
        minimal: {
            label: "Minimal",
            description: "Minimaler Reasoning-Aufwand",
          },
        low: {
            label: "Niedrig",
            description: "Niedriger Reasoning-Aufwand"
        },
        medium: {
            label: "Mittel",
            description: "Mittlerer Reasoning-Aufwand"
        },
        high: {
            label: "Hoch",
            description: "Hoher Reasoning-Aufwand"
        },
        xhigh: {
            label: "Hoch‌+",
            description: "Hoher Reasoning-Aufwand"
        },
        max: {
            label: "Maximal",
            description: "Maximaler Reasoning-Aufwand"
        }
      }
    },
    audio_title: "Sprachausgabe",
    audio_description: "Stimme und Sprache für den Sprachmodus und das Vorlesen.",
    audio_unavailable: "Die Sprachausgabe ist nicht konfiguriert.",
    label_audio_voice: "Stimme",
    label_audio_language: "Sprache",
    audio_option_auto: "Automatisch",
    audio_language_english: "Englisch",
    audio_language_german: "Deutsch",
    audio_preview: "Stimme anhören",
    audio_preview_stop: "Vorschau stoppen",
    audio_sample_text_en: "Hi, this is how I sound in a conversation.",
    audio_sample_text_de: "Hallo, so klinge ich in einem Gespräch.",
    audio_voice_af_bella: "Bella — US-Englisch, weiblich",
    audio_voice_af_nicole: "Nicole — US-Englisch, weiblich",
    audio_voice_af_sarah: "Sarah — US-Englisch, weiblich",
    audio_voice_am_adam: "Adam — US-Englisch, männlich",
    audio_voice_am_michael: "Michael — US-Englisch, männlich",
    audio_voice_bf_emma: "Emma — UK-Englisch, weiblich",
    audio_voice_bm_george: "George — UK-Englisch, männlich",
    audio_voice_bm_lewis: "Lewis — UK-Englisch, männlich",
    reset_default: "Standard zurücksetzen",
    default: "Standard",
    tools_title: "GWDG-Werkzeuge",
    tools_enable_all: "Alle aktivieren",
    tools_disable_all: "Alle deaktivieren",
    tools_enable_to_configure:
      "Schalte dieses Werkzeug ein, um es zu konfigurieren.",
    tool_details: "Einstellungen für {{name}}",
    chat_settings: "Chat-Einstellungen",
    label_web_search: "Websuche",
    label_image_generation: "Bildgenerierung",
    label_image_modification: "Bildbearbeitung",
    label_image_analysis: "Bilder analysieren",
    label_audio_generation: "Audiogenerierung",
    label_arcana_tools: "Arcana Tools",
    label_arcana: "Arcana",
    label_mcp_server: "MCP-Server",
    label_write_access: "Schreiben erlauben",
    label_browser_storage: "Browserspeicher",
    label_create_docx: "Word-Dokument",
    tools_requires_browser_storage: "Zuerst den Browserspeicher aktivieren oder einen lokalen Ordner freigeben",
    tools_requires_workspace: "Zuerst einen Arbeitsbereich verknüpfen",
    tools_agent_unavailable: "Im Agentenmodus nicht verfügbar",
    label_tool_limit: "Werkzeugaufrufe pro Antwort begrenzen",
    tool_limit_hint: "Maximale Werkzeugaufrufe pro Antwort; gemeinsam ausgeführte Aufrufe zählen einmal",
    tools_agent_external: "Dieses Modell läuft ohne Werkzeuge",
    model_no_tools_warning:
      "Dieses Modell unterstützt keine Werkzeuge. Der Chat läuft ohne Dateizugriff, Websuche oder MCP-Werkzeuge.",
    placeholder_arcana_id: "Arcana-ID",
    placeholder_mcp_id: "Server-ID",
    placeholder_mcp_url: "http://localhost:3000/mcp",
    placeholder_mcp_auth: "Authorization-Header (optional)",
    mcp_add: "MCP-Server hinzufügen",
    mcp_remove: "Server entfernen",
    mcp_test: "Testen Sie den Server über eine direkte Verbindung von Ihrem Computer aus",
    mcp_test_success: "{{name}} ist erreichbar ({{count}} Werkzeuge).",
    mcp_test_failed: "MCP-Test fehlgeschlagen: {{error}}",
    mcp_test_invalid_url: "Bitte geben Sie zuerst eine gültige MCP-Server-URL ein.",
    mcp_toggle: "Diesen Server verwenden",
    mcp_gateway_first: "Ohne Agentenmodus wird nur der erste Server verwendet, als Gateway-Server-ID.",
  },

  // Conversation
  conversation: {
    meta_tokens: "Token",
    meta_cost: "Kosten",
    local_tools: "Browser & lokale Werkzeuge",
    mount_folder: "Lokalen Ordner teilen",
    folder_mounted: "Ordner für den Assistenten unter {{path}} verfügbar",
    tool_failed: "fehlgeschlagen",
    codemode_running: "Code wird ausgeführt…",
    codemode_output: "Code-Ausgabe",
    close_chat: "Chat schließen",
    speech_mode_title: "Sprachgespräch",
    speech_mode_button: "Sprachgespräch starten",
    speech_mode_close: "Sprachgespräch beenden",
    speech_mode_listening: "Ich höre zu",
    speech_mode_capturing: "Ich höre zu",
    speech_mode_thinking: "Ich denke nach",
    speech_mode_speaking: "Ich spreche",
    speech_mode_error: "Sprachmodus benötigt Aufmerksamkeit",
    speech_mode_hint_listening: "Sprechen Sie einfach. Wenn Sie pausieren, sende ich die Nachricht.",
    speech_mode_hint_capturing: "Pausieren Sie am Ende oder senden Sie jetzt.",
    speech_mode_hint_interrupt: "Sprechen Sie jederzeit, um zu unterbrechen.",
    speech_mode_hint_error: "Prüfen Sie den Mikrofonzugriff und versuchen Sie es erneut.",
    speech_mode_hint_start: "Mikrofon ist aktiv",
    speech_mode_send_now: "Jetzt senden",
    speech_mode_interrupt: "Unterbrechen",
    speech_mode_retry: "Erneut versuchen",
    speech_mode_didnt_catch: "Das habe ich nicht verstanden. Bitte versuchen Sie es erneut.",
    speech_mode_output_unavailable: "Die Sprachausgabe ist nicht verfügbar, die Antwort steht aber im Chat.",
    speech_mode_error_insecure: "Mikrofonzugriff erfordert HTTPS oder localhost.",
    speech_mode_error_permission: "Der Mikrofonzugriff wurde verweigert. Erlauben Sie ihn und versuchen Sie es erneut.",
    speech_mode_error_no_microphone: "Es wurde kein Mikrofon gefunden.",
    speech_mode_error_microphone: "Das Mikrofon konnte nicht gestartet werden.",
    speech_mode_error_timeout: "Die Antwort hat zu lange gedauert. Bitte versuchen Sie es erneut.",
    speech_mode_error_conversation: "Diese Unterhaltung ist nicht mehr verfügbar.",
    prompt: {
      placeholder: "Frag mich",
      attach: "Datei anhängen",
      attach_device: "Vom Gerät",
      attach_workspace: "Aus dem Arbeitsbereich",
      attach_media: "Medien anhängen",
      attachments: "Anhänge",
      clear_attachments: "Alle löschen",
    },
    attachment: {
      image_unsupported: "Modell wechseln, um Bilder zu verarbeiten",
      audio_unsupported: "Modell wechseln, um Audio zu verarbeiten",
      file_unsupported: "Nur mit {{filetype}}-Modell nutzbar",
      unprocessed: "Unverarbeitete Datei",
      transcript_of: "Transkript von {{name}}",
      converting: "Wird konvertiert…",
      transcribing: "Wird transkribiert…",
      process_browser: "Im Browser verarbeiten",
      process_server: "Auf dem Server verarbeiten",
      must_process: "Datei muss verarbeitet werden",
      optional_process: "Optional: in Text umwandeln",
    },
    reasoning: "Denkprozess",
    code: "Code",
    code_lines: "{{count}} Zeilen",
    show_code: "Code anzeigen",
    hide_code: "Code ausblenden",
    copy_reasoning: "Denkprozess kopieren",
    reasoning_streaming: "Denkprozess läuft",
    reasoning_streaming_label: "Denke noch",
    reasoning_received_words_one: "{{count}} Wort empfangen",
    reasoning_received_words_other: "{{count}} Wörter empfangen",
    action: "Aktion",
    download_rendered: "Gerendertes Dokument herunterladen",
    html_block: {
      render: "HTML rendern",
      show_code: "Code anzeigen",
    },
    typst_block: {
      render: "Als Typst rendern",
      show_code: "Code anzeigen",
    },
    graphviz_block: {
      render: "Als Graphviz rendern",
      show_code: "Code anzeigen",
    },
    vega_block: {
      render: "Als Vega-Lite rendern",
      show_code: "Code anzeigen",
    },
    chartjs_block: {
      render: "Als Chart.js rendern",
      show_code: "Code anzeigen",
    },
    latex_block: {
      render: "Als LaTeX rendern",
      show_code: "Code anzeigen",
    },
    sources: "Quellen und Referenzen",
    references: "Referenzen",
    empty_message:
      "Ihre Gespräche werden niemals auf unseren Servern gespeichert.",
    fork_empty: "Keine Nachrichten zum Kopieren gefunden.",
    fork_created: "Neue Unterhaltung erstellt.",
    fork_failed: "Unterhaltung konnte nicht kopiert werden.",
    untitled: "Unbenannter Chat",
  },
  // Footer
  footer: {
    help: "Hilfe",
    imprint: "Impressum",
    terms: "Nutzungsbedingungen",
    docs: "Doku",
    privacy: "Datenschutz (ChatAI)",
    faq: "FAQ",
    contact: "Kontakt",
    about: "Über uns",
    copyright: "{{year}} GWDG © Alle Rechte vorbehalten",
    iso_certified: "ISO 27001 Zertifiziert",
  },
  // User Settings Modal
  user_settings: {
    title: "Benutzereinstellungen",
    tabs: {
      navigation_label: "Bereiche der Profileinstellungen",
      profile: {
        label: "Profil",
        title: "Profil",
        description: "Überblick über Ihre Kontodaten.",
      },
      usage: {
        label: "Nutzung",
      },
      advanced: {
        label: "Erweitert",
        title: "Erweiterte Einstellungen",
        description:
          "Darstellungsmodule, die Denkprozess-Anzeige und die erweiterten Bereiche der Seitenleiste.",
      },
      chat: {
        label: "Chat",
        title: "Chat-Einstellungen",
        description:
          "Legen Sie Standards für alle Unterhaltungen auf diesem Gerät fest.",
      },
      memories: {
        label: "Erinnerungen",
        title: "Gespeicherte Erinnerungen",
        description:
          "Prüfen und verwalten Sie die von Chat AI gespeicherten Details.",
      },
      encryption: {
        label: "Verschlüsselung",
        title: "Ende-zu-Ende-Verschlüsselung",
        description:
          "Verwalten Sie die Public Keys verschlüsselungsfähiger Modelle und wählen Sie, welche Modelle sie nutzen.",
      },
      data: {
        label: "Daten",
        title: "Daten und Datenschutz",
        description:
          "Exportieren oder entfernen Sie die in diesem Browser gespeicherten Daten.",
      },
    },
    account: {
      username: "Benutzername",
      email: "E-Mail-Adresse",
    },
    usage: {
      title: "Nutzung",
      description:
        "Überblick über Ihre monatliche Nutzung und das Organisationsbudget.",
      empty: "Für dieses Konto sind keine Nutzungsgrenzen hinterlegt.",
      monthly: "Monatlich",
      total: "Gesamt",
      expand: "Details anzeigen",
      personal: "Persönlich",
      organization: "Organisation",
      personal_monthly: "Persönlich monatlich",
      personal_total: "Persönlich gesamt",
      organization_monthly: "Organisation monatlich",
      organization_total: "Organisation gesamt",
      resets_at: "Zurücksetzung {{time}}",
      rate_limits: {
        "10s": "10 s",
        hourly: "Stündlich",
        daily: "Täglich",
        monthly: "Monatlich",
      },
      sections: {
        budget: "Budget",
        rate_limits: "Ratenlimits",
        requests: "Anfragen",
      },
      scopes: {
        external: "Extern",
        internal: "Intern",
      },
    },
    monthly_usage: "Monatliche Nutzung",
    org_usage: "Nutzung des Organisationsbudgets",
    sidebar_usage: {
      label: "Nutzung in der Seitenleiste anzeigen",
      description:
        "Ihre aktuelle Nutzung bleibt beim Chatten in der Seitenleiste sichtbar.",
    },
    chat_preferences: {
      title: "Chat-Einstellungen",
      description:
        "Diese Einstellungen gelten für alle Unterhaltungen auf diesem Gerät.",
      memory: {
        label: "Erinnerungen",
        description:
          "Legen Sie fest, wie Chat AI Ihre gespeicherten Erinnerungen verwendet.",
        help_label: "Mehr über Erinnerungen erfahren",
        options: {
          none: {
            label: "Keine",
            description: "Gespeicherte Erinnerungen werden nicht verwendet.",
          },
          recall: {
            label: "Abrufen",
            description:
              "Gespeicherte Erinnerungen werden für persönlichere Antworten verwendet.",
          },
          learn: {
            label: "Lernen",
            description:
              "Erinnerungen werden verwendet und um relevante neue Details ergänzt.",
          },
        },
      },
      suggestions: {
        label: "Folgevorschläge anzeigen",
        description:
          "Zeigt nach jeder Antwort passende Vorschläge zum Fortsetzen des Chats.",
        title_once: {
          label: "Titel nur bei der ersten Anfrage festlegen",
          description:
            "Den Gesprächstitel nur einmal, aus der ersten Anfrage, generieren.",
        },
      },
      summaries: {
        label: "Zusammenfassungen beim Darüberfahren anzeigen",
        description:
          "Beim Verlassen eines Chats wird eine kurze Zusammenfassung erstellt und beim Darüberfahren mit der Maus in der Seitenleiste angezeigt.",
      },
      sidebar: {
        advanced: {
          label: "Erweiterter Modus",
          description:
            "Zeigt Agenten und MCP-Server in der Seitenleiste. Ausgeschaltet zeigt die Seitenleiste nur Chats und Arbeitsbereiche.",
        },
      },
      messages: {
        timestamps: {
          label: "Zeitstempel für Nachrichten anzeigen",
          description:
            "Zeigt Datum und Uhrzeit unter jeder Nachricht an, zu der sie gesendet wurde.",
        },
      },
      submission: {
        label: "Nachricht senden mit",
        options: {
          enter: {
            label: "Enter",
            description:
              "Enter sendet die Nachricht. Umschalt+Enter fügt einen Zeilenumbruch ein.",
          },
          shift_enter: {
            label: "Umschalt+Enter",
            description:
              "Umschalt+Enter sendet die Nachricht. Enter fügt einen Zeilenumbruch ein. Dies ist die Standardeinstellung auf mobilen Geräten.",
          },
        },
      },
      html_render: {
        label: "HTML-Blöcke rendern",
        description:
          "Legt fest, wie HTML-Blöcke in Antworten standardmäßig angezeigt werden.",
        options: {
          render: {
            label: "Rendern",
            description:
              "HTML-Blöcke als Live-Inhalt rendern. Pro Block kann weiterhin auf den Code gewechselt werden.",
          },
          code: {
            label: "Code",
            description:
              "HTML-Blöcke standardmäßig als Code anzeigen. Pro Block kann weiterhin gerendert werden.",
          },
          off: {
            label: "Aus",
            description:
              "HTML-Blöcke nicht automatisch rendern. Sie werden zunächst als Code angezeigt; pro Block kann weiterhin gerendert werden.",
          },
        },
        external_references: {
          label: "Externe Referenzen laden",
          description:
            "Erlaubt HTML-Blöcken, Bilder und Links von externen Hosts zu laden. Standardmäßig aus: Ist die Option deaktiviert, werden externe Referenzen entfernt, sodass der Browser nur diesen Server kontaktiert.",
        },
        sanitization: {
          label: "Bereinigung",
          description:
            "Legt fest, wie streng HTML-Blöcke vor dem Rendern bereinigt werden.",
          options: {
            strict: {
              label: "Streng",
              description:
                "Blockiert interaktive und scriptfähige HTML-Elemente (Buttons, Formulare, Iframes, Skripte, Inline-Styles). Am sichersten für unvertraute Inhalte.",
            },
            relaxed: {
              label: "Gelockert",
              description:
                "Erlaubt interaktives HTML mit JavaScript (Buttons, Formulare, Iframes, Skripte, Inline-Styles). Warnung: Modellausgaben können Code ausführen – nur aktivieren, wenn die Quelle vertrauenswürdig ist.",
            },
          },
        },
      },
      rendering: {
        label: "Darstellung",
      },
      typst: {
        label: "Typst-Blöcke rendern",
        description:
          "Legt fest, ob Typst-Codeblöcke standardmäßig gerendert werden. Pro Block kann weiterhin zwischen Darstellung und Code gewechselt werden.",
      },
      latex: {
        label: "LaTeX-Blöcke rendern",
        description:
          "Legt fest, ob LaTeX-Codeblöcke standardmäßig gerendert werden. Pro Block kann weiterhin zwischen Darstellung und Code gewechselt werden.",
      },
      graphviz: {
        label: "Graphviz-Diagramme rendern",
        description:
          "Rendert ```dot- und ```graphviz-Blöcke lokal. Beim ersten Rendern wird die Graphviz-Engine (etwa 1,4 MB) nach Ihrer Bestätigung heruntergeladen.",
      },
      vega: {
        label: "Vega-Lite-Diagramme rendern",
        description:
          "Rendert ```vega-lite- und ```vega-Blöcke lokal. Externe Daten-URLs bleiben blockiert, solange externe Referenzen nicht aktiviert sind.",
      },
      chartjs: {
        label: "Chart.js-Diagramme rendern",
        description:
          "Rendert ```chart- und ```chartjs-Blöcke lokal aus einer Chart.js-JSON-Konfiguration.",
      },
      reasoning_streaming: {
        label: "Denkprozess beim Streamen geschlossen halten",
        description:
          "Hält die Denkprozess-Box während des Streamings geschlossen und zeigt stattdessen einen kleinen bewegten Aktivitätspunkt. Klicken Sie auf die Kopfzeile, um sie während des Streamings zu öffnen; nach der Antwort können Sie sie ebenfalls öffnen.",
      },
      document_conversion: {
        label: "Dokumentkonvertierung",
        options: {
          server: {
            label: "Nur Server",
            description:
              "Angehängte PDF- und DOCX-Dateien immer auf dem Server verarbeiten.",
          },
          browser: {
            label: "Nur Browser",
            description:
              "Angehängte PDF- und DOCX-Dateien immer lokal im Browser verarbeiten.",
          },
          choice: {
            label: "Nach Wahl",
            description:
              "Legen Sie für jedes Dokument fest, ob es im Browser oder auf dem Server verarbeitet wird.",
          },
        },
      },
    },
    default_model: {
      title: "Standardmodell",
      current: "Aktuell: {{currentModel}}",
      description: "Wählen Sie das Standardmodell für neue Gespräche aus.",
      list_label: "Verfügbare Standardmodelle",
    },
    timeout: {
      title: "Wartezeit für Antworten",
      description: "Bestimmen Sie, wie lange auf KI-Antworten gewartet wird.",
      seconds: "Wartezeit (Sekunden)",
      seconds_short: "Sek.",
      range: "Bereich: 5-900 Sekunden",
    },
    data: {
      title: "Daten verwalten",
      description:
        "Exportieren Sie eine Kopie Ihrer lokalen Daten oder entfernen Sie Unterhaltungen, Erinnerungen, Einstellungen und Anhänge dauerhaft aus diesem Browser.",
      export_success: "Lokale Daten wurden erfolgreich exportiert.",
      export_error: "Lokale Daten konnten nicht exportiert werden.",
      storage_title: "Browserspeicher",
      storage_unavailable: "Speicherinformationen sind in diesem Browser nicht verfügbar.",
      storage_persisted:
        "Dauerhafter Speicher ist aktiviert. Der Browser sollte Ihre Chats bei knappem Speicher behalten.",
      storage_not_persisted:
        "Dauerhafter Speicher ist nicht aktiviert. Der Browser kann lokale Chats bei knappem Speicher oder längerer Inaktivität entfernen. Exportieren Sie regelmäßig eine Sicherung.",
      storage_usage: "{{used}} von {{quota}} belegt.",
      storage_request: "Dauerhaften Speicher anfordern",
      storage_requesting: "Wird angefordert…",
      storage_request_granted:
        "Dauerhafter Speicher wurde gewährt. Der Browser sollte Ihre Chats bei knappem Speicher behalten.",
      storage_request_denied:
        "Der Browser hat dauerhaften Speicher nicht aktiviert. Chrome gewährt dies nur installierten Apps oder regelmäßig genutzten Seiten; Firefox fragt möglicherweise nach einer Berechtigung. Details stehen in der Browserkonsole.",
      storage_request_unsupported:
        "Dieser Browser unterstützt das Anfordern dauerhaften Speichers nicht.",
      storage_request_failed: "Anfordern von dauerhaftem Speicher fehlgeschlagen: {{error}}",
    },
    clear_data_button: "Alle lokalen Daten löschen",
    import_data_button: "Daten importieren",
    export_data_button: "Daten exportieren",
    memory: {
      title: "Erinnerungen",
      description:
        "Verwalten Sie Ihre persönlichen Erinnerungen, die der KI helfen, wichtige Details über Sie zu behalten. Sie haben derzeit {{count}} Erinnerungen gespeichert.",
      manage: "Erinnerungen verwalten",
      groups: {
        title: "Erinnerungsgruppen",
        description:
          "Gruppieren Sie Erinnerungen wie Ordner. Die Standardgruppe wird verwendet, sofern in einem Chat keine andere Gruppe ausgewählt ist.",
        default_name: "Standard",
        default_label: "Standardgruppe",
        default_badge: "Standard",
        name_placeholder: "Name der neuen Gruppe",
        add: "Hinzufügen",
        rename: "Gruppe umbenennen",
        delete: "Gruppe löschen",
      },
    },
    logout: "Abmelden",
  },
  // Import Persona Modal
  persona: {
    selectPersona: "Persona auswählen",
    browsePersonas: "KI-Personas durchsuchen und importieren",
    personas: "Personas",
    back: "Zurück",
    errorLoading: "Fehler beim Laden der Personas",
    retry: "Erneut versuchen",
    noPersonas: "Keine Personas in diesem Ordner gefunden",
    configuration: "Persona-Konfiguration",
    folder: "Ordner",
    createOwn: "Eigene erstellen",
    importFromClipboard: "Aus Zwischenablage",
    importFromClipboardErrorInvalidJson:
      "Import aus Zwischenablage fehlgeschlagen. Kein gültiges JSON gefunden.",
    importFromClipboardErrorInvalidPersona:
      "Import aus Zwischenablage fehlgeschlagen. Ungültige Persona-Daten.",
    personaLibrary: "Persona-Bibliothek",
    categories: "Kategorien",
    quickImport: "Schnellimport",
    selectFolder: "Keine Kategorie ausgewählt",
    selectFolderDescription:
      "Wählen Sie eine Kategorie aus der Seitenleiste, um Personas anzuzeigen",
    emptyFolder: "Dieser Ordner ist leer",
    categoryCount: "{{folders}} Kategorien • {{files}} Personas",
    chat_label: "Persona-Chat",
    category_label: "Kategorie",
    startChat: "Chat starten",
    startChatWith: "Chat mit {{title}} starten",
    startingChat: "Wird gestartet…",
    startError: "Diese Persona konnte nicht geladen werden. Bitte versuchen Sie es erneut.",
  },
  // Memory Modal
  memory: {
    userMemory: "Erinnerungen",
    userMemoryGroup: "Erinnerungen (Gruppe: {{group}})",
    memoryCount_one: "{{count}} Erinnerung gespeichert",
    memoryCount_other: "{{count}} Erinnerungen gespeichert",
    addNew: "Neue Erinnerung hinzufügen",
    add: "Hinzufügen",
    savedMemories: "Gespeicherte Erinnerungen",
    deleteAll: "Alle löschen",
    noMemories: "Noch keine Erinnerungen gespeichert.",
    addFirst: "Fügen Sie oben Ihre erste Erinnerung hinzu!",
    save: "Speichern",
    cancel: "Abbrechen",
    created: "Erstellt: {{date}}",
    edit: "Bearbeiten",
    delete: "Löschen",
    clearAllTitle: "Alle Erinnerungen löschen",
    clearAllWarning:
      "Sind Sie sicher, dass Sie alle {{count}} Erinnerungen löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden und entfernt dauerhaft alle Ihre gespeicherten Erinnerungen.",
    warningTitle: "Warnung",
    warningText:
      "Sie verlieren alle persönlichen Erinnerungen, die der KI helfen, Ihre Präferenzen und Ihren Kontext zu verstehen. Erwägen Sie, sie zuerst zu exportieren, falls erforderlich.",
    dontShowAgain: "Diese Warnung nicht mehr anzeigen",
    clearAll: "Alle Erinnerungen löschen ({{count}})",
  },
  // Export Conversation Modal
  export_conversation: {
    title: "Exportoptionen",
    json: "JSON-Datei",
    pdf: "PDF-Datei",
    text: "TXT-Datei",
    export: "Exportieren",
    export_settings: "Modell und Optionen einbeziehen",
    export_files: "Dateien einbeziehen",
    export_arcana: "Arcana-Details einbeziehen",
    export_mcp_servers: "MCP-Server einbeziehen",
  },
  // Rename Conversation Modal
  rename_conversation: {
    title: "Chat umbenennen",
    enter_name: "Chat-Titel eingeben",
    alert_empty: "Titel ist erforderlich",
  },
  // Delete Conversation Modal
  delete_conversation: {
    title: "Chat löschen",
    description: "Sind Sie sicher, dass Sie diesen Chat löschen möchten?",
  },
  // Share Settings Modal
  share_settings: {
    description:
      "Mit dieser Funktion wird ein Link erstellt, der Ihr Modell, den Systemprompt und Ihre Einstellungen (einschließlich Tool-Konfiguration) enthält. Jeder Benutzer, der diesen Link öffnet, kann dieselbe Konfiguration in seinen eigenen Unterhaltungen verwenden. Ihr Gesprächsverlauf wird nicht freigegeben.",
    warn_arcana:
      "Warnung: Die Weitergabe von arcana-Details kann die in arcana hochgeladenen Daten gefährden.",
    warn_mcp:
      "Warnung: Die Weitergabe eines MCP-Servers kann dazu führen, dass Eingaben oder Daten beim Einsatz von MCP an diesen Server gesendet werden.",
  },
  // Help modals
  help: {
    title: "Hilfe",
    choiceproposer:
      "Wenn diese Option aktiviert ist, zeigt Chat AI nach jeder Antwort passende Folgevorschläge an. Diese Einstellung gilt für alle Unterhaltungen auf diesem Gerät.",
    arcana:
      "Arcana ist eine einzigartige Funktion unseres Dienstes, die das LLM mit spezialisiertem Wissen ausstattet. Wenn Sie eine gültige Arcana-ID und den entsprechenden Schlüssel eingeben, erhält das LLM Zugriff auf das in dieser Arcana enthaltene Wissen. Dies ermöglicht es dem Modell, Antworten zu generieren, die besser informiert und relevanter für Ihre Bedürfnisse sind. Lassen Sie das Feld für die ID leer, um das Modell ohne spezialisiertes Wissen zu verwenden.",
    mcp: "Bitte geben Sie die URL Ihres MCP (Model Context Protocol) Servers ein (z. B. https://...). Der MCP-Server ist ein Dienst, der der Chat-AI zusätzliche Werkzeuge, Datenquellen oder Verarbeitungskapazitäten bereitstellen kann, die über ihr eingebautes Wissen hinausgehen. Durch die Verbindung mit dem angegebenen MCP-Server kann die KI mit externen Systemen interagieren, aktuelle oder spezialisierte Informationen abrufen und benutzerdefinierte Aufgaben entsprechend den angebotenen Funktionen ausführen.",
    models:
      "Chat AI bietet Zugriff auf eine Palette von state-of-the-art Large Language Models (LLMs), jedes mit eigenen Fähigkeiten und Leistungsmerkmalen. Dies ermöglicht es Ihnen, den Modelltyp auszuwählen, der am besten Ihren Forschungszielen und Anforderungen entspricht.\
      Größere Modelle bieten typischerweise höhere Antwortqualitäten, aber haben aufgrund ihrer erhöhten Komplexität längere Antwortzeiten. Umgekehrt bieten kleinere Modelle schnellere Antwortzeiten, mögen jedoch einige Genauigkeit und Tiefe opfern. Mit der Liste der verfügbaren Modelle können Sie Abwägungen zwischen Antwortqualität und Geschwindigkeit treffen, um Ihren spezifischen Bedürfnissen gerecht zu werden. Für weitere Einzelheiten",
    reasoning:
      "Die Reasoning-Einstellung bestimmt, wie tief das Modell Informationen verarbeitet und analysiert, bevor es eine Antwort generiert. Ein höherer Reasoning-Aufwand bedeutet, dass das Modell mehr Zeit darauf verwendet, den Kontext sorgfältig zu prüfen, mögliche Interpretationen abzuwägen und seinen internen Denkprozess zu verfeinern, um eine präzisere, differenziertere und besser strukturierte Antwort zu erzeugen. Ein niedrigerer Reasoning-Aufwand priorisiert Geschwindigkeit über Tiefe, was zu schnelleren, aber möglicherweise weniger gründlichen Antworten führt. Passen Sie diese Einstellung an, je nachdem, ob Sie schnelle Antworten oder sorgfältig ausgearbeitete, hochwertige Ergebnisse benötigen.",
    memory:
      "Erinnerungen sind eine globale Einstellung für alle Unterhaltungen auf diesem Gerät. 'Keine' verwendet keine gespeicherten Erinnerungen. 'Abrufen' nutzt gespeicherte Erinnerungen für persönlichere Antworten. 'Lernen' speichert zusätzlich relevante neue Details aus Ihren Unterhaltungen. Erinnerungen werden ausschließlich in Ihrem Browser gespeichert.",
    system_prompt:
      "Der Systemprompt ist ein spezieller Befehl oder eine Anweisung, die zu Beginn eines Gesprächs gegeben wird, um den Ton, den Kontext oder die Einschränkungen für unsere Interaktion festzulegen. Damit wird das Verhalten des Modells gelenkt und sichergestellt, dass es auf hilfreiche und angemessene Weise reagiert.",
    temperature:
      "Eine niedrige Temperatur (z. B. 0-1) erzeugt vorhersehbarere und logischere Antworten, während höhere Temperaturen (z. B. über 1) die Möglichkeit kreativerer und unkonventionellerer Antworten erhöhen. Sie können die Temperatureinstellung anpassen, um verschiedene Stufen der Vorhersagbarkeit und Kreativität zu erreichen.",
    tools:
      "Tools sind eine neue und experimentelle Funktion, die darauf ausgelegt ist, die Fähigkeiten von Chat-AI zu erweitern. Sie ermöglichen dem Modell, zusätzliche Aktionen auszuführen oder auf weitere Ressourcen zuzugreifen, um nützlichere, genauere oder spezialisierte Antworten zu liefern. Zu den aktuellen Tools gehören Arcana, Arcana Tools, Websuche, Bild- und Audioerzeugung und MCP-Server. Mit Arcana Tools kann der Assistent Arcana-Sammlungen, ihre Dateien, Indizes und Freigaben verwalten. Da sich diese Funktion noch in Entwicklung befindet, können sich Funktionsumfang und verfügbare Tools im Laufe der Zeit ändern.",
    web_search:
      "Das Websuche-Werkzeug ermöglicht es der KI, aktuelle Informationen aus dem Internet abzurufen, um ihre Antworten zu verbessern. Wenn es aktiviert ist, kann die KI auf Grundlage Ihrer Frage und des gesamten Gesprächsverlaufs Suchanfragen erstellen, diese an eine Suchmaschine (wie z. B. Google) senden und die erhaltenen Ergebnisse nutzen, um genauere und aktuellere Antworten zu geben. Dies ist besonders nützlich bei Themen, bei denen aktuelle oder sich schnell ändernde Informationen wichtig sind.",
    top_p:
      "top_p ist ein Schieberegler von 0 bis 1, der den Gesamtbestand der Wahrscheinlichkeiten anpasst, die für das nächste Token in Betracht gezogen werden. Ein top_p von 0,1 würde bedeuten, dass nur die oberen 10% der kumulativen Wahrscheinlichkeiten berücksichtigt werden. Die Variation von top_p hat einen ähnlichen Effekt auf Vorhersagbarkeit und Kreativität wie die Temperatur.",
  },
  model_selector: {
    change_model: "Modell wechseln",
    docs_hint_text: "Unsicher, welches Modell Sie wählen sollen?",
    docs_hint_link: "Lesen Sie die Modellübersicht.",
    scope_filter: "Modelle filtern",
    scope_all: "Alle Modelle",
    scope_internal: "Nur interne",
    scope_external: "Nur externe",
  },
  // Tour
  tour: {
    welcome_message: "Willkommen bei Chat AI",
    start_tour: "Tour starten",
    skip_tour: "Tour überspringen",
    description:
      "Klicken Sie auf die Schaltfläche unten, um die geführte Tour zu starten und die neue Benutzeroberfläche zu erkunden.",
    prompt: 
      "Geben Sie hier einfach Ihre Nachricht ein, um die Unterhaltung mit Chat AI zu starten. Sie können Dateien anhängen; das Modell wird sie verwenden, sofern der Dateityp unterstützt wird.",
    model:
      "Hier können Sie das Modell auswählen, mit dem Sie chatten möchten. Jedes Modell hat seine eigenen Eigenschaften, Fähigkeiten und Einschränkungen.", 
    sidebar:
      "Hier können Sie Unterhaltungen erstellen, löschen, importieren, exportieren, durchsuchen und zwischen ihnen wechseln. Organisieren Sie Ihre Unterhaltungen in Themen und chatten Sie auf Wunsch mit vordefinierten Personas.",
    settings:
      "Hier können Sie unterhaltungsspezifische Einstellungen wie System-Prompt, Temperatur, Top_p und GWDG-Tools wie Arcana, Bildgenerierung und Websuche anpassen. Tools funktionieren möglicherweise nicht mit allen Modellen.",
    profile:
      "Diese Schaltfläche öffnet Ihr Benutzerprofil, in dem Sie Ihre Einstellungen festlegen, gespeicherte Erinnerungen verwalten sowie Ihre Daten exportieren oder löschen können.",
    interface:
      "In dieser Ecke können Sie das Design und die Sprache von Chat AI wechseln.",
    memory: {
      off: "Memory - None: Chat AI erinnert sich an nichts aus früheren Gesprächen, wie zuvor.",
      recall:
        "Recall: Chat AI kann relevante Erinnerungen über Sie aus früheren Gesprächen nutzen, erinnert sich aber an nichts aus dem aktuellen Gespräch.",
      on: "Learn: Chat AI lernt aktiv Dinge über Sie aus dem aktuellen Gespräch und ruft auch Erinnerungen ab, die sie zuvor gesammelt hat.",
      settings:
        "Sie können Erinnerungen jederzeit im Benutzerprofil-Panel in der oberen rechten Ecke ansehen, hinzufügen, bearbeiten und entfernen. Erinnerungen werden nur lokal in Ihrem Browser gespeichert.",
    },
    back: "Zurück",
    close: "Schließen",
    last: "Fertigstellen",
    next: "Weiter",
    skip: "Überspringen",
  },
  // Alerts and warnings
  alert: {
    mcp_unreachable: "Der MCP-Server {{url}} ist nicht erreichbar. Stellen Sie sicher, dass er läuft, oder schalten Sie ihn in den Werkzeugeinstellungen aus, um fortzufahren.",
    mcp_name_changed_title: "Name des MCP-Servers geändert",
    mcp_name_changed:
      "Der Server unter {{server}} meldet jetzt den Namen \"{{actualName}}\" statt \"{{previousName}}\". Verbinden und den gespeicherten Namen aktualisieren?",
    mcp_name_changed_connect: "Verbinden und aktualisieren",
    folder_access:
      "Der Assistent möchte den lokalen Ordner <strong>{{name}}</strong> wieder verwenden. Nach einem Neuladen muss der Zugriff erneut erlaubt werden.",
    title: "Warning",
    bad_request:
      "Fehlerhafte Anfrage wurde gesendet: Bitte löschen Sie die Konversation, versuchen Sie es innerhalb des Limits erneut, und speichern Sie Ihren Chatverlauf für spätere Zwecke.",
    clear_data:
      "Achtung! Dadurch werden alle Unterhaltungen, Anhänge und lokalen Einstellungen dauerhaft aus diesem Browser gelöscht. Exportieren Sie vorher eine Sicherung, wenn Sie sie noch benötigen. Fortfahren?",
    clear_messages:
      "Sind Sie sicher, dass alle Nachrichten gelöscht werden sollen?",
    clear_agent_history:
      "Verlauf dieses Agenten löschen? Dadurch wird die OpenCode-Sitzung gelöscht und eine neue ohne den bisherigen Kontext gestartet.",
    clear_agent_history_yes: "Verlauf löschen",
    close_chat:
      "Diesen Chat schließen? Er wird aus Ihren Unterhaltungen entfernt.",
    close_chat_yes: "Chat schließen",
    close_agent_session: "Diese Sitzung schließen? Sie wird aus OpenCode entfernt.",
    close_agent_session_yes: "Sitzung schließen",
    close_agent_group_sessions:
      "Alle {{count}} Sitzungen in „{{group}}“ schließen? Laufende Antworten werden unterbrochen und die Sitzungen aus OpenCode entfernt.",
    close_agent_group_sessions_yes: "Alle Sitzungen schließen",
    restore_agent_sessions:
      "Neue Sitzungen auf dem Agent-Server erstellen und den jeweiligen zwischengespeicherten Verlauf in ihre Anweisungen schreiben? Die alten Sitzungen werden nicht wiederhergestellt und der zwischengespeicherte Verlauf wird an den Server dieses Agenten gesendet.",
    restore_agent_sessions_yes: "Sitzungen wiederherstellen",
    regenerate_confirm:
      "Beim Regenerieren werden diese Antwort und alle nachfolgenden Nachrichten gelöscht und die aktuellen Einstellungen angewendet. Dies kann nicht rückgängig gemacht werden. Um diese Unterhaltung zu behalten, verwenden Sie stattdessen „In neuem Chat fortfahren“.",
    regenerate_yes: "Regenerieren",
    fork_confirm:
      "Die Unterhaltung wird bis zu dieser Nachricht in einen neuen Chat kopiert. Die aktuelle Unterhaltung bleibt unverändert, Sie können also eine andere Antwort oder andere Einstellungen ausprobieren, ohne etwas zu verlieren.",
    fork_yes: "Kopie erstellen",
    regenerate_fork: "Kopie",
    regenerate_fork_success: "Chat erfolgreich geforkt",
    regenerate_fork_fail: "Chat konnte nicht geforkt werden.",
    summarize_replace:
      "Dies erstellt einen neuen Chat mit einer Zusammenfassung. Ihr aktueller Chat bleibt unverändert. Fortfahren?",
    summarize_in_progress:
      "Ihre Unterhaltung wird zusammengefasst. Bitte warten Sie, während die Zusammenfassung erstellt wird.",
    no: "Nein, geh zurück",
    yes: "Ja, alles löschen",
    system_prompt_empty: "System-Prompt ist leer. Modell reagiert evtl. nicht.",
    data_security_warning: 
      "Sie verwenden ein externes Modell oder externe Tools. Ihre Nachrichten können außerhalb der GWDG verarbeitet werden. Benutzerdefinierte Einstellungen und GWDG-Tools sind möglicherweise nicht verfügbar. Bitte unterlassen Sie die Eingabe vertraulicher oder personenbezogener Daten.",
    data_security_warning_mpg:
      "Sie verwenden ein externes Modell oder externe Tools. Ihre Nachrichten können außerhalb der GWDG verarbeitet werden. Benutzerdefinierte Einstellungen und GWDG-Tools sind möglicherweise nicht verfügbar. Bitte unterlassen Sie die Eingabe vertraulicher oder personenbezogener Daten. Externe Modelle sind nur nutzbar für wissenschaftliche Beschäftigte für wissenschaftliche Arbeiten, sofern keine personenbezogenen Daten eingegeben werden.",
    data_security_notice: "Ihre Daten werden sicher innerhalb unserer Server verarbeitet. Es werden keine Informationen außerhalb der GWDG übertragen.",
    data_security_notice_e2ee:
      "Ihre Daten werden sicher innerhalb unserer Server verarbeitet. Es werden keine Informationen außerhalb der GWDG übertragen. Dieses Modell ist zusätzlich Ende-zu-Ende verschlüsselt: Ihre Nachrichten werden in diesem Browser versiegelt.",
    arcana_usage:
      "Halten Sie Temperatur auf 0 und top_p auf 0.05 für optimale Arcana-Ergebnisse",
    arcana_create_collection_prefix:
      "Erstellen Sie Ihre eigene Dokumentensammlung",
    arcana_create_collection_link: "hier",
    web_search_usage:
      "PRIVACY WARNUNG: Ihr Verlauf kann an eine Suchmaschine (z. B. Google) gesendet werden",
    mcp_usage:
      "PRIVACY WARNUNG: Ihre Daten können an externe Server gesendet werden.",
    arcana_export:
      "Warnung: Das Exportieren von Arcana-Details in eine Datei kann Ihre privaten Daten gefährden, da sie für andere zugänglich sind.",
    mcp_export:
      "Warnung: Das Exportieren von MCP-Serverdaten in eine Datei kann externe Endpunkte offenlegen und dazu führen, dass Daten an Drittanbieter-Server gesendet werden.",
    model_offline:
      "Das von Ihnen ausgewählte Modell ist derzeit offline. Durch das Anklicken von OK unten startet das Modell und wird in wenigen Minuten online sein. In der Zwischenzeit können Sie gerne ein anderes Modell auswählen.",
    session_expired:
      "Ihre Sitzung ist abgelaufen. Bitte aktualisieren Sie die Webseite.",
    unsent_files:
      "Sie haben Dateien angehängt, die verloren gehen werden. Sind Sie sicher, dass Sie gehen wollen?",
    unprocessed_files:
      "Sie haben eine unverarbeitete Datei. Bitte verarbeiten oder entfernen Sie sie zuerst.",
    migrate_data:
      "Es sieht so aus, als ob Sie eine ältere Version von Chat AI verwenden. Um fortzufahren, müssen Ihre vorherigen Gespräche und Daten aktualisiert werden. Bitte sichern Sie Ihre Daten zuerst, falls erforderlich, und drücken Sie dann auf 'Aktualisieren', um den Prozess zu starten.",
    // Hallucination warning
    hallucination: {
      note1: "Hinweis: Chatbots sind anfällig für",
      note2: "und ihre Antworten sollten nicht als korrekt angesehen werden.",
      note3: "Halluzination",
    },
    // External models
    settings_external:
      "Diese Einstellungen wirken sich nicht auf externe (OpenAI) Modelle aus.",
    import_settings_title: "Importierte Einstellungen prüfen",
    import_settings_intro:
      "Dieser geteilte Einstellungs-Link enthält Optionen, die Teile Ihrer Unterhaltung an externe Dienste senden können. Wählen Sie aus, was importiert werden soll.",
    import_web_search_disclaimer:
      `Wenn die Websuche aktiviert ist, kann die KI auf Grundlage Ihrer Nachricht und des Gesprächsverlaufs Suchanfragen erstellen und diese an eine Suchmaschine (z. B. Google) senden.\n\nErlauben Sie dies nur, wenn Sie damit einverstanden sind, dass Ihre Daten extern verarbeitet werden, und wenn Sie während der aktiven Websuche keine vertraulichen, persönlichen oder sensiblen Informationen teilen.`,
    import_mcp_disclaimer:
      `MCP-Server können außerhalb der GWDG betrieben werden. Wenn aktiviert, kann die KI Daten an konfigurierte MCP-Server senden, um Tool-Anfragen auszuführen.\n\nErlauben Sie dies nur, wenn Sie den konfigurierten MCP-Servern vertrauen und keine vertraulichen, persönlichen oder sensiblen Informationen mit ihnen teilen.`,
    web_search_disclaimer: `Wenn die Websuche aktiviert ist, kann die KI auf Grundlage Ihrer Nachricht und des gesamten Gesprächsverlaufs Suchanfragen erstellen und diese an eine Suchmaschine (z. B. Google) senden, um aktuelle Informationen abzurufen. Dies hilft, genauere und aktuellere Antworten bereitzustellen.\n\nDurch Klicken auf „Ich verstehe“ stimmen Sie zu, dass Ihre Eingaben auf diese Weise verarbeitet werden, und bestätigen, dass Sie während der aktiven Websuche keine vertraulichen, persönlichen oder sensiblen Informationen teilen.`,
  },
  document_panel: {
    resize: "Vorschau skalieren",
    back_to_chat: "Zurück",
  },
  mcp: {
    section_title: "MCP-Server",
    add: "MCP-Server hinzufügen",
    edit_title: "MCP-Server bearbeiten",
    empty: "Noch keine MCP-Server konfiguriert.",
    name_label: "Name",
    name_placeholder: "Mein Dateiserver",
    kind_label: "Verbindung",
    kind_local: "Lokal (Streamable HTTP oder SSE)",
    kind_remote: "GWDG-Gateway",
    kind_local_short: "Lokal",
    kind_remote_short: "GWDG",
    url_label: "Server-URL",
    server_id_label: "Gateway-Server-ID",
    auth_label: "Autorisierung (optional)",
    test: "Verbindung testen",
    remove: "Entfernen",
    options: "MCP-Server-Optionen",
    tooltip: "MCP-Server stellen dem Assistenten über das Model Context Protocol zusätzliche Werkzeuge und Dateien bereit. Lokale Server laufen auf diesem Gerät; GWDG-Server werden über das Gateway erreicht.",
    configured: "Konfigurierte MCP-Server",
    invalid_url: "Ungültige MCP-Server-URL. Bearbeiten Sie den Server, um sie zu korrigieren.",
    status_unchecked: "Nicht getestet – zum Testen klicken",
    status_checking: "Verbindung wird getestet",
    status_ready: "Verbunden",
    status_error: "Nicht erreichbar – zum Wiederholen klicken",
    none_configured: "Fügen Sie zuerst einen Server im Bereich MCP-Server hinzu.",
    group_local: "Lokale MCP-Tools aktivieren",
    group_remote: "GWDG-MCP-Tools aktivieren",
    scan_title: "Nach lokalen MCP-Servern suchen",
    scan_hint:
      "Prüft auf diesem Gerät alle Ports über 5000 auf einen /mcp-Endpunkt und fügt jeden gefundenen Server hinzu. Funktioniert nur, wenn diese App im Browser auf demselben Rechner geöffnet ist.",
    scan_action: "Suchen",
    scan_cancel: "Stopp",
    scan_progress:
      "{{scanned}} von {{total}} Ports geprüft · {{found}} gefunden",
    scan_server_name: "Lokaler MCP-Server (Port {{port}})",
    scan_done: "{{servers}} lokale MCP-Server hinzugefügt.",
    scan_empty: "Kein lokaler MCP-Server auf Ports über 5000 gefunden.",
    scan_failed: "Suche fehlgeschlagen: {{error}}",
  },
  agents: {
    section_title: "Agenten",
    sessions: "Sitzungen",
    new_session: "Neue Sitzung",
    no_sessions: "Noch keine Sitzungen.",
    no_workspace_sessions: "Diesem Arbeitsbereich sind noch keine Sitzungen zugeordnet.",
    unassigned_sessions: "Nicht zugeordnete Sitzungen",
    no_unassigned_sessions: "Jede Sitzung ist einem Arbeitsbereich zugeordnet.",
    sessions_in_workspace: "Sitzungen in {{workspace}}",
    detach_session: "Aus dem Arbeitsbereich entfernen",
    attach_to_workspace: "Einem Arbeitsbereich zuordnen",
    offline_cached:
      "Der Agent ist nicht erreichbar. Angezeigt wird der um {{time}} gespeicherte Verlauf.",
    offline_no_cache:
      "Der Agent ist nicht erreichbar und für diese Sitzung wurde noch kein Verlauf gespeichert.",
    sessions_cached:
      "Der Agent ist nicht erreichbar. Diese Sitzungen stammen aus dem lokalen Cache.",
    sessions_cached_short: "gespeichert",
    restore_sessions_banner_one:
      "Der Agent ist erreichbar, aber 1 zwischengespeicherte Sitzung existiert auf seinem Server nicht mehr. Aus dem lokalen Cache wiederherstellen?",
    restore_sessions_banner_other:
      "Der Agent ist erreichbar, aber {{count}} zwischengespeicherte Sitzungen existieren auf seinem Server nicht mehr. Aus dem lokalen Cache wiederherstellen?",
    restore_sessions_action: "Aus Cache wiederherstellen",
    restore_sessions_busy: "Wird wiederhergestellt…",
    restore_sessions_done_one:
      "{{count}} Sitzung aus dem lokalen Cache wiederhergestellt.",
    restore_sessions_done_other:
      "{{count}} Sitzungen aus dem lokalen Cache wiederhergestellt.",
    restore_sessions_none:
      "Es war kein zwischengespeicherter Verlauf zum Wiederherstellen vorhanden.",
    restored_history:
      "Dieser Verlauf wurde aus dem lokalen Cache in die Anweisungen der Sitzung wiederhergestellt. Der Agent-Server hat dafür noch keine Nachrichten.",
    restore_session_title: "{{name}} (wiederhergestellt)",
    session_missing:
      "Diese Sitzung existiert auf dem Agent-Server nicht mehr und es ist kein zwischengespeicherter Verlauf vorhanden. Löschen Sie den Verlauf, um eine neue Sitzung zu starten.",
    subagent_short: "Sub",
    rename_session: "Sitzung umbenennen",
    close_session: "Sitzung schließen",
    session_options: "Sitzungsoptionen",
    session_renamed: "Sitzung umbenannt",
    session_closed: "Sitzung geschlossen",
    close_group_sessions: "Alle Sitzungen dieser Gruppe schließen",
    group_sessions_closed_one: "1 Sitzung geschlossen.",
    group_sessions_closed_other: "{{count}} Sitzungen geschlossen.",
    group_sessions_failed_one:
      "1 Sitzung konnte nicht geschlossen werden: {{message}}",
    group_sessions_failed_other:
      "{{count}} Sitzungen konnten nicht geschlossen werden: {{message}}",
    session_name_placeholder: "Sitzungsname",
    tooltip: "Remote-Agenten, die auf der GWDG-Infrastruktur laufen.",
    status_ready: "Verbunden und bereit",
    status_working: "Arbeitet",
    status_error: "Verbindungsproblem",
    status_checking: "Verbindung wird geprüft",
    bridge: {
      title: "Arbeitsbereich-Zugriff",
      none: "Keine Arbeitsbereich-Brücke",
      disabled_hint:
        "Aus. Der Agent sieht keine Dateien aus Arbeitsbereichen. Schalten Sie den Zugriff ein, um den Reverse-Proxy für diesen Agenten bereitzustellen.",
      use_workspace: "Für die Brücke verwenden",
      working: "Agenten-Brücke aktiv",
      connecting: "Agenten-Brücke verbindet …",
      not_working: "Agenten-Brücke funktioniert nicht",
      off: "Agenten-Brücke aus",
      unavailable: "Agenten-Brücke nicht verfügbar",
      unavailable_detail: "Kein Brücken-Endpunkt unter {{url}} (HTTP {{status}}).",
      unavailable_hint:
        "Diese Installation bietet keine Agenten-Brücke. Sie wird vom Chat-AI-Dienst back (/bridge/*) oder vom SAIA-Agenten-Dienst (/agents/<id>/bridge) bereitgestellt.",
      offline_hint:
        "Der Browser hat die Verbindung zur Brücke verloren. Sie verbindet sich automatisch neu.",
      disabled_after_failure:
        "Der Zugriff wurde ausgeschaltet, weil die Brücke nicht starten konnte. Schalten Sie ihn wieder ein, um es erneut zu versuchen.",
      needs_workspace:
        "Verknüpfen Sie zuerst einen Arbeitsbereich. Die Brücke stellt nur verknüpfte Arbeitsbereiche bereit.",
      options: "Optionen",
      writable: "Schreiben erlauben",
      writable_hint:
        "Erlaubt dem Agenten, Dateien im verknüpften Arbeitsbereich zu erstellen, zu ändern und zu löschen. Ohne diese Option bleibt der Arbeitsbereich schreibgeschützt.",
      mcp: "Lokale MCP-Werkzeuge",
      mcp_hint:
        "Erlaubt dem Agenten, die MCP-Server dieser Browsersitzung aufzurufen. Deren Ergebnisse und Daten verlassen die App über diese Server.",
      keep_open: "Lassen Sie diesen Tab geöffnet. Arbeitsbereichs- und MCP-Werkzeuge sind nur verfügbar, solange der Browser verbunden ist.",
      tab_warning: "Die Agenten-Brücke benötigt diesen Tab. Arbeitsbereichs- und MCP-Werkzeuge sind möglicherweise nicht verfügbar, bis Sie zurückkehren.",
      start_failed: "Die Arbeitsbereich-Brücke konnte nicht gestartet werden: {{message}}",
    },
    spawn: "Agent starten",
    add_title: "Agent hinzufügen",
    name_label: "Agentenname",
    name_placeholder: "z. B. Recherche-Assistent",
    edit_title: "Agent bearbeiten",
    options: "Agent-Optionen",
    pin_action: "Agenten anheften",
    unpin_action: "Agenten nicht mehr anheften",
    connection_label: "Verbindung",
    mode_service: "GWDG HPC-Agenten-Dienst",
    mode_external: "OpenCode-Server",
    hpc_project_hint: "Wählen Sie eines der HPC-Projekte aus, die Ihnen zur Verfügung stehen.",
    default_name: "OpenCode-Agent",
    service_hint:
      "Der Agenten-Dienst startet für diesen Agenten einen OpenCode-Container und beendet ihn, wenn Sie den Agenten entfernen. Eine Server-URL oder ein Passwort ist nicht nötig.",
    service_unavailable:
      "Der GWDG HPC-Agenten-Dienst ist für Ihr Konto nicht freigeschaltet.",
    service_request_access:
      "Wenn Sie für ein HPC-Konto berechtigt sind, können Sie den Zugang zu diesem Service per Anfrage an support@gwdg.de beantragen.",
    service_checking:
      "Es wird geprüft, ob der GWDG HPC-Agenten-Dienst für Ihr Konto verfügbar ist…",
    service_forced_hint:
      "Im Deployment laufen Agenten über den Agenten-Dienst (SAIA). Direkte OpenCode-Verbindungen sind nur möglich, wenn Chat AI lokal läuft.",
    hpc_project_label: "HPC-Projekt",
    server_url_label: "opencode-Server",
    server_password_label: "Server-Passwort",
    connect_hint:
      "Der Agent verbindet sich mit diesen Zugangsdaten direkt mit Ihrer opencode-serve-Instanz.",
    connect_failed: "Verbindung zum opencode-Server fehlgeschlagen: {{error}}",
    connecting: "Verbinden…",
    add: "Agent hinzufügen",
    empty: "Noch keine Agenten.",
    not_found: "Agent nicht gefunden.",
    remove: "Agent entfernen",
    clear_history: "Agent-Verlauf löschen",
    removed_locally: "Agent lokal entfernt; sein Server war nicht erreichbar oder die Anmeldung ist fehlgeschlagen.",
    service_conflict_removed:
      "Der Agent {{name}} wurde entfernt: Der Agent-Dienst kann ihn nicht mehr ausführen ({{status}}). Fügen Sie einen neuen Agenten hinzu, um fortzufahren.",
    service_conflict_unknown: "unbrauchbarer Zustand",
    workspaces: "Arbeitsbereich",
    workspaces_hint:
      "Verknüpfen Sie diesen Agenten mit Arbeitsbereichen. Der erste verknüpfte Arbeitsbereich wird aktiv, sofern kein anderer ausgewählt ist.",
    workspaces_empty: "Keine Arbeitsbereiche verfügbar.",
    workspace_active: "Aktiv",
    plan: "Plan",
    shell: "Shell",
    shell_tooltip: "Sendet diese Eingabe direkt an das Terminal. Die Ausgabe erscheint im Chat.",
    shell_placeholder: "Shell-Befehl eingeben…",
    shell_running: "Befehl wird ausgeführt…",
    shell_status_running: "Läuft",
    shell_status_done: "Fertig",
    shell_status_failed: "Fehlgeschlagen",
    shell_status_aborted: "Abgebrochen",
    shell_exit: "Exit-Code {{code}}",
    shell_timeout: "Der Shell-Befehl wurde nicht rechtzeitig beendet.",
    shell_copy: "Ausgabe kopieren",
    shell_copied: "Shell-Ausgabe kopiert.",
    shell_abort: "Shell-Befehl abbrechen",
    plan_tooltip: "Wechselt den OpenCode-Agenten zwischen dem Plan-Modus und dem normalen Build-Modus.",
    commands_tooltip: "Führt einen OpenCode-Befehl in dieser Sitzung aus.",
    tools: {
      title: "OpenCode-Werkzeuge",
      tabs: {
        changes: "Änderungen",
        permissions: "Berechtigungen",
        policies: "Richtlinien",
        stats: "Nutzung",
        mcp: "MCP",
        connection: "Verbindung",
        recovery: "Wiederherstellung",
      },
      workspace: "Arbeitsbereich / Git",
      tracked_files: "Verfolgte Dateien",
      export_md: "MD exportieren",
      export_json: "JSON exportieren",
      exported: "Agent-Verlauf exportiert.",
      exported_cached:
        "Agent-Server nicht erreichbar – zwischengespeicherter Verlauf exportiert.",
      export_no_cache:
        "Der Agent-Server ist nicht erreichbar und es ist kein zwischengespeicherter Verlauf vorhanden.",
      recovery_hint:
        "Exporte greifen auf den lokalen Cache zurück, wenn der Agent-Server nicht erreichbar ist. Ein zwischengespeicherter Verlauf kann auch in einer neuen Sitzung wiederhergestellt werden.",
      cache_messages: "Zwischengespeicherte Nachrichten: {{count}}",
      cache_synced: "Zuletzt gespeichert: {{date}}",
      cache_never: "Für diese Sitzung ist noch kein Verlauf gespeichert.",
      restore_action: "In neuer Sitzung wiederherstellen",
      restore_hint:
        "Schreibt den zwischengespeicherten Verlauf in die Anweisungen einer neuen Sitzung.",
      restore_confirm_title: "Neue Sitzung aus dem Cache erstellen?",
      restore_warning:
        "Dies erstellt eine neue Sitzung und schreibt {{size}} des zwischengespeicherten Verlaufs in ihre Anweisungen. Die aktuelle Sitzung bleibt unverändert. Chatdaten werden an den Server dieses Agenten gesendet.",
      restore_cancel: "Abbrechen",
      restore_confirm: "Sitzung erstellen",
      restore_created:
        "Der zwischengespeicherte Verlauf wurde in einer neuen Sitzung wiederhergestellt.",
      restore_empty:
        "Es ist kein zwischengespeicherter Verlauf zum Wiederherstellen vorhanden.",
      restore_session_title: "{{name}} (wiederhergestellter Verlauf)",
      restore_failed: "Die neue Sitzung konnte nicht erstellt werden.",
      policies_hint:
        "Richtlinien beantworten künftige Berechtigungsanfragen dieses Agenten automatisch. Verwenden Sie Platzhalter wie bash* oder * mit Bedacht.",
      policy_action: "Aktionsmuster",
      policy_decision: "Entscheidung",
      policy_once: "Einmal erlauben",
      policy_always: "Immer erlauben",
      policy_reject: "Ablehnen",
      policy_add: "Richtlinie hinzufügen",
      no_policies: "Keine Berechtigungsrichtlinien.",
      test_connection: "Verbindung testen",
      copy_diagnostics: "Diagnose kopieren",
      copied: "Kopiert.",
      no_diagnostics: "Keine Diagnose geladen.",
      mcp_reconnected: "MCP-Server neu verbunden.",
      reconnect: "Neu verbinden",
      unsupported_field: "Nicht unterstütztes Feld: {{field}}",
      working: "Arbeitet…",
      submit: "Senden",
      mcp_synced: "MCP-Server zu OpenCode hinzugefügt.",
      mcp_removed: "MCP-Server aus OpenCode entfernt.",
      reverted: "Sitzung zurückgesetzt.",
      revert: "Bis Nachricht zurücksetzen",
      revert_cleared: "Gestaffelte Rücksetzung verworfen.",
      clear_revert: "Rücksetzung verwerfen",
      no_changes: "Keine Dateiänderungen.",
      no_messages: "Keine Nachrichten verfügbar",
      no_saved_permissions: "Keine gespeicherten Berechtigungen.",
      permission_removed: "Berechtigung entfernt.",
      remove: "Entfernen",
      no_stats: "Keine Statistiken verfügbar.",
      opencode_mcp: "OpenCode-MCP-Server",
      no_mcp: "In OpenCode sind keine MCP-Server konfiguriert.",
      chatai_mcp: "Chat-AI-MCP-Server",
      no_chatai_mcp: "In Chat AI sind keine lokalen MCP-Server konfiguriert.",
      add_to_opencode: "Zu OpenCode hinzufügen",
      added: "Zu OpenCode hinzugefügt",
      mcp_transfer_hint:
        "Beim Hinzufügen werden Name, URL und konfigurierte Header (einschließlich Autorisierung) an den lokalen OpenCode-Server übertragen. Chatdaten werden nicht kopiert.",
    },
    hpc_project: "HPC-Projekt {{n}}",
    remote_hint: "Läuft auf der GWDG-Infrastruktur",
    chat_empty: "Noch keine Nachrichten. Fragen Sie den Agenten etwas.",
    form_result_title: "Formularergebnisse",
    form_submitted: "Gesendet",
    form_yes: "Ja",
    form_no: "Nein",
    form_not_answered: "Nicht beantwortet",
    form_custom_answer: "Eigene Antwort eingeben",
    tool_call: "Werkzeugaufruf",
    tool_input: "Eingabe",
    tool_output: "Ausgabe",
    open_preview: "Vorschau",
    open_preview_of: "Vorschau von {{name}}",
    reasoning: "Denkprozess",
    files: "Dateien",
    search_files: "Dateien durchsuchen",
    search: "Suchen",
    no_search_results: "Keine passenden Dateien.",
    send: "Senden",
    working: "Der Agent arbeitet…",
    package_message: "Nachricht vom Paketbesitzer",
    session_busy: "Dieser Agent arbeitet noch. Warten Sie, bis er fertig ist, oder stoppen Sie ihn, bevor Sie eine weitere Nachricht senden.",
    chat_timeout: "Der Agent hat nicht rechtzeitig geantwortet.",
    aborted_by_user: "Vom Benutzer abgebrochen",
    permission_title: "Berechtigung erforderlich",
    permission_once: "Einmal erlauben",
    permission_always: "Immer erlauben",
    permission_reject: "Ablehnen",
    commands: "Befehle",
    compact_command: "Unterhaltung komprimieren",
  },
  workspace: {
    new_folder: "Neuer Ordner",
    new_file: "Neue Datei",
    upload_file: "Datei hochladen",
    add_file: "Datei hinzufügen",
    upload_success: "{{count}} Datei(en) hochgeladen",
    upload_not_supported: "Diese Quelle unterstützt keine Uploads.",
    create_in: "In {{path}} erstellen",
    folder_name_placeholder: "Ordnername",
    file_name_placeholder: "Dateiname",
    entry_name_invalid: "Namen dürfen keine Schrägstriche enthalten.",
    rename_entry: "Eintrag umbenennen",
    rename_success: "Umbenannt in {{name}}.",
    git_log: "Git-Log",
    git_log_empty: "Keine Git-Log-Einträge gefunden.",
    root_empty_hint: "Erstellen Sie einen Ordner oder eine Datei oder hängen Sie einen Quellordner ein.",
    edit_title: "Arbeitsbereich bearbeiten",
    workspace_options: "Arbeitsbereich-Optionen",
    pin_action: "Arbeitsbereich anheften",
    unpin_action: "Arbeitsbereich nicht mehr anheften",
    workspace_root: "Arbeitsbereich-Stamm",
    tab_preview: "Vorschau",
    tab_agents: "Agenten",
    root_hint: "Dateien und Ordner in diesem Arbeitsbereich.",
    chat_count_one: "{{count}} Chat",
    chat_count_other: "{{count}} Chats",
    empty_title: "Noch keine Chats in diesem Arbeitsbereich",
    empty_body: "Schreiben Sie unten eine Eingabe, um den ersten Chat zu starten.",
    composer_placeholder: "Fragen Sie alles — startet einen neuen Chat in {{name}}",
    files_tab: "Dateien",
    storage: "Speicher",
    available_storage: "Verfügbarer Speicher",
    add_folder: "Ordner hinzufügen",
    clone_repo_url: "URL des öffentlichen Repositories",
    clone_branch: "Branch oder Tag (optional)",
    clone_default_branch: "Standard-Branch",
    clone_folder: "Zielunterordner",
    clone_agent: "Agent für git clone",
    clone_agent_required: "Wählen Sie einen lokalen Agenten zum Klonen aus.",
    clone_configure_agent_soon: "Anderen Agenten konfigurieren (demnächst)",
    clone_remote_agent_soon: "Remote-Agent (demnächst)",
    clone_target: "In Speicher klonen",
    clone_target_browser: "Browser-Speicher",
    clone_target_local: "Lokalen Ordner wählen…",
    clone_target_agent: "Agentenspeicher ({{name}})",
    clone_target_agent_selected: "Agentenspeicher: {{name}}",
    clone_target_local_selected: "Lokaler Ordner: {{name}}",
    clone_target_required: "Wählen Sie einen beschreibbaren Speicher aus.",
    clone_target_missing: "Der gewählte Speicher ist nicht mehr verfügbar.",
    clone_target_exists: "Der Zielunterordner existiert bereits.",
    clone_no_agent: "Es ist kein lokaler OpenCode-Agent konfiguriert. Fügen Sie vor dem Klonen einen lokalen Agenten hinzu.",
    mount_local_hint: "Der gewählte Ordner wird beschreibbar unter seinem Ordnernamen eingebunden.",
    mount_local_action: "Ordner einbinden",
    choose_local_folder: "Lokalen Ordner wählen…",
    clone_prepare: "Klonen und prüfen",
    clone_preparing: "Klon wird vorbereitet…",
    clone_progress_clone: "Repository wird mit dem Agenten geklont…",
    clone_progress_manifest: "Manifest wird gelesen…",
    clone_progress_measure: "Repository wird vermessen…",
    clone_progress_copy: "Repository wird in den Speicher kopiert…",
    clone_progress_files: "{{files}} Dateien werden kopiert · {{size}}",
    clone_progress_agent_storage: "Klon wird im Agentenspeicher behalten…",
    clone_progress_agent: "Agent wird erstellt…",
    clone_progress_chats: "Chats werden erstellt…",
    clone_progress_mount: "Ordner wird eingebunden…",
    clone_applying: "Arbeitsbereich wird eingerichtet…",
    clone_confirm_title: "Repository-Import bestätigen",
    clone_confirm_intro: "Prüfen Sie, was erstellt wird. In Ihren Arbeitsbereich wurde noch nichts kopiert.",
    clone_summary_repo: "Repository",
    clone_summary_workspace: "Arbeitsbereich",
    clone_summary_agent: "Agent",
    clone_summary_chats: "Chats",
    clone_summary_files: "{{files}} Dateien{{size}}",
    clone_manifest_warning: "Das Manifest ist nicht vertrauenswürdiger Repository-Inhalt. Es kann Chats und einen Agenten konfigurieren, aber keine Befehle, Skripte, Zugangsdaten oder Server-URLs vorgeben.",
    clone_manifest_present: "Es wurde ein Arbeitsbereichs-Manifest gefunden. Dieser Klon kopiert nur Repository-Dateien; er erstellt keine Chats oder Agenten.",
    clone_manifest_none: "Es wurde kein Arbeitsbereichs-Manifest gefunden. Es werden nur Repository-Dateien kopiert.",
    clone_browser_hint: "Das Repository wird in den Browserspeicher dieses Arbeitsbereichs kopiert.",
    clone_review_action: "In den Arbeitsbereich kopieren",
    clone_confirm_action: "Arbeitsbereich erstellen",
    clone_new_session: "Neue Sitzung",
    clone_agent_connection: "Agent mit dieser lokalen Verbindung erstellen",
    clone_continue: "Weiter",
    clone_discard: "Verwerfen",
    clone_discarded: "Klonen verworfen.",
    kind_git: "Git-Repository",
    sources_included: "Enthalten",
    source_included_hint:
      "Wird automatisch mit dem Arbeitsbereich erstellt und kann hier nicht entfernt werden.",
    row_pending: "Ausstehend",
    row_working: "Wird ausgeführt…",
    row_done: "Fertig",
    row_failed: "Fehlgeschlagen · {{message}}",
    clone_row_remove: "Quelle entfernen",
    advanced: "Erweitert",
    create_applying: "Arbeitsbereich wird erstellt…",

    mounts: "Ordner",
    no_mounts: "Fügen Sie einen Ordner aus einer Quelle zu diesem Arbeitsbereich hinzu.",
    remove_mount: "Ordner entfernen",
    mount_source: "Quelle",
    mount_source_path: "Ordner in der Quelle",
    mount_parent: "Ordner im Arbeitsbereich",
    make_read_only: "Schreibgeschützt machen",
    make_writable: "Beschreibbar machen",
    make_source_read_only: "Quelle schreibgeschützt machen",
    make_source_writable: "Quelle beschreibbar machen",
    source_read_only_error: "Diese Quelle ist schreibgeschützt.",
    source_read_only: "Schreibgeschützte Quelle",
    source_unavailable: "Diese Quelle ist nicht verfügbar.",
    source_read_only_hint: "Schreib- und Löschvorgänge in dieser Quelle blockieren.",
    mount_read_only_error: "Dieser Einhängepunkt ist schreibgeschützt.",
    cannot_move_mount: "Eingehängte Ordner können nicht verschoben werden.",
    mount_read_only: "Nur lesen",
    mount_read_only_hint: "Keine Änderungen über diesen Einhängepunkt erlauben.",
    folder_picker_up: "Eine Ebene höher",
    folder_picker_loading: "Ordner werden geladen…",
    folder_picker_empty: "Keine Unterordner vorhanden.",
    folder_picker_result: "Wird unter {{path}} eingebunden",
    folder_picker_error: "Ordner konnten nicht geladen werden.",
    mount_source_required: "Wählen Sie eine Quelle.",
    mount_target_folder: "Im Arbeitsbereich gibt es bereits einen Ordner unter {{path}}.",
    mount_target_nonempty: "Der Ordner {{path}} enthält bereits Dateien.",
    mount_target_file: "Unter {{path}} gibt es bereits eine Datei.",
    mount_target_covers: "Der Ordner {{path}} enthält bereits einen eingebundenen Ordner.",
    mount_target_nested: "{{path}} liegt in dem eingebundenen Ordner {{mount}}.",
    mount_target_reserved: "Der Ordner {{path}} ist für Chat-Uploads reserviert.",
    attached_chats: "Chats",
    attached_items: "Verknüpfte Chats, Agenten und Sitzungen",
    no_attached_chats: "Noch keine Chats verknüpft.",
    attach_chat: "Chat verknüpfen",
    attach_chat_error:
      "Der Chat konnte nicht mit dem Arbeitsbereich verknüpft werden",
    attach_session_error:
      "Die Sitzung konnte nicht mit dem Arbeitsbereich verknüpft werden",
    new_chat: "Neuer Chat in diesem Arbeitsbereich",
    detach_chat: "Chat trennen",
    attach_chat_hint: "Verknüpfen Sie einen Chat mit diesem Arbeitsbereich.",
    attach_agent: "Agent verknüpfen",
    attach_agent_hint:
      "Verknüpfen Sie einen Agenten mit diesem Arbeitsbereich. Der Agent kann ihn anschließend als Brücken-Arbeitsbereich verwenden.",
    attach_agent_session: "Sitzung zuordnen",
    attach_agent_session_hint:
      "Wählen Sie die Sitzungen dieses Agenten, die zu diesem Arbeitsbereich gehören. Andere Arbeitsbereiche behalten ihre eigene Liste.",
    no_available_agents: "Keine nicht verknüpften Agenten verfügbar.",
    agents: "Agenten",
    agent: {
      title: "Agent",
      browser_title: "Pi-Agent im Browser",
      browser_description:
        "Läuft im Browser. Keine Shell, kann aber Dateien im Arbeitsbereich lesen und schreiben.",
      opencode_title: "OpenCode-Server",
      opencode_description:
        "Verbinden Sie einen OpenCode-Server über seine Adresse und nutzen Sie ihn mit Chat AI.",
      remote_title: "Remote-Agent",
      remote_description:
        "Der Agent des GWDG-HPC-Agentendienstes, der auch in der Seitenleiste erscheint.",
      choose_existing: "Vorhandenen Agenten wählen",
      add_new: "Neuen Agenten hinzufügen",
      no_agents: "Noch keine Agenten dieser Art.",
      in_use: "In Verwendung",
      available: "Verfügbar",
      back: "Zurück",
    },
    no_attached_agents: "Noch keine Agenten verknüpft.",
    detach_agent: "Agent trennen",
    chat_workspaces: "Arbeitsbereich",
    chat_workspaces_attached_hint:
      "Dieser Chat ist mit {{names}} verknüpft und kann alle Dateien dort nutzen.",
    chat_workspaces_hint: "Verknüpfen Sie diesen Chat mit einem oder mehreren Arbeitsbereichen.",
    chat_workspaces_none: "Noch keine Arbeitsbereiche. Erstellen Sie einen in der Seitenleiste.",
    manage_data: "Daten verwalten",
    manage_data_in: "Daten in {{name}} verwalten",
    manage_data_workspace_hint:
      "Dieser Chat ist mit mehreren Arbeitsbereichen verknüpft. Öffnen Sie einen, um seine Dateien zu verwalten.",
    access_storage: "Auf Speicher zugreifen",
    access_storage_hint:
      "Das Modell darf die Dateien dieses Chats und seiner verknüpften Arbeitsbereiche lesen. In diesem Chat darf es immer schreiben; für einen verknüpften Arbeitsbereich gibt es den Schalter darunter.",
    access_storage_off_hint:
      "Das Modell erhält keine Dateiwerkzeuge. Anhänge werden weiterhin in die Nachricht aufgenommen, sofern ihr Text lesbar ist.",
    workspace_write_access_hint:
      "Das Modell darf Dateien in den verknüpften Arbeitsbereichen ändern.",
    chat_files: "Dateien in diesem Chat",
    chat_files_hint:
      "Nur in diesem Browser für diesen Chat gespeichert. Das Modell schreibt hier, wenn kein Arbeitsbereich verknüpft ist.",
    settings_title: "Lokaler Agent",
    attach_from_workspace: "Aus Arbeitsbereich anhängen",
    attach_from_workspace_hint:
      "Wählen Sie eine Datei aus einem verknüpften Arbeitsbereich und fügen Sie sie dieser Nachricht hinzu.",
    attach_from_workspace_loading: "Dateien werden geladen…",
    open_workspace: "Arbeitsbereich öffnen",
    sidebar_title: "Arbeitsbereich",
    new_workspace: "Neuer Arbeitsbereich",
    empty_sidebar_title: "Arbeitsbereich erstellen",
    create_title: "Arbeitsbereich erstellen",
    name_label: "Name des Arbeitsbereichs",
    name_placeholder: "z. B. Recherche",
    create_workspace: "Arbeitsbereich erstellen",
    create_tree_title: "Arbeitsbereich",
    create_add: "Zum Arbeitsbereich hinzufügen",
    create_empty_hint:
      "Noch nichts hinzugefügt – wähle links einen Ordner oder ein Repository.",
    create_sources_hint:
      "Wähle einen Ordner oder klone ein Repository – er erscheint im Arbeitsbereich.",
    name_required: "Geben Sie einen Namen ein",
    name_prompt: "Wählen Sie einen Namen für Ihren Arbeitsbereich",
    name_taken: "Ein Arbeitsbereich mit diesem Namen existiert bereits",
    create_error: "Der Arbeitsbereich konnte nicht erstellt werden",
    not_found: "Arbeitsbereich nicht gefunden",
    files_title: "Arbeitsbereich-Dateien",
    storage_browser_private: "Privat für diesen Arbeitsbereich",
    repositories: "Repositories",
    repositories_count_one: "{{count}} Repository",
    repositories_count_other: "{{count}} Repositories",
    storage_mcp_servers: "MCP-Server",
    connect_mcp: "MCP-Server verbinden",
    clone_repository: "Repository klonen",
    mcp_transport_streamable_http: "Streamable HTTP",
    mcp_transport_sse: "SSE",
    delete_workspace: "Arbeitsbereich löschen",
    delete_confirm:
      "Diesen Arbeitsbereich löschen? Quellenliste und Übertragungsverlauf werden entfernt. Gerätedateien bleiben auf diesem Gerät; Arcana-Dateien bleiben in ihrer Sammlung.",
    delete_error: "Der Arbeitsbereich konnte nicht gelöscht werden",
    sources: "Quellen",
    source_browser: {
      title: "Speicherorte",
      source_broken: "„{{name}}“ funktioniert gerade nicht.",
      source_needs_permission:
        "„{{name}}“ hat die Zugriffsberechtigung verloren — öffne sie und erlaube den Zugriff erneut.",
      source_unreachable:
        "„{{name}}“ ist nicht erreichbar — der Dienst antwortet gerade nicht.",
      source_error_detail: "„{{name}}“ konnte nicht geöffnet werden: {{detail}}",
      device: "Dieses Gerät",
      chats: "Browser",
      arcanas: "Arcanas",
      mcp: "MCP",
      add_to_workspace: "Zum Arbeitsbereich hinzufügen",
      add_to_workspace_count: "Zum Arbeitsbereich hinzufügen ({{count}})",
      unmount: "Aushängen",
      unmount_count: "Aushängen ({{count}})",
      unmount_hint:
        "Diesen Ordner vollständig aus Chat AI entfernen — alle Arbeitsbereiche nutzen ihn nicht mehr und er verschwindet aus dieser Liste. Du kannst ihn jederzeit wieder hinzufügen.",
      selected_one: "{{count}} ausgewählt",
      selected_many: "{{count}} ausgewählt",
      empty: "Hier ist noch nichts",
      loading: "Wird geladen...",
      unavailable: "Diese Quelle ist nicht verfügbar.",
      back: "Zurück",
      select_all: "Alle auswählen",
      clear: "Auswahl aufheben",
      add_device_folder: "Ordner von diesem Gerät hinzufügen",
      device_empty_title: "Hier ist noch nichts.",
      device_empty_body:
        "Ziehe einen Ordner hierher oder klicke, um einen von diesem Gerät einzubinden.",
      device_drop_rejected:
        "Der abgelegte Eintrag war kein Ordner. Klicke, um einen Ordner von diesem Gerät einzubinden.",
      in_workspace: "Im Arbeitsbereich",
      untitled_chat: "Unbenannter Chat",
      pick_source: "Wählen Sie links eine Quelle, um ihre Dateien zu durchsuchen.",
      added: "{{count}} Elemente hinzugefügt",
      added_one: "{{count}} Element hinzugefügt",
      added_other: "{{count}} Elemente hinzugefügt",
      add_failed: "{{count}} Elemente konnten nicht hinzugefügt werden",
      add_failed_one: "{{count}} Element konnte nicht hinzugefügt werden",
      add_failed_other: "{{count}} Elemente konnten nicht hinzugefügt werden",
      adding_progress: "{{done}} von {{total}} werden hinzugefügt…",
      folders_one: "{{count}} Ordner",
      folders_other: "{{count}} Ordner",
      chats_count_one: "{{count}} Chat",
      chats_count_other: "{{count}} Chats",
      collections_one: "{{count}} Sammlung",
      collections_other: "{{count}} Sammlungen",
      servers_one: "{{count}} Server",
      servers_other: "{{count}} Server",
      usage: "{{used}} von {{quota}} belegt",
      chat_usage: "{{used}} von {{quota}} belegt — mit dieser App geteilt",
    },
    storage_badge_browser: "Browser",
    storage_badge_device: "Gerät",
    storage_badge_arcana: "Arcana",
    storage_badge_mcp: "MCP",
    storage_badge_agent: "Agent",
    add_source: "Quelle hinzufügen",
    source_kind: "Quellentyp",
    choose_folder: "Ordner auswählen…",
    no_sources: "Fügen Sie einen lokalen Ordner, ein Git-Repository oder einen MCP-Server hinzu.",
    select_source: "Wählen Sie eine Quelle, um ihre Dateien zu durchsuchen.",
    source_label: "Bezeichnung",
    source_folder: "Ordner",
    choose_folder_required: "Wählen Sie zuerst einen Ordner.",
    no_folder_chosen: "Noch kein Ordner ausgewählt.",
    source_browser_label: "Browserspeicher",
    kind_browser: "Browser",
    kind_local: "Lokaler Ordner",
    kind_agent: "Agent-Dateisystem",
    kind_chat: "Chat-Ordner",
    kind_arcana: "Arcana",
    "kind_arcana-filesystem": "Arcana-Dateisystem",
    kind_mcp: "MCP",
    local_hint:
      "Der Browser fragt nach Zugriff auf den Ordner. Der Ordner bleibt auf diesem Gerät und wird nie hochgeladen.",
    local_unsupported: "Dieser Browser kann keine lokalen Ordner öffnen.",
    local_insecure:
      "Lokale Ordner brauchen eine sichere Seite: https:// oder http://localhost.",
    local_aborted:
      "Kein Ordner übernommen. Falls kein Dialog erschien, hat Chrome den Ordner-Dialog blockiert oder der Datei-Dialog des Systems ließ sich nicht öffnen. Prüfe die Website-Berechtigung zum Bearbeiten von Dateien und wähle einen normalen Projektordner, nicht das gesamte Benutzer- oder Download-Verzeichnis.",
    mcp_endpoint: "MCP-Endpunkt",
    mcp_transport: "Transport",
    mcp_allowlist: "Tool-Allowlist (kommagetrennt, optional)",
    mcp_hint:
      "Verwenden Sie einen MCP-Server mit streamable-HTTP oder SSE und CORS-Headern. Es werden nur die angebotenen Datei-Tools genutzt.",
    mcp_required: "Geben Sie einen MCP-Endpunkt ein",
    device_only_hint: "Diese Quelle ist nur auf diesem Gerät verfügbar.",
    device_only: "Nur dieses Gerät",
    unavailable_on_device: "Auf diesem Gerät nicht verfügbar",
    reconnect: "Ordner neu verbinden",
    status_error: "Fehler",
    root: "Stamm",
    retry: "Erneut versuchen",
    refresh: "Aktualisieren",
    empty_folder: "Dieser Ordner ist leer.",
    drop_hint: "Dateien hier ablegen, um sie in diese Quelle zu kopieren.",
    load_more: "Mehr laden",
    select_all: "Alle auswählen",
    clear_selection: "Auswahl aufheben",
    selected_count_one: "{{count}} Element ausgewählt",
    selected_count_other: "{{count}} Elemente ausgewählt",
    download: "Herunterladen",
    preview_too_large: "Diese Datei ist zu groß für die Vorschau.",
    preview_unavailable: "Für diesen Dateityp gibt es keine Vorschau.",
    remove_source: "Quelle entfernen",
    remove_source_confirm:
      "Diese Quelle aus dem Arbeitsbereich entfernen? Die Dateien selbst werden nicht gelöscht.",
    transfer_title: "Dateien übertragen",
    transfer_summary:
      "{{strategy}} {{count}} Element(e) ({{size}}) von {{from}} nach {{to}}?",
    transfer_move_note:
      "Das Original wird erst gelöscht, nachdem die Kopie geprüft wurde.",
    transfer_copy_note: "Das Original bleibt in der Quelle.",
    transfer_move: "Verschieben",
    transfer_copy: "Kopieren",
    move_to: "Verschieben nach…",
    move_selection_hint_one:
      "Das ausgewählte Element in eine andere Quelle verschieben? Das Original wird erst nach der Prüfung der Kopie gelöscht.",
    move_selection_hint_other:
      "Die {{count}} ausgewählten Elemente in eine andere Quelle verschieben? Das Original wird erst nach der Prüfung der Kopie gelöscht.",
    delete_file_confirm:
      "Diese Datei löschen? Dies kann nicht rückgängig gemacht werden.",
    delete_folder_confirm:
      "Diesen Ordner mit dem gesamten Inhalt löschen? Dies kann nicht rückgängig gemacht werden.",
    delete_selection_confirm_one:
      "Das ausgewählte Element löschen? Dies kann nicht rückgängig gemacht werden.",
    delete_selection_confirm_other:
      "Die {{count}} ausgewählten Elemente löschen? Dies kann nicht rückgängig gemacht werden.",
    delete_success: "„{{name}}“ gelöscht.",
    delete_selection_success_one: "{{count}} Element gelöscht.",
    delete_selection_success_other: "{{count}} Elemente gelöscht.",
    move_to_hint: "„{{name}}“ in eine andere Quelle verschieben? Das Original wird erst nach der Prüfung der Kopie gelöscht.",
    move_to_target: "Zielquelle",
    move_to_no_targets: "Fügen Sie zuerst eine weitere Quelle hinzu.",
    transferring: "Übertrage…",
    transfer_success_one: "{{count}} Element übertragen.",
    transfer_success_other: "{{count}} Elemente übertragen.",
    transfer_blocked: "Diese Übertragung kann nicht gestartet werden.",
  },

  // Landing page
  landing: {
    title: "Sie sind nicht angemeldet",
    description: "Bitte melden Sie sich an, um Chat AI zu verwenden.",
    reasonsTitle: "Sie können sich anmelden, wenn Sie:",
    reasons: {
      deleted:
        "• Mitglied einer deutschen Universität oder Forschungseinrichtung sind",
      outdatedLink: "• Mitglied einer Organisation im DFN sind",
      incorrectId: "• ein registrierter Benutzer in AcademicCloud sind",
      historyCleared: "• von der GWDG Zugriff gewährt wurde",
    },
    reassurance: "Verwenden Sie einfach den Button unten, um sich anzumelden.",
    buttonText: "Anmelden mit AcademicCloud SSO",
  },
  not_found: {
    title: "404: Unterhaltung nicht gefunden",
    description:
      "Ups! Sie versuchen auf eine Unterhaltung zuzugreifen, die in Ihrem Chatverlauf nicht existiert.",
    reasonsTitle: "Dies kann folgende Gründe haben:",
    reasons: {
      deleted: "• Die Unterhaltung wurde gelöscht",
      outdatedLink: "• Sie verwenden einen veralteten oder ungültigen Link",
      incorrectId: "• Die Unterhaltungs-ID in der URL ist falsch",
      historyCleared: "• Ihr Chatverlauf wurde gelöscht",
    },
    reassurance:
      "Keine Sorge! Sie können eine neue Unterhaltung starten, indem Sie auf den Button unten klicken.",
    buttonText: "Zum Chat gehen",
  },
  file_preview: {
    no_file: "Keine Datei zur Vorschau",
    no_data: "Keine Daten verfügbar",
    no_content: "Kein Inhalt verfügbar",
    unsupported: "Nicht unterstützter Dateityp",
    error: "Fehler: {{message}}",
    error_display: "Fehler beim Anzeigen des Inhalts: {{message}}",
    csv_parse_failed: "CSV-Inhalt konnte nicht gelesen werden",
    image_failed: "Bild konnte nicht geladen werden",
    video_failed: "Video konnte nicht geladen werden",
    video_unsupported: "Ihr Browser unterstützt das Video-Element nicht.",
    html_mode: "HTML-Darstellung",
    html_strict: "Streng",
    html_relaxed: "Gelockert",
    html_relaxed_hint:
      "Streng zeigt die Seite nur an; gelockert führt auch ihre Skripte aus. Der Netzwerkzugriff folgt der Einstellung \"Externe Referenzen laden\", wie bei gerenderten HTML-Blöcken.",
    html_relaxed_warning:
      "Diese Seite kann Skripte ausführen und externe Ressourcen laden.",
    pdf_failed: "PDF konnte nicht angezeigt werden",
    pdf_mobile_title: "Die PDF-Vorschau ist auf Mobilgeräten nicht verfügbar",
    pdf_mobile_hint: "Bitte nutzen Sie einen Desktop-Browser für die PDF-Vorschau",
    pdf_original_title: "Vorschau des Original-PDFs",
    pdf_original_hint: "Dieses PDF wurde noch nicht verarbeitet. Klicken Sie auf \"Verarbeiten\", um den Text zu extrahieren.",
    pdf_missing_title: "PDF-Inhalt nicht verfügbar",
    pdf_missing_hint: "Die Daten des Original-PDFs sind für die Vorschau nicht verfügbar",
    docx_failed: "Word-Dokument konnte nicht angezeigt werden",
    save: "Auf Gerät speichern",
    save_failed: "Datei konnte nicht heruntergeladen werden",
    download_aria: "Datei herunterladen",
    close_aria: "Schließen",
  },
  typst: {
    rendering: "Typst-Dokument wird gerendert...",
    render_error:
      "Typst-Dokument konnte nicht gerendert werden. Quelle wird stattdessen angezeigt:",
  },
  latex: {
    download_failed: "Das LaTeX-Dokument konnte nicht heruntergeladen werden.",
    rendering: "LaTeX-Dokument wird gerendert...",
    render_error:
      "LaTeX-Dokument konnte nicht gerendert werden. Quelle wird stattdessen angezeigt:",
  },
  wasm_download: {
    title: "{{feature}}-Renderer herunterladen?",
    body: "Das Rendern dieses Blocks lädt beim ersten Mal WebAssembly und Schriftarten herunter. Danach bleiben sie im Browser-Cache.",
    size: "Etwa {{size}} MB",
    confirm: "Herunterladen und rendern",
    keep_code: "Als Code anzeigen",
    feature_typst: "Typst",
    feature_latex: "LaTeX",
    feature_tikz: "TikZ",
    feature_graphviz: "Graphviz",
  },
  graphviz: {
    rendering: "Graphviz-Diagramm wird gerendert...",
    render_error: "Graphviz-Diagramm konnte nicht gerendert werden.",
  },
  vega: {
    rendering: "Diagramm wird gerendert...",
    render_error: "Vega-Lite-Diagramm konnte nicht gerendert werden.",
    external_blocked: "Dieses Diagramm lädt externe Daten von {{url}}. Aktivieren Sie externe Referenzen, um es zu rendern.",
  },
  chartjs: {
    rendering: "Diagramm wird gerendert...",
    render_error: "Chart.js-Diagramm konnte nicht gerendert werden.",
  },
  // Announcement
  announcement: "",
  // Editierbare Tool-Formulare
  tool_form: {
    submit: "Tool ausführen",
    sending: "Wird ausgeführt...",
    reset: "Zurücksetzen",
    edit: "Bearbeiten",
    tool_call: "Tool-Aufruf",
    select_placeholder: "Auswählen…",
  },
  // Nur für die Entwicklung: /dev/tool-form
  tool_form_demo: {
    title: "Tool-Formular testen",
    description:
      "Nur für die Entwicklung: Vorschau des Formulars, das Tool-Ergebnisse im Chat anzeigen. Beim Absenden werden die Werte hier angezeigt, statt eine Nachricht zu senden.",
    submitted: "Übermittelte Werte",
  },
};
