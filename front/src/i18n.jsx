import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    debug: false,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    resources: {
      en: {
        translation: {
          description: {
            settings_timeout: {
              requestTimeout: "Request Timeout",
              requestTimeoutDescription:
                "Set how long to wait for AI responses before timing out.",
              timeoutSeconds: "Timeout (seconds)",
              timeoutRange: "Range: 5-900 seconds",
            },
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
            tour: {
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
              skip: "Skip",
            },
            newConversation: "New Conversation",
            importPersona: "Import Persona",
            persona: {
              selectPersona: "Select Persona",
              browsePersonas: "Browse available personas from repository",
              personas: "Personas",
              back: "Back",
              errorLoading: "Error loading personas",
              retry: "Retry",
              noPersonas: "No personas found in this folder",
              configuration: "Persona configuration",
              folder: "Folder",
              createOwn: "Create Your Own Persona",
              importFromClipboard: "Import Persona from Clipboard",
              importFromClipboardErrorInvalidJson: "Failed to import persona from clipboard. No valid JSON found.",
              importFromClipboardErrorInvalidPersona: "Failed to import persona from clipboard. Invalid persona data."
            },
            settings: {
              userMemory: "User Memory",
              userMemoryDescription:
                "Manage your personal memories that help the AI remember important details about you. You currently have {{count}} memories saved.",
              manageMemory: "Manage Memory",
              userProfileSettings: "User Profile Settings",
              logout: "Logout",
              defaultModelTitle: "Default Model",
              defaultModel: "Current: {{currentModel}}",
              defaultModelDescription:
                "Select the default model for new conversations.",
              clearAllChats: "Clear All Chats",
              clearAllChatsDescription:
                "This will permanently delete all your chat history and cannot be undone.",
            },
            common: {
              loading: "Loading...",
            },
            //Announcement bar
            titleAnnouncement:
              "Service Announcement: Changes to Chat AI Model Availability",

            // Disclaimer note
            note1: "Note: Chatbots are prone to",
            note2: "and their responses should not be considered accurate.",
            note3: "Data Privacy",
            note4: "and",
            note5: "Imprint",
            note6: "Hallucination",

            // Choose model
            choose: "Model",
            custom:
              "This feature allows you to customize your workflow by setting the System Prompt, which provides context and guidance for the model's response, and adjusting the Temperature, which influences the model's creativity and randomness. By tweaking these settings, you can tailor the model's output to suit your specific needs and preferences.",
            // Text area placeholder
            placeholder: "Ask me",
            placeholder_modelList: "Search models...",
            tryAgain: "Please try again...",

            // Footer text
            text1: "Terms of Use",
            text2: "Data Privacy",
            text3: "User Guidelines",
            text4: "Contact Us",
            text5: "Feedback",
            text6: "Show options",
            text9: "Hide options",
            text10: "Hide",
            text7: "About",
            text8: "FAQ",

            // Custom instruction page
            custom1: "Advanced options",
            custom2: "These settings will not affect external (OpenAI) models.",
            custom3:
              "The system prompt is a special command or instruction given at the beginning of a conversation to set the tone, context, or constraints for our interaction. It's a way to guide the model's behavior and ensure that it responds in a helpful and appropriate manner.",
            custom4: "Enter the system prompt here",
            custom5: "Apply",
            custom6: "System prompt is empty. Model may not respond.",
            custom7: "Reset default",
            custom8: "Clear",
            custom9: "Share",
            custom10: "Default",

            // Feedback page
            feedback1: "Title is required",
            feedback2: "Category is required",
            feedback3: "Feedback is required",
            feedback4: "Feedback",
            feedback5: "Submit",
            feedback6: "Ratings (Optional)",
            feedback7: "Choose category",
            feedback8: "Title",
            feedback9: "Feedback",
            feedback10: "Select a option",
            feedback11: "Enter your title here",
            feedback12: "Enter your feedback here",
            bug: "Bug",
            suggestion: "Suggestion",
            other: "Other",

            // Footer Copyrights
            copyright: "All Rights Reserved",

            // Help note
            help_title: "Note",
            help_title1: "Warning",
            help_note:
              "Chat AI provides access to a range of state-of-the-art Large Language Models (LLMs), each with distinct capabilities and performance characteristics. This allows you to explore and select the model that best aligns with your research goals and requirements. \
              Larger models typically offer higher-quality responses, but may have longer response times due to their increased complexity. Conversely, smaller models provide faster response times, but may sacrifice some accuracy and depth. With the list of available models, you can balance trade-offs between response quality and speed to suit your specific needs. For more details",

            // Files upload
            file1: "Attachments",
            file2: "Clear all",

            // Mic permission
            mic1: "Microphone permission was not granted. Please allow it in your browser settings.",
            mic2: "Allow microphone permission",

            export_title: "Choose file type",

            // File format
            fileFormat1: "JSON file",
            fileFormat2: "PDF file",
            fileFormat3: "TXT file",

            export: "Export",

            //Session
            session1: "Your session has expired. Please press OK to refresh.",
            session2: "OK",
            session3: "Refresh",

            //Tooltips
            undo: "Undo",
            import: "Import",
            clear: "Clear",
            attachFile: "Attach File",
            attachImage: "Attach Media",
            pause: "Abort",
            send: "Send",
            stop: "Stop",
            listen: "Listen",
            settings_toggle: "Open Settings",
            startRecording: "Record (click/hold)",
            stopRecording: "Stop (click/release)",
            //Bad request
            bad: "Bad request was sent: Please clear conversation, reattempt within the limit, and save your chat history for future reference.",

            //Clear cache
            cache1:
              "Caution! Clearing cache will erase your history and settings. Proceed?",
            cache2: "No, go back",
            cache3: "Yes clear everything",

            // temperature
            temperature:
              "A low temperature (e.g., 0-1) produces more predictable and logical responses, while higher temperatures (e.g., above 1) increase the possibility of more creative and unconventional responses. You can adjust the temperature setting to achieve different levels of predictability and creativity.",

            //t_pop
            t_pop:
              "top_p is a slider from 0 to 1 which adjusts the total population of probabilities considered for the next token. A top_p of 0.1 would mean only the top 10% of cumulative probabilities is considered. Variating top_p has a similar effect on predictability and creativity as temperature.",
            memory_help:
              "Memory enhances conversation continuity by remembering context from previous messages. 'None' disables memory functionality - each conversation is treated independently. 'Recall' adds memory context to the system prompt, allowing the AI to reference earlier parts of your conversation. 'Learn' works similar to Recall, but also updates the memory with relevant parts of the current conversation. This feature provides a more natural conversational experience similar to other AI services. Memories are only stored locally in your browser.",
            // Help arcana note
            help_arcana_title: "Note",
            help_arcana_note:
              "After uploading files to the collection, there might be a short processing period. During this time, the system analyzes your files to provide more accurate and precise responses. Thank you for your patience.",
            //Arcana
            arcana_title: "Title",
            arcana_description: "Description",
            arcana_enter_title: "Enter title here",
            arcana_enter_description: "Enter description here",
            arcana_req_title: "Title is required",
            arcana_req_description: "Description is required ",
            arcana_file: "No files uploaded yet.",
            arcana_file_upload: "Upload",
            help: "Help",
            save: "Save",
            add: "ADD",

            //Table
            table_text1: "Index",
            table_text2: "Name",
            table_text3: "Date of upload",
            table_text4: "Action",

            arcana_note:
              "Arcana is a unique feature of our service that empowers the LLM with specialized knowledge. When you enter a valid Arcana ID and its corresponding key, the LLM gains access to the knowledge contained within that Arcana. This enables the model to generate responses that are more informed and relevant to your needs. Leave the ID empty to use the model without any specialized knowledge.",

            delete_arcana: "Are you sure you want to delete arcana?",
            delete_arcana1: "Delete",

            history: "Caution! Clearing will erase your history. Proceed?",
            dont_show_again: "Don't show this again",

            exportSettings: "Include model and options",
            exportImages: "Include images",
            exportArcana: "Include Arcana details",
            arcana_warn:
              "Warning: Exporting Arcana details to a file may compromise your private data, as it can be accessed by others.",

            exportSettings1:
              "This feature creates a shareable link for your chosen model, system prompt, and settings. Any user who opens this link will be able to use the same configuration in their own conversations. Please note that your conversation history will not be shared.",
            exportSettings2: "Share",

            notFound: {
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
            delete_title: "Delete Conversation",
            delete_message:
              "Are you sure you want to delete this conversation?",
            delete_confirmText: "Delete",
            delete_cancelText: "Cancel",

            warningTitle: "Warning",
            warning_settings:
              "You are using an external model. Your messages will be processed outside of GWDG, and the custom settings will not be applied.",
            warning_settings_mpg:
              "You are using an external model. Your messages will be processed outside of GWDG, and the custom settings will not be applied. External models can only be used by scientific employees for scientific work, provided that no personal data is entered.",
            warning_arcana:
              "Keep temperature at 0 and top_p at 0.05 for optimal arcana results",
            offline:
              "The model you selected is currently offline. By pressing OK below, the model starts up and will be online in a few minutes. In the meantime, feel free to choose another model.",

            rename_conversation: "Rename conversation",
            input_conversation: "Enter conversation title",
            input_button: "Rename",
            error_title: "Title is required",

            unprocessed_files_title: "Warning: PDF not processed",
            unprocessed_files:
              "Please process or remove the attached PDF to continue.",
            announcement:
              "Chat AI will be temporarily unavailable on Wednesday, 18.12.2024, from 10:00 to 12:00 due to maintenance. We apologize for the inconvenience.",

            fileAlert:
              "You have uploaded files that will be lost. Are you sure you want to leave?",
          },
        },
      },
      de: {
        translation: {
          description: {
            settings_timeout: {
              requestTimeout: "Wartezeit für Antworten",
              requestTimeoutDescription:
                "Bestimmen Sie, wie lange auf KI-Antworten gewartet wird.",
              timeoutSeconds: "Wartezeit (Sekunden)",
              timeoutRange: "Bereich: 5-900 Sekunden",
            },
            memory: {
              userMemory: "Benutzerspeicher",
              memoryCount_one: "{{count}} Erinnerung gespeichert",
              memoryCount_other: "{{count}} Erinnerungen gespeichert",
              addNew: "Neue Erinnerung hinzufügen",
              add: "Hinzufügen",
              savedMemories: "Gespeicherte Erinnerungen",
              deleteAll: "Alle löschen",
              noMemories: "Noch keine Erinnerungen gespeichert.",
              addFirst: "Fügen Sie Ihre erste Erinnerung oben hinzu!",
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
            tour: {
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
              last: "Beenden",
              next: "Weiter",
              skip: "Überspringen",
            },
            newConversation: "Neues Gespräch",
            importPersona: "Persona importieren",
            persona: {
              selectPersona: "Persona auswählen",
              browsePersonas:
                "Verfügbare Personas aus dem Repository durchsuchen",
              personas: "Personas",
              back: "Zurück",
              errorLoading: "Fehler beim Laden der Personas",
              retry: "Wiederholen",
              noPersonas: "Keine Personas in diesem Ordner gefunden",
              configuration: "Persona-Konfiguration",
              folder: "Ordner",
              createOwn: "Eigene Persona erstellen",
              importFromClipboard: "Persona aus Zwischenablage importieren",
              importFromClipboardErrorInvalidJson: "Fehler beim Importieren der Persona aus der Zwischenablage. Ungültiges JSON.",
              importFromClipboardErrorInvalidPersona: "Fehler beim Importieren der Persona aus der Zwischenablage. Ungültige Persona-Daten."
            },
            settings: {
              userMemory: "Benutzerspeicher",
              userMemoryDescription:
                "Verwalten Sie Ihre persönlichen Erinnerungen, die der KI helfen, wichtige Details über Sie zu behalten. Sie haben derzeit {{count}} Erinnerungen gespeichert.",
              manageMemory: "Speicher verwalten",
              userProfileSettings: "Benutzerprofil-Einstellungen",
              logout: "Abmelden",
              defaultModel: "Standard-Modell",
              defaultModelDescription:
                "Wählen Sie das Standard-Modell für neue Unterhaltungen. Aktuell: {{currentModel}}",
              clearAllChats: "Alle Chats löschen",
              clearAllChatsDescription:
                "Dies wird Ihren gesamten Chat-Verlauf dauerhaft löschen und kann nicht rückgängig gemacht werden.",
            },
            common: {
              loading: "Laden...",
            },
            //Announcement bar
            titleAnnouncement:
              "Service-Ankündigung: Änderungen an der Verfügbarkeit von Chat-AI-Modellen",

            // Disclaimer note
            note1: "Hinweis: Chatbots sind anfällig für",
            note2:
              "und ihre Antworten sollten nicht als korrekt angesehen werden.",
            note3: "Datenschutz",
            note4: "und",
            note5: "Impressum",
            note6: "Halluzination",

            // Choose model
            choose: "Modell",
            custom:
              "Diese Funktion ermöglicht es Ihnen, Ihren Workflow anzupassen, indem Sie den System-Prompt einstellen, der Kontext und Anleitung für die Antwort des Modells bereitstellt, und die Temperatur anpassen, die die Kreativität und Zufälligkeit des Modells beeinflusst. Durch Anpassen dieser Einstellungen können Sie die Ausgabe des Modells an Ihre spezifischen Bedürfnisse und Vorlieben anpassen.",
            // Text area placeholder
            placeholder: "Fragen Sie mich",
            placeholder_modelList: "Modelle suchen...",
            tryAgain: "Bitte versuchen Sie es noch einmal...",

            // Footer text
            text1: "Nutzungsbedingungen",
            text2: "Datenschutz",
            text3: "Benutzerrichtlinien",
            text4: "Kontakt",
            text5: "Rückmeldung",
            text6: "Optionen anzeigen",
            text9: "Optionen ausblenden",
            text7: "Über uns",
            text8: "FAQ",

            // Custom instruction page
            custom1: "Erweiterte Optionen",
            custom2:
              "Diese Einstellungen wirken sich nicht auf externe (OpenAI) Modelle aus.",
            custom3:
              "Der Systemprompt ist ein spezieller Befehl oder eine Anweisung, die zu Beginn eines Gesprächs gegeben wird, um den Ton, den Kontext oder die Einschränkungen für unsere Interaktion festzulegen. Damit wird das Verhalten des Modells gelenkt und sichergestellt, dass es auf hilfreiche und angemessene Weise reagiert.",
            custom4: "Geben Sie hier die Systemaufforderung ein",
            custom5: "Anwenden",
            custom6:
              "System-Eingabeaufforderung ist leer. Das Modell reagiert möglicherweise nicht.",
            custom7: "Standard zurücksetzen",
            custom8: "Löschen",
            custom9: "Teilen",
            custom10: "zurücksetzen",

            // Feedback page
            feedback1: "Titel ist erforderlich",
            feedback2: "Kategorie ist erforderlich",
            feedback3: "Feedback ist erforderlich",
            feedback4: "Rückmeldung",
            feedback5: "Einreichen",
            feedback6: "Bewertungen (fakultativ)",
            feedback7: "Kategorie wählen",
            feedback8: "Titel",
            feedback9: "Rückmeldung",
            feedback10: "Wählen Sie eine Option",
            feedback11: "Geben Sie hier Ihren Titel ein",
            feedback12: "Geben Sie hier Ihr Feedback ein",
            bug: "Fehler",
            suggestion: "Anregung",
            other: "Andere",

            // Footer Copyrights
            copyright: "Alle Rechte vorbehalten",

            // Help note
            help_title: "Hinweis",
            help_title1: "Warnung",
            help_note:
              "Chat AI bietet Zugriff auf eine Palette von state-of-the-art Large Language Models (LLMs), jedes mit eigenen Fähigkeiten und Leistungsmerkmalen. Dies ermöglicht es Ihnen, den Modelltyp auszuwählen, der am besten Ihren Forschungszielen und Anforderungen entspricht.\
              Größere Modelle bieten typischerweise höhere Antwortqualitäten, aber haben aufgrund ihrer erhöhten Komplexität längere Antwortzeiten. Umgekehrt bieten kleinere Modelle schnellere Antwortzeiten, mögen jedoch einige Genauigkeit und Tiefe opfern. Mit der Liste der verfügbaren Modelle können Sie Abwägungen zwischen Antwortqualität und Geschwindigkeit treffen, um Ihren spezifischen Bedürfnissen gerecht zu werden. Für weitere Einzelheiten",

            // Files upload
            file1: "Anlagen",
            file2: "Alle löschen",

            // Mic permission
            mic1: "Mikrofonerlaubnis wurde nicht erteilt. Bitte erlauben Sie es in den Einstellungen Ihres Browsers.",
            mic2: "Mikrofonerlaubnis erteilen",

            export_title: "Dateityp auswählen",

            // File format
            fileFormat1: "JSON-Datei",
            fileFormat2: "PDF-Datei",
            fileFormat3: "TXT-Datei",

            export: "Exportieren",

            //Session
            session1:
              "Ihre Sitzung ist abgelaufen. Bitte drücken Sie zum Aktualisieren OK.",
            session2: "OK",
            session3: "Aktualisieren",

            //Tooltips
            undo: "Rückgängig",
            import: "Importieren",
            clear: "Löschen",
            attachFile: "Datei anhängen",
            attachImage: "Medien anhängen",
            pause: "Abbrechen",
            send: "Senden",
            stop: "Anhalten",
            listen: "Anhören",
            settings_toggle: "Einstellungen öffnen",
            startRecording: "Aufnehmen (Klicken/Halten)",
            stopRecording: "Stoppen (Klicken/Loslassen)",

            //Bad request
            bad: "Fehlerhafte Anfrage wurde gesendet: Bitte löschen Sie die Konversation, versuchen Sie es innerhalb des Limits erneut, und speichern Sie Ihren Chatverlauf für spätere Zwecke.",

            //Clear cache
            cache1:
              "Vorsicht! Wenn Sie den Cache löschen, werden Ihr Verlauf und Ihre Einstellungen gelöscht. Fortfahren?",
            cache2: "Nein, geh zurück",
            cache3: "Ja, alles löschen",

            // temperature
            temperature:
              "Eine niedrige Temperatur (z. B. 0-1) erzeugt vorhersehbarere und logischere Antworten, während höhere Temperaturen (z. B. über 1) die Möglichkeit kreativerer und unkonventionellerer Antworten erhöhen. Sie können die Temperatureinstellung anpassen, um verschiedene Stufen der Vorhersagbarkeit und Kreativität zu erreichen.",

            //t_pop
            t_pop:
              "top_p ist ein Schieberegler von 0 bis 1, der den Gesamtbestand der Wahrscheinlichkeiten anpasst, die für das nächste Token in Betracht gezogen werden. Ein top_p von 0,1 würde bedeuten, dass nur die oberen 10% der kumulativen Wahrscheinlichkeiten berücksichtigt werden. Die Variation von top_p hat einen ähnlichen Effekt auf Vorhersagbarkeit und Kreativität wie die Temperatur.",
            memory_help:
              "Memory verbessert die Kontinuität von Gesprächen, indem es den Kontext aus vorherigen Nachrichten speichert. 'None' deaktiviert die Memory-Funktion - jedes Gespräch wird unabhängig behandelt. 'Recall' fügt Memory-Kontext zum System-Prompt hinzu, wodurch die KI auf frühere Teile Ihres Gesprächs verweisen kann. 'Learn' erhaltet auch automatische Memory-Updates. Diese Funktion bietet eine natürlichere Gesprächserfahrung ähnlich anderen KI-Diensten. Erinnerungen werden nur lokal in Ihrem Browser gespeichert.",

            // Help arcana note
            help_arcana_title: "Note",
            help_arcana_note:
              "Nach dem Hochladen von Dateien in die Sammlung kann es zu einer kurzen Bearbeitungszeit kommen. Während dieser Zeit analysiert das System Ihre Dateien, um genauere und präzisere Antworten zu geben. Wir danken Ihnen für Ihre Geduld.",

            //Arcana
            arcana_title: "Titel",
            arcana_description: "Beschreibung",
            arcana_enter_title: "Titel hier eingeben",
            arcana_enter_description: "Geben Sie hier eine Beschreibung ein",
            arcana_req_title: "Titel ist erforderlich",
            arcana_req_description: "Beschreibung ist erforderlich",
            arcana_file: "Noch keine Dateien hochgeladen.",
            arcana_file_upload: "Hochladen",
            help: "Hilfe",
            save: "Speichern",
            add: "Hinzufügen",

            //Table
            table_text1: "Index",
            table_text2: "Name",
            table_text3: "Datum des Hochladens",
            table_text4: "Aktion",

            arcana_note:
              "Arcana ist eine einzigartige Funktion unseres Dienstes, die das LLM mit spezialisiertem Wissen ausstattet. Wenn Sie eine gültige Arcana-ID und den entsprechenden Schlüssel eingeben, erhält das LLM Zugriff auf das in dieser Arcana enthaltene Wissen. Dies ermöglicht es dem Modell, Antworten zu generieren, die besser informiert und relevanter für Ihre Bedürfnisse sind. Lassen Sie das Feld für die ID leer, um das Modell ohne spezialisiertes Wissen zu verwenden.",

            delete_arcana: "Sind Sie sicher, dass Sie Arcana löschen wollen?",
            delete_arcana1: "Löschen",

            history: "Achtung! Die Löschung löscht Ihren Verlauf. Fortfahren?",
            dont_show_again: "Zeigen Sie das nicht mehr",

            exportSettings: "Modell und Optionen einbeziehen",
            exportImages: "Bilder einbeziehen",
            exportArcana: "Arcana-Details einbeziehen",
            arcana_warn:
              "Warnung: Das Exportieren von Arcana-Details in eine Datei kann Ihre privaten Daten gefährden, da sie für andere zugänglich sind.",

            exportSettings1:
              "Mit dieser Funktion wird ein Link für das von Ihnen gewählte Modell, die Systemansage und die Einstellungen erstellt, der gemeinsam genutzt werden kann. Jeder Benutzer, der diesen Link öffnet, kann dieselbe Konfiguration in seinen eigenen Unterhaltungen verwenden. Bitte beachten Sie, dass Ihr Gesprächsverlauf nicht freigegeben wird.",
            exportSettings2: "Teilen Sie",

            notFound: {
              title: "404: Unterhaltung nicht gefunden",
              description:
                "Ups! Sie versuchen auf eine Unterhaltung zuzugreifen, die in Ihrem Chatverlauf nicht existiert.",
              reasonsTitle: "Dies kann folgende Gründe haben:",
              reasons: {
                deleted: "• Die Unterhaltung wurde gelöscht",
                outdatedLink:
                  "• Sie verwenden einen veralteten oder ungültigen Link",
                incorrectId: "• Die Unterhaltungs-ID in der URL ist falsch",
                historyCleared: "• Ihr Chatverlauf wurde gelöscht",
              },
              reassurance:
                "Keine Sorge! Sie können eine neue Unterhaltung starten, indem Sie auf den Button unten klicken.",
              buttonText: "Zum Chat gehen",
            },
            landing: {
              title: "Sie sind nicht angemeldet",
              description: "Bitte melden Sie sich an, um Chat AI zu verwenden.",
              reasonsTitle: "Sie können sich anmelden, wenn Sie:",
              reasons: {
                deleted:
                  "• Mitglied einer deutschen Universität oder Forschungseinrichtung sind",
                outdatedLink: "• Mitglied einer Organisation im DFN sind",
                incorrectId:
                  "• ein registrierter Benutzer in AcademicCloud sind",
                historyCleared: "• von der GWDG Zugriff gewährt wurde",
              },
              reassurance:
                "Verwenden Sie einfach den Button unten, um sich anzumelden.",
              buttonText: "Anmelden mit AcademicCloud SSO",
            },
            delete_title: "Konversation löschen",
            delete_message:
              "Sind Sie sicher, dass Sie diese Konversation löschen möchten?",
            delete_confirmText: "Löschen",
            delete_cancelText: "Abbrechen",

            warningTitle: "Warnung",
            warning_settings:
              "Sie verwenden ein externes Modell. Ihre Nachrichten werden außerhalb der GWDG verarbeitet, und die benutzerdefinierte Einstellungen werden nicht angewendet.",
            warning_settings_mpg:
              "Sie verwenden ein externes Modell. Ihre Nachrichten werden außerhalb der GWDG verarbeitet, und die benutzerdefinierte Einstellungen werden nicht angewendet. Externe Modelle sind nur nutzbar für wissenschaftliche Beschäftigte für wissenschaftliche Arbeiten, sofern keine personenbezogenen Daten eingegeben werden.",
            warning_arcana:
              "Halten Sie Temperatur auf 0 und top_p auf 0.05 für optimale Arcana-Ergebnisse",
            offline:
              "Das von Ihnen ausgewählte Modell ist derzeit offline. Durch das Anklicken von OK unten startet das Modell und wird in wenigen Minuten online sein. In der Zwischenzeit können Sie gerne ein anderes Modell auswählen.",

            rename_conversation: "Konversation umbenennen",
            input_conversation: "Titel der Unterhaltung eingeben",
            input_button: "Umbenennen",
            error_title: "Titel ist erforderlich",

            unprocessed_files_title: "Warnung: PDF nicht verarbeitet",
            unprocessed_files:
              "Bitte verarbeiten oder entfernen Sie das beigefügte PDF, um fortzufahren.",

            announcement:
              "Chat AI wird am Mittwoch, 18.12.2024, von 10:00 bis 12:00 Uhr aufgrund von Wartungsarbeiten vorübergehend nicht verfügbar sein. Wir entschuldigen uns für die Unannehmlichkeiten.",
            fileAlert:
              "Sie haben Dateien hochgeladen, die verloren gehen werden. Sind Sie sicher, dass Sie gehen wollen?",
          },
        },
      },
    },
  });

export default i18n;
