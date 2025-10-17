export default {
  // Common phrases
  common: {
    loading: "Lädt...",
    undo: "Rückgängig",
    rename: "Umbenennen",
    import: "Chat importieren",
    export: "Chat exportieren",
    clear: "Löschen",
    abort: "Abbrechen",
    send: "Senden",
    stop: "Anhalten",
    share: "Teilen",
    delete: "Löschen",
    cancel: "Abbrechen",
    refresh: "Aktualisieren",
    notice: "Hinweis",
    disclaimer: "Haftungsausschluss",
    understand: "Ich verstehe",
    ok: "OK",
    record_start: "Aufnehmen (klicken/halten)",
    record_stop: "Stopp (klicken/loslassen)",
    dont_show_again: "Nicht mehr anzeigen",
    backup_data: "Daten sichern",
    skip_backup: "Backup überspringen",
    upgrade_chat_ai: "Chat AI aktualisieren",
  },
  // Sidebar
  sidebar: {
    new_conversation: "Neues Gespräch",
    import_persona: "Mit Persona chatten",
  },
  // Settings panel
  settings: {
    tools_enabled: "Werkzeuge sind aktiviert",
    tools_disabled: "Werkzeuge sind deaktiviert",
    web_search_enabled: "Websuche ist erlaubt",
    web_search_disabled: "Websuche ist deaktiviert",
    system_prompt_placeholder: "System-Prompt hier eingeben",
    reset_default: "Standard zurücksetzen",
    default: "Standard",
    tools_title: "GWDG-Werkzeuge",
    label_web_search: "Websuche",
    label_image_generation: "Bildgenerierung",
    label_image_modification: "Bildbearbeitung",
    label_audio_generation: "Audiogenerierung",
    label_arcana: "Arcana",
    label_mcp_server: "MCP-Server",
    placeholder_arcana_id: "Arcana-ID",
    placeholder_mcp_id: "Server-ID",
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
    },
    reasoning: "Denkprozess",
    action: "Aktion",
    sources: "Quellen und Referenzen",
    references: "Referenzen",
    empty_message:
      "Ihre Gespräche werden niemals auf unseren Servern gespeichert.",
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
    copyright: "2025 GWDG © Alle Rechte vorbehalten",
    iso_certified: "ISO 27001 Zertifiziert",
  },
  // User Settings Modal
  user_settings: {
    title: "Benutzereinstellungen",
    default_model: {
      title: "Standardmodell",
      current: "Aktuell: {{currentModel}}",
      description: "Wählen Sie das Standardmodell für neue Gespräche aus.",
    },
    timeout: {
      title: "Wartezeit für Antworten",
      description: "Bestimmen Sie, wie lange auf KI-Antworten gewartet wird.",
      seconds: "Wartezeit (Sekunden)",
      range: "Bereich: 5-900 Sekunden",
    },
    data: {
      title: "Daten verwalten",
      description: `Hier können Sie alle lokal gespeicherten Daten verwalten. Diese Daten werden nur auf Ihrem Gerät gespeichert.\n\n
            Das Löschen der Daten führt zum dauerhaften Verlust aller vergangenen Gespräche, Erinnerungen, Einstellungen und Anhänge.`,
    },
    clear_data_button: "Daten löschen",
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
  },
  // Rename Conversation Modal
  rename_conversation: {
    title: "Gespräch umbenennen",
    enter_name: "Gesprächstitel eingeben",
    alert_empty: "Titel ist erforderlich",
  },
  // Delete Conversation Modal
  delete_conversation: {
    title: "Gespräch löschen",
    description: "Sind Sie sicher, dass Sie dieses Gespräch löschen möchten?",
  },
  // Share Settings Modal
  share_settings: {
    description:
      "Mit dieser Funktion wird ein Link für das von Ihnen gewählte Modell, die Systemansage und die Einstellungen erstellt, der gemeinsam genutzt werden kann. Jeder Benutzer, der diesen Link öffnet, kann dieselbe Konfiguration in seinen eigenen Unterhaltungen verwenden. Bitte beachten Sie, dass Ihr Gesprächsverlauf nicht freigegeben wird.",
    warn_arcana:
      "Warnung: Die Weitergabe von arcana-Details kann die in arcana hochgeladenen Daten gefährden.",
  },
  // Help modals
  help: {
    title: "Hilfe",
    arcana:
      "Arcana ist eine einzigartige Funktion unseres Dienstes, die das LLM mit spezialisiertem Wissen ausstattet. Wenn Sie eine gültige Arcana-ID und den entsprechenden Schlüssel eingeben, erhält das LLM Zugriff auf das in dieser Arcana enthaltene Wissen. Dies ermöglicht es dem Modell, Antworten zu generieren, die besser informiert und relevanter für Ihre Bedürfnisse sind. Lassen Sie das Feld für die ID leer, um das Modell ohne spezialisiertes Wissen zu verwenden.",
    mcp: "Bitte geben Sie die URL Ihres MCP (Model Context Protocol) Servers ein (z. B. https://...). Der MCP-Server ist ein Dienst, der der Chat-AI zusätzliche Werkzeuge, Datenquellen oder Verarbeitungskapazitäten bereitstellen kann, die über ihr eingebautes Wissen hinausgehen. Durch die Verbindung mit dem angegebenen MCP-Server kann die KI mit externen Systemen interagieren, aktuelle oder spezialisierte Informationen abrufen und benutzerdefinierte Aufgaben entsprechend den angebotenen Funktionen ausführen.",
    models:
      "Chat AI bietet Zugriff auf eine Palette von state-of-the-art Large Language Models (LLMs), jedes mit eigenen Fähigkeiten und Leistungsmerkmalen. Dies ermöglicht es Ihnen, den Modelltyp auszuwählen, der am besten Ihren Forschungszielen und Anforderungen entspricht.\
      Größere Modelle bieten typischerweise höhere Antwortqualitäten, aber haben aufgrund ihrer erhöhten Komplexität längere Antwortzeiten. Umgekehrt bieten kleinere Modelle schnellere Antwortzeiten, mögen jedoch einige Genauigkeit und Tiefe opfern. Mit der Liste der verfügbaren Modelle können Sie Abwägungen zwischen Antwortqualität und Geschwindigkeit treffen, um Ihren spezifischen Bedürfnissen gerecht zu werden. Für weitere Einzelheiten",
    memory:
      "Memory verbessert die Kontinuität von Gesprächen, indem es den Kontext aus vorherigen Nachrichten speichert. 'None' deaktiviert die Memory-Funktion - jedes Gespräch wird unabhängig behandelt. 'Recall' fügt Memory-Kontext zum System-Prompt hinzu, wodurch die KI auf frühere Teile Ihres Gesprächs verweisen kann. 'Learn' erhaltet auch automatische Memory-Updates. Diese Funktion bietet eine natürlichere Gesprächserfahrung ähnlich anderen KI-Diensten. Erinnerungen werden nur lokal in Ihrem Browser gespeichert.",
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
  // Tour
  tour: {
    welcome_message: "Willkommen bei Chat AI",
    start_tour: "Tour starten",
    skip_tour: "Tour überspringen",
    description:
      "Klicken Sie auf die Schaltfläche unten, um die geführte Tour zu starten und die neue Benutzeroberfläche zu erkunden.",
    prompt:
      "Sie können hier einfach eine Nachricht eingeben, um ein Gespräch mit Chat AI zu beginnen. Sie können Dateien an Ihre Nachricht anhängen; das Modell wird sie verwenden, wenn es den Dateityp verstehen kann.",
    model:
      "Hier können Sie das Modell auswählen, mit dem Sie chatten möchten. Jedes Modell hat seine eigenen Fähigkeiten und Einschränkungen.",
    sidebar:
      "In der Seitenleiste können Sie Gespräche hinzufügen, exportieren, löschen und zwischen ihnen wechseln. Sie können Gespräche auf Ihr Gerät importieren und exportieren oder eine Persona zum Chatten auswählen.",
    settings:
      "Im Einstellungsmenü können Sie den System-Prompt, die Temperatur und den Wert top_p anpassen. Sie können die Speichereinstellungen von Chat AI festlegen und neue GWDG-Tools aktivieren, einschließlich Arcana, Bildgenerierung und Websuche.",
    profile:
      "Direkt unter der Schaltfläche für die Einstellungen befindet sich diese Schaltfläche, mit der Sie Ihr Benutzerprofil öffnen können. Dort können Sie Ihre Präferenzen festlegen, Erinnerungen verwalten sowie Ihre Daten exportieren oder löschen.",
    interface:
      "In dieser Ecke können Sie das Design und die Sprache von Chat AI ändern.",
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
    no: "Nein, geh zurück",
    yes: "Ja, alles löschen",
    system_prompt_empty: "System-Prompt ist leer. Modell reagiert evtl. nicht.",
    external_model:
      "Sie verwenden ein externes Modell. Ihre Nachrichten werden außerhalb der GWDG verarbeitet, und die benutzerdefinierte Einstellungen werden nicht angewendet.",
    external_model_mpg:
      "Sie verwenden ein externes Modell. Ihre Nachrichten werden außerhalb der GWDG verarbeitet, und die benutzerdefinierte Einstellungen werden nicht angewendet. Externe Modelle sind nur nutzbar für wissenschaftliche Beschäftigte für wissenschaftliche Arbeiten, sofern keine personenbezogenen Daten eingegeben werden.",
    arcana_usage:
      "Halten Sie Temperatur auf 0 und top_p auf 0.05 für optimale Arcana-Ergebnisse",
    web_search_usage:
      "PRIVACY WARNUNG: Ihr Verlauf kann an eine Suchmaschine (z. B. Google) gesendet werden",
    mcp_usage:
      "PRIVACY WARNUNG: Ihre Daten können an externe Server gesendet werden.",
    arcana_export:
      "Warnung: Das Exportieren von Arcana-Details in eine Datei kann Ihre privaten Daten gefährden, da sie für andere zugänglich sind.",
    model_offline:
      "Das von Ihnen ausgewählte Modell ist derzeit offline. Durch das Anklicken von OK unten startet das Modell und wird in wenigen Minuten online sein. In der Zwischenzeit können Sie gerne ein anderes Modell auswählen.",
    session_expired:
      "Ihre Sitzung ist abgelaufen. Bitte drücken Sie zum Aktualisieren OK.",
    unsent_files:
      "Sie haben Dateien angehängt, die verloren gehen werden. Sind Sie sicher, dass Sie gehen wollen?",
    unprocessed_files:
      "Bitte verarbeiten oder entfernen Sie das beigefügte PDF, um fortzufahren.",
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
  // Announcement
  announcement: "",
};
