export default {
  // Common phrases
  common: {
    loading: "Lädt...",
    undo: "Rückgängig",
    scroll: "Nach unten scrollen",
    scroll_to_message: "Zum Anfang der Nachricht springen",
    next_message: "Zur nächsten Nachricht scrollen",
    rename: "Umbenennen",
    create: "Erstellen",
    save: "Speichern",
    import: "Chat importieren",
    export: "Chat exportieren",
    summarize: "Zusammenfassen",
    summarizing: "Zusammenfassen...",
    summarize_success: "Zusammenfassung in einer neuen Unterhaltung erstellt.",
    summary_title: "Zusammenfassung von {{title}}",
    summarize_error: "Zusammenfassung fehlgeschlagen. Ihre Unterhaltung ist unverändert.",
    clear: "Löschen",
    abort: "Abbrechen",
    send: "Senden",
    send_shortcut: "Senden (Enter)",
    send_shortcut_shift_enter: "Senden (Umschalt+Enter)",
    stop: "Anhalten",
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
    sort_label: "Chats sortieren",
    sort_by_topic: "Nach Thema",
    sort_by_date: "Nach Datum",
    sort_by_created: "Nach Erstellungsdatum",
    modified: "Geändert {{date}}",
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
    empty_topic: "Ziehen Sie einen Chat hierher.",
    search_label: "Suche",
    search_action: "Chats durchsuchen",
    search_placeholder: "nach Titel durchsuchen",
    search_no_results: 'Keine Treffer für "{{query}}"',
    clear_search: "Suche löschen",
    create_title: "Thema erstellen",
    rename_title: "Thema umbenennen",
    delete_title: "Thema löschen",
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
    button: "Sortieren & organisieren",
    title: "Chats sortieren & organisieren",
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
    title: "Meta-Chat",
    open: "Metachat: Chats durchsuchen",
    banner_description: "Metachat kann Ihnen auf zwei Arten helfen:",
    purposes: {
      tutor: "Die Funktionen von Chat AI kennenlernen",
      tutor_example: "„Wie finde ich ein Tutorial oder prüfe meine Einstellungen?“",
      find: "Bisherige Chats und Themen finden",
      find_example: "„Wo ist mein Chat über meine Essensbestellung?“",
    },
    error: "Antwort fehlgeschlagen. Bitte versuchen Sie es erneut.",
    no_model: "Kein Standardmodell konfiguriert.",
  },
  feature_guide: {
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
      prompt: "Eingabe und Chat",
      tools: "Tools und RAG",
      chats: "Chats und Organisation",
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
    audio_generation: {
      title: "Audio erzeugen",
      step1: "Öffnen Sie GWDG Tools im Eingabefeld.",
      step2: "Aktivieren Sie die Tools.",
      step3:
        "Wählen Sie Audioerzeugung und beschreiben Sie das gewünschte Audio.",
    },
    video_generation: {
      title: "Videos erzeugen",
      step1: "Öffnen Sie GWDG Tools im Eingabefeld.",
      step2: "Aktivieren Sie die Tools.",
      step3:
        "Wählen Sie Videoerzeugung. Die Videowarteschlange zeigt den Fortschritt.",
    },
    mcp_server: {
      title: "Einen MCP-Server verbinden",
      step1: "Öffnen Sie GWDG Tools im Eingabefeld.",
      step2: "Aktivieren Sie die Tools.",
      step3: "Wählen Sie MCP-Server.",
      step4: "Geben Sie die MCP-Server-Konfiguration in das Feld unten ein.",
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
    },
    sort_group_chats: {
      title: "Chats sortieren und gruppieren",
      step1: "Öffnen Sie das Sortiermenü in der Seitenleiste.",
      step2: "Wählen Sie die Gruppierung nach Thema, Datum oder Erstellungsdatum.",
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
      step2: "Wählen Sie den Tab Chat. Erinnerungen und Daten enthalten die weiteren Einstellungen.",
      step3: "Ändern Sie eine Einstellung wie Darstellung oder Dokumentkonvertierung. Änderungen werden automatisch gespeichert.",
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
        "Wählen Sie den Tab Chat, um Standardmodell, Sendetaste, Zusammenfassungen, Darstellung und Dokumentkonvertierung zu ändern.",
    },
    rendering: {
      title: "Darstellung konfigurieren",
      step1: "Öffnen Sie Ihre Benutzereinstellungen.",
      step2: "Wählen Sie den Tab Chat.",
      step3:
        "Aktivieren Sie die Typst- oder LaTeX-Darstellung. Auch HTML-Darstellung und externe Verweise werden hier konfiguriert.",
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
      step3: "Sie können mich auch bitten, ein Tutorial zu finden. Zum Beispiel: „Finde ein Tutorial zum Hochladen einer Datei.“",
      step4: "Fragen Sie auch nach Ihren Einstellungen. Zum Beispiel: „Welche Einstellungen habe ich für Erinnerungen gewählt?“",
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
    reset_default: "Standard zurücksetzen",
    default: "Standard",
    tools_title: "GWDG-Werkzeuge",
    chat_settings: "Chat-Einstellungen",
    label_web_search: "Websuche",
    label_image_generation: "Bildgenerierung",
    label_image_modification: "Bildbearbeitung",
    label_audio_generation: "Audiogenerierung",
    label_video_generation: "Videogenerierung",
    label_arcana: "Arcana",
    label_mcp_server: "MCP-Server",
    placeholder_arcana_id: "Arcana-ID",
    placeholder_mcp_id: "Server-ID",
    video_queue_title: "Videogenerierungs-Warteschlange",
    video_queue_subtitle: "Liste der Video-Generation Aufgaben",
    video_queue_job_label: "Videoanfrage #{{count}}",
    video_queue_status_queued: "Warteschlange",
    video_queue_status_processing: "In Bearbeitung",
    video_queue_status_ready: "Fertig",
    video_queue_status_failed: "Fehlgeschlagen",
    video_queue_delete: "Löschen",
    video_queue_eta: "ETA ~{{seconds}}s",
    video_queue_eta_done: "Gerade abgeschlossen",
    video_queue_download: "Download",
    video_queue_empty: "Noch keine Videoanfragen in der Warteschlange.",
    video_queue_badge_label: "Video-Warteschlange",
    video_queue_badge_tooltip_processing: "{{processing}} in Arbeit • {{ready}} fertig",
    video_queue_badge_tooltip_ready: "{{ready}} bereit zum Download",
    video_queue_modal_title: "Videogenerierungs-Warteschlange",
    video_queue_modal_subtitle: "{{processing}} in Arbeit • {{ready}} fertig zum Download",
  },

  // Conversation
  conversation: {
    prompt: {
      placeholder: "Frag mich",
      attach: "Datei anhängen",
      attach_media: "Medien anhängen",
      attachments: "Anhänge",
      clear_attachments: "Alle löschen",
    },
    attachment: {
      image_unsupported: "Modell wechseln, um Bilder zu verarbeiten",
      audio_unsupported: "Modell wechseln, um Audio zu verarbeiten",
      file_unsupported: "Nur mit {{filetype}}-Modell nutzbar",
      unprocessed: "Unverarbeitete Datei",
      process_browser: "Im Browser verarbeiten",
      process_server: "Auf dem Server verarbeiten",
      must_process: "Datei muss verarbeitet werden",
    },
    reasoning: "Denkprozess",
    copy_reasoning: "Denkprozess kopieren",
    action: "Aktion",
    html_block: {
      render: "HTML rendern",
      show_code: "Code anzeigen",
    },
    typst_block: {
      render: "Als Typst rendern",
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
    imprint: "Impressum",
    terms: "Nutzungsbedingungen",
    docs: "Doku",
    privacy: "Datenschutz",
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
        title: "Profil und Nutzung",
        description: "Überblick über Ihre Kontodaten und Nutzung.",
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
      monthly: "Monatlich",
      total: "Gesamt",
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
        section_label: "Vorschläge",
        label: "Folgevorschläge anzeigen",
        description:
          "Zeigt nach jeder Antwort passende Vorschläge zum Fortsetzen des Chats.",
        help_label: "Mehr über Folgevorschläge erfahren",
        title_once: {
          label: "Titel nur bei der ersten Anfrage festlegen",
          description:
            "Den Gesprächstitel nur einmal, aus der ersten Anfrage, generieren.",
        },
      },
      summaries: {
        section_label: "Unterhaltungszusammenfassungen",
        label: "Zusammenfassungen beim Darüberfahren anzeigen",
        description:
          "Beim Verlassen eines Chats wird eine kurze Zusammenfassung erstellt und beim Darüberfahren mit der Maus in der Seitenleiste angezeigt.",
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
    },
    clear_data_button: "Daten löschen",
    import_data_button: "Daten importieren",
    export_data_button: "Daten exportieren",
    memory: {
      title: "Erinnerungen",
      description:
        "Verwalten Sie Ihre persönlichen Erinnerungen, die der KI helfen, wichtige Details über Sie zu behalten. Sie haben derzeit {{count}} Erinnerungen gespeichert.",
      manage: "Erinnerungen verwalten",
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
  },
  // Memory Modal
  memory: {
    userMemory: "Erinnerungen",
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
      "Tools sind eine neue und experimentelle Funktion, die darauf ausgelegt ist, die Fähigkeiten von Chat-AI zu erweitern. Sie ermöglichen dem Modell, zusätzliche Aktionen auszuführen oder auf weitere Ressourcen zuzugreifen, um nützlichere, genauere oder spezialisierte Antworten zu liefern. Zu den aktuellen Tools gehören Arcana (für alle Modelle) und Websuche (optional); weitere Tools sind für die Zukunft geplant. Da sich diese Funktion noch in Entwicklung befindet, können sich Funktionsumfang und verfügbare Tools im Laufe der Zeit ändern.",
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
    title: "Warning",
    bad_request:
      "Fehlerhafte Anfrage wurde gesendet: Bitte löschen Sie die Konversation, versuchen Sie es innerhalb des Limits erneut, und speichern Sie Ihren Chatverlauf für spätere Zwecke.",
    clear_data: "Achtung! Die Löschung löscht Ihren Verlauf. Fortfahren?",
    clear_messages:
      "Sind Sie sicher, dass alle Nachrichten gelöscht werden sollen?",
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
  typst: {
    rendering: "Typst-Dokument wird gerendert...",
    render_error:
      "Typst-Dokument konnte nicht gerendert werden. Quelle wird stattdessen angezeigt:",
  },
  latex: {
    rendering: "LaTeX-Dokument wird gerendert...",
    render_error:
      "LaTeX-Dokument konnte nicht gerendert werden. Quelle wird stattdessen angezeigt:",
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
};
