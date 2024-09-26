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
            //Announcement bar
            titleAnnouncement:
              "Service Announcement: Changes to Chat AI Model Availability",

            // Disclaimer note
            note1: "Note: The chatbot is prone to",
            note2: "and its responses should not be considered accurate.",
            note3: "Data Privacy",
            note4: "and",
            note5: "Imprint",
            note6: "hallucination",

            // Choose model
            choose: "Model",
            custom:
              "This feature allows you to customize your workflow by setting the System Prompt, which provides context and guidance for the model's response, and adjusting the Temperature, which influences the model's creativity and randomness. By tweaking these settings, you can tailor the model's output to suit your specific needs and preferences.",
            // Text area placeholder
            placeholder: "Ask me",
            tryAgain: "Please try again...",

            // Footer text
            text1: "Terms of Use",
            text2: "Data Privacy",
            text3: "User Guidelines",
            text4: "Contact Us",
            text5: "Feedback",
            text6: "Show options",
            text9: "Hide options",
            text7: "About",
            text8: "FAQ",

            // Custom instruction page
            custom1: "Advanced options",
            custom2: "These settings will not affect external (OpenAI) models.",
            custom3:
              "The system prompt is a special command or instruction given at the beginning of a conversation to set the tone, context, or constraints for our interaction. It's a way to guide the model's behavior and ensure that it responds in a helpful and appropriate manner.",
            custom4: "Enter the system prompt here",
            custom5: "Apply",
            custom6: "System prompt is required",
            custom7: "Reset default",
            custom8: "Clear cache",

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
            copyright: "All rights reserved",

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
            upload: "Attach",
            pause: "Abort",
            send: "Send",
            stop: "Stop",
            listen: "Listen",

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
              "You can select the specific arcana to be referenced by the LLM model by making the appropriate choice.",

            delete_arcana: "Are you sure you want to delete arcana?",
            delete_arcana1: "Delete",

            history: "Caution! Clearing will erase your history. Proceed?",
            dont_show_again: "Don't show this again",

            exportSettings: "Include model and options",
          },
        },
      },
      de: {
        translation: {
          description: {
            //Announcement bar
            titleAnnouncement:
              "Service-Ankündigung: Änderungen an der Verfügbarkeit von Chat-AI-Modellen",

            // Disclaimer note
            note1: "Hinweis: Der Chatbot ist anfällig für",
            note2:
              "und ihre Antworten sollten nicht als korrekt angesehen werden.",
            note3: "Datenschutz",
            note4: "und",
            note5: "Impressum",
            note6: "halluzination",

            // Choose model
            choose: "Modell",
            custom:
              "Diese Funktion ermöglicht es Ihnen, Ihren Workflow anzupassen, indem Sie den System-Prompt einstellen, der Kontext und Anleitung für die Antwort des Modells bereitstellt, und die Temperatur anpassen, die die Kreativität und Zufälligkeit des Modells beeinflusst. Durch Anpassen dieser Einstellungen können Sie die Ausgabe des Modells an Ihre spezifischen Bedürfnisse und Vorlieben anpassen.",
            // Text area placeholder
            placeholder: "Fragen Sie mich",
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
            custom6: "Anweisungen sind erforderlich",
            custom7: "Standard zurücksetzen",
            custom8: "Cache löschen",

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
              "Chat-AI bietet Zugriff auf eine Palette von state-of-the-art Large Language Models (LLMs), jedes mit eigenen Fähigkeiten und Leistungsmerkmalen. Dies ermöglicht es Ihnen, den Modelltyp auszuwählen, der am besten Ihren Forschungszielen und Anforderungen entspricht.\
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

            export: "exportieren",

            //Session
            session1:
              "Ihre Sitzung ist abgelaufen. Bitte drücken Sie zum Aktualisieren OK.",
            session2: "OK",
            session3: "Aktualisieren",

            //Tooltips
            undo: "Rückgängig",
            import: "Importieren",
            clear: "Löschen",
            upload: "Anhängen.",
            pause: "Abbrechen",
            send: "Senden",
            stop: "Anhalten",
            listen: "Anhören",

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
              "Sie können die spezifischen Arkana auswählen, auf die das LLM-Modell verweisen soll, indem Sie die entsprechende Auswahl treffen.",

            delete_arcana: "Sind Sie sicher, dass Sie Arcana löschen wollen?",
            delete_arcana1: "Löschen",

            history: "Achtung! Die Löschung löscht Ihren Verlauf. Fortfahren?",
            dont_show_again: "Zeigen Sie das nicht mehr",

            exportSettings: "Modell und Optionen einbeziehen",
          },
        },
      },
    },
  });

export default i18n;
