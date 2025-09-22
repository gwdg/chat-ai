import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Trans } from "react-i18next";
import BaseModal from "../../modals/BaseModal";
import icon_file_json from "../../assets/icons/file_json.svg";
import icon_file_pdf from "../../assets/icons/file_pdf.svg";
import icon_file_text from "../../assets/icons/file_text.svg";
import { getConversation, loadFile, loadFileMeta } from "../../db";
import { useToast } from "../../hooks/useToast";
import { jsPDF } from "jspdf";
import Logo from "../../assets/logos/chat_ai.png"
import { processContentItems } from "../../utils/sendMessage";

export default function ExportConversationModal({
  isOpen,
  onClose,
  localState,
  conversationId,
}) {
  const [exportFormat, setExportFormat] = useState("json");
  const [exportSettings, setExportSettings] = useState(true);
  const [exportArcana, setExportArcana] = useState(false);
  const [exportFiles, setExportFiles] = useState(false);
  const [containsFiles, setContainsFiles] = useState(true); // TODO set dynamically
  const [conversation, setConversation] = useState(null);

  const { notifyError, notifySuccess } = useToast();


  // Async function to load conversation from DB
  const refreshConversation = async () => {
    if (localState?.id === conversationId) {
      setConversation(localState);
      return;
    }
    const data = await getConversation(conversationId);
    if (data) setConversation(data);
  };

  // useEffect to load conversation on mount
  useEffect(() => {
    let isMounted = true; // Prevent setting state on unmounted component
    const fetchData = async () => {
      if (isMounted) { // Check if component is still mounted
        refreshConversation();
      }
    };
    fetchData();
    return () => {
      isMounted = false; // Cleanup function to prevent memory leaks
    };
  }, [conversationId, isOpen, onClose]); // Re-run when conversationId changes

  if (!conversation) return null; // Or a loading indicator
  const isArcanaSupported = conversation.settings?.model?.input?.includes("arcana") || conversation.settings?.enable_tools;
  const messages = conversation?.messages
  const arcana = conversation?.settings?.arcana

  // Function to generate timestamped filename for exports
  const generateFileName = (extension) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return `chat-ai-${year}-${month}-${day}-${hour}${minute}${second}.${extension}`;
  };

  // Function to process messages into export format
  const processMessages = async () => {
    let processedMessages = [];
    if (!Array.isArray(messages)) return processedMessages;
    let expectUser = true;
    for (let i = 0; i < messages.length; i++) {
      if (!messages[i]?.content) continue;
      const role = messages[i]?.role;
      if (!["system", "user", "assistant", "info"].includes(role)) continue;
      const content = messages[i].content;
      let processedMessage = {"role": role};
      if (typeof content === "string") processedMessage.content = content;
      else if (Array.isArray(content)) {
        if (content.length === 0) continue; // Invalid message
        if (content.length === 1 && content[0]?.text != null) {
          processedMessage.content = content[0].text;
        } else if (exportFiles) {
          // Content includes files
          processedMessage.content = await processContentItems({
            items: content,
            convertDocs: false, // Keep OpenAI file format
          })
        } else {
          // Ignore files
          processedMessage.content = content[0]?.text || "";
        }
      }

      // Check if empty user prompt at the end
      if (i === messages.length-1 
        && processedMessage.role === "user" 
        && processedMessage.content === "")
          continue;

      // Handle user-assistant not switching roles
      if (role === "assistant" && expectUser)
        processedMessages.push({"role": "user", "content": ""})
      else if (role === "user" && !expectUser)
        processedMessages.push({"role": "assistant", "content": ""})

      processedMessages.push(processedMessage);
      if (role === "user") expectUser = false;
      if (role === "assistant") expectUser = true;
    }
    return processedMessages;
  }
  
  // Function to process settings into export format
  const processSettings = () => {
    let settings = {}
    if (conversation?.title) settings.title = conversation.title;
    if (conversation?.settings?.temperature !== undefined && conversation?.settings?.temperature !== null) settings.temperature = conversation.settings.temperature;
    if (conversation?.settings?.enable_tools) settings.enable_tools = conversation.settings.enable_tools;
    if (conversation?.settings?.mcp_servers) settings.mcp_servers = conversation.settings.mcp_servers;
    if (conversation?.settings?.top_p) settings.top_p = conversation.settings.top_p;
    if (exportArcana && isArcanaSupported && conversation?.settings?.arcana?.id) {
      settings.arcana = conversation.settings.arcana;
    }
    if (conversation?.settings?.model) {
      if (typeof conversation.settings.model === "string") settings.model = conversation.settings.model;
      else if (conversation.settings.model?.id) {
        settings.model = conversation.settings.model.id
        if (conversation.settings.model?.name) settings["model-name"] = conversation.settings.model.name;
      }
    }
    return settings
  };

  // Export conversation as plain text
  const exportTextFile = async () => {
    try {
      // Process Messages
      let processedMessages = await processMessages();

      // Convert messages to formatted text
      let textContent = processedMessages
        .map((msg) => {
          let contentString = `${msg.role.toUpperCase()}: `;

          if (Array.isArray(msg.content)) {
            msg.content.forEach((item) => {
              if (item.type === "text") {
                contentString += `${item.text}\n`;
              } else if (item.type === "image_url") {
                if (exportFiles) {
                  contentString += "[Image]\n";
                }
              }
            });
          } else {
            contentString += msg.content;
          }

          return contentString;
        })
        .join("\n\n");

      // Add settings information if enabled
      if (exportSettings) {
        let settings = processSettings();
        const additionalText =
        `\n\nConversation settings\ntitle: ${
          conversation.title
        }\nmodel-name: ${
          settings?.["model-name"]
        }\nmodel: ${
          settings?.model
        }\ntemperature: ${
          settings?.temperature
        }\ntop_p: ${
          settings?.top_p
        }\n${exportArcana && isArcanaSupported && settings?.arcana?.id
            ? `Arcana ID: ${settings.arcana.id}}`
            : ""
        }`;
        textContent += additionalText;
      }

      // Create and download text file
      const blob = new Blob([textContent], { type: "text/plain" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = generateFileName("txt");
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.log(error)
      notifyError("An error occurred while exporting to TXT");
    }
  };

  // Export conversation as JSON
  const exportJSON = async () => {
    try {
      // Process Messages
      let processedMessages = await processMessages(conversation.messages);
      let exportData = {messages: processedMessages};

      // Add settings if enabled
      if (exportSettings) {
        let processedSettings = processSettings();
        exportData = { ...processedSettings, ...exportData };
      }

      // Create and download JSON file
      const content = JSON.stringify(exportData, null, 2);
      let file = new Blob([content], { type: "application/json" });
      let a = document.createElement("a");
      a.download = generateFileName("json");
      a.href = URL.createObjectURL(file);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      notifySuccess("Chat exported successfully");
    } catch (error) {
      console.log(error)
      notifyError("An error occurred while exporting to JSON");
    }
  };

  // Export conversation as PDF
  const exportPDF = async () => {
    try {
      // Initialize PDF document
      const doc = new jsPDF();
      doc.setProperties({
        title: conversation?.title || "Chat AI Conversation", // TODO Replace with actual title
        subject: "History",
        author: "Chat AI",
        keywords: "AI-Generated",
        creator: "GWDG",
      });
      doc.setFont("helvetica");

      // Define colors for PDF elements
      const COLORS = {
        DEFAULT: [0, 0, 0],
        HEADER_DATE: [150, 150, 150],
        ROLE: [0, 102, 204],
      };

      // Set up page dimensions and margins
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin;
      const lineHeight = 7;
      let y = margin;
      const headerHeight = 25;

      // Add header to each page
      const addHeader = (isFirstPage) => {
        y = margin;
        // TODO fix logo
        if (isFirstPage) {
          doc.addImage(Logo, "PNG", margin, margin, 20, 8);
        }
        const date = new Date().toLocaleDateString();
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.HEADER_DATE);
        doc.text(date, pageWidth - margin - 5, margin + 8, { align: "right" });
        doc.line(margin, headerHeight, pageWidth - margin, headerHeight);
        y = headerHeight + 10;
      };

      // Add page numbers to all pages
      const addPageNumbers = () => {
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(10);
          doc.setTextColor(...COLORS.DEFAULT);
          doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, {
            align: "center",
          });
        }
      };

      // Reset text styling to default
      const resetTextStyle = () => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.DEFAULT);
      };

      // Add new page if content would overflow
      const addNewPageIfNeeded = (spaceNeeded) => {
        if (y + spaceNeeded > pageHeight - margin) {
          doc.addPage();
          addHeader(false);
          resetTextStyle();
        }
      };

      // Initialize first page
      addHeader(true);
      resetTextStyle();

      // Process Messages
      let processedMessages = await processMessages();

      // Convert messages to formatted text
      // let textContent = processedMessages
      //   .map((msg) => {
      //     let contentString = `${msg.role.toUpperCase()}: `;

      //     if (Array.isArray(msg.content)) {
      //       msg.content.forEach((item) => {
      //         if (item.type === "text") {
      //           contentString += `${item.text}\n`;
      //         } else if (item.type === "image_url") {
      //           if (exportFiles) {
      //             contentString += "[Image]\n";
      //           }
      //         }
      //       });
      //     } else {
      //       contentString += msg.content;
      //     }

      //     return contentString;
      //   })
      //   .join("\n\n");

      // Process each message in conversation
      for (const entry of processedMessages) {
        addNewPageIfNeeded(lineHeight * 2);

        // Add role label
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.ROLE);
        doc.text(`${entry.role}:`, margin, y);
        y += lineHeight;

        resetTextStyle();

        // Handle different content types
        if (typeof entry.content === "string") {
          // Handle code blocks and regular text
          if (entry.content.includes("```")) {
            const parts = entry.content.split(/(```[\s\S]+?```)/);
            for (const part of parts) {
              if (part.startsWith("```")) {
                const [, language, code] =
                  part.match(/```(\w+)?\n([\s\S]+?)```/) || [];
                if (code) {
                  const codeLines = code?.trim().split("\n");
                  addNewPageIfNeeded(lineHeight * (codeLines.length + 2));

                  doc.text(language || "Code:", margin, y);
                  y += lineHeight * 0.5;

                  // Add gray background for code blocks
                  doc.setFillColor(240, 240, 240);
                  doc.rect(
                    margin,
                    y,
                    contentWidth,
                    lineHeight * codeLines.length,
                    "F"
                  );

                  // Add code content with monospace font
                  doc.setFont("Courier", "normal");
                  codeLines.forEach((line, index) => {
                    doc.text(line, margin + 5, y + 5 + index * lineHeight);
                  });
                  y += lineHeight * (codeLines.length + 0.5);
                  resetTextStyle();
                }
              } else {
                // Handle regular text with word wrapping
                const lines = doc.splitTextToSize(part, contentWidth);
                lines.forEach((line) => {
                  addNewPageIfNeeded(lineHeight);
                  doc.text(line, margin, y);
                  y += lineHeight;
                });
              }
            }
          } else {
            // Handle regular text without code blocks
            const lines = doc.splitTextToSize(entry.content, contentWidth);
            lines.forEach((line) => {
              addNewPageIfNeeded(lineHeight);
              doc.text(line, margin, y);
              y += lineHeight;
            });
          }
        } else if (
          Array.isArray(entry.content) &&
          exportFiles
        ) {
          // Handle mixed content (text and images)
          entry.content.forEach((item) => {
            if (item.type === "text") {
              // Handle text content
              const lines = doc.splitTextToSize(item.text, contentWidth);
              lines.forEach((line) => {
                addNewPageIfNeeded(lineHeight);
                doc.text(line, margin, y);
                y += lineHeight;
              });
            } else if (item.type === "image_url") {
              // Handle image content
              addNewPageIfNeeded(lineHeight + 60);
              if (item.image_url.url.startsWith("data:image")) {
                doc.addImage(item.image_url.url, "JPEG", margin, y, 50, 50);
                y += 60;
              } else {
                doc.text("[Invalid image format]", margin, y);
                y += lineHeight;
              }
            }
          });
        } else {
          // Handle unavailable content
          addNewPageIfNeeded(lineHeight);
          doc.text("Content unavailable", margin, y);
          y += lineHeight;
        }

        y += lineHeight; // Add spacing between messages
      }

      // Add settings section if enabled
      if (exportSettings) {
        let settings = processSettings();
        addNewPageIfNeeded(
          lineHeight *
            (exportArcana && isArcanaSupported ? 8 : 6)
        );
        y += lineHeight * 2;

        resetTextStyle();
        doc.text("Conversation settings", margin, y);
        y += lineHeight;
        doc.text(`title: ${conversation?.title}`, margin, y);
        y += lineHeight;
        doc.text(`model: ${settings?.model}`, margin, y);
        y += lineHeight;
        doc.text(`model name: ${settings?.["model-name"]}`, margin, y);
        y += lineHeight;
        doc.text(`temperature: ${settings?.temperature}`, margin, y);
        y += lineHeight;
        doc.text(`top_p: ${settings?.top_p}`, margin, y);
        y += lineHeight;

        // Add Arcana settings if enabled
        if (exportArcana && isArcanaSupported && settings?.arcana?.id) {
          doc.text(`Arcana ID ${settings?.arcana?.id}`, margin, y);
          y += lineHeight;
        }
      }

      // Add page numbers and save the PDF
      addPageNumbers();
      doc.save(generateFileName("pdf"));
    } catch (error) {
      console.log(error)
      notifyError("An error occurred while exporting to JSON");
    }
  };

  // Handle Format Change
  const handleFormatChange = (format) => {
    setExportFormat(format);
  };

  // Handle export
  const handleExport = async () => {
    await refreshConversation();
    if (exportFormat === "json") {
      await exportJSON();
    } else if (exportFormat === "pdf") {
      await exportPDF();
    } else if (exportFormat === "text") {
      await exportTextFile();
    }
    onClose();
  };

  const exportOptions = [
    { id: "json", icon: icon_file_json, label: "export_conversation.json" },
    { id: "pdf", icon: icon_file_pdf, label: "export_conversation.pdf" },
    { id: "text", icon: icon_file_text, label: "export_conversation.text" },
  ];

  const toggleExportSettings = (event) => {
    setExportSettings(event.target.checked);
  };

  const toggleExportFiles = (event) => {
    setExportFiles(event.target.checked);
  };

  const toggleExportArcana = (event) => {
    setExportArcana(event.target.checked);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="export_conversation.title"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4">
        {/* Export format options */}
        {exportOptions.map((option) => (
          <div
            key={option.id}
            className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all duration-200
              ${
                exportFormat === option.id
                  ? "border-tertiary bg-gray-100 dark:bg-gray-800"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            onClick={() => handleFormatChange(option.id)}
          >
            <img src={option.icon} alt={option.id} className="h-8 w-8" />
            <label
              className={`text-sm ${
                exportFormat === option.id
                  ? "text-tertiary"
                  : "text-black dark:text-white"
              }`}
            >
              <Trans i18nKey={option.label} />
            </label>
          </div>
        ))}

        {/* Arcana Export Option */}
        {arcana?.id && isArcanaSupported && exportSettings ? (
          <>
            <p className="text-red-600 text-xs">
              <Trans i18nKey="alert.arcana_export" />
            </p>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="exportArcana"
                checked={exportArcana}
                onChange={toggleExportArcana}
                className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${
                  !arcana.id ? "bg-gray-400 cursor-not-allowed" : ""
                }`}
                disabled={!arcana?.id || !isArcanaSupported}
              />
              <label
                htmlFor="exportArcana"
                className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none"
              >
                <Trans i18nKey="export_conversation.export_arcana" />
              </label>
            </div>
          </>
        ) : null}

        {/* Export Settings Checkbox */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="exportSettings"
            checked={exportSettings}
            onChange={toggleExportSettings}
            className="h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out"
          />
          <label
            htmlFor="exportSettings"
            className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none"
          >
            <Trans i18nKey="export_conversation.export_settings" />
          </label>
        </div>

        {/* Export files checkbox */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="exportFiles"
            checked={exportFiles}
            onChange={toggleExportFiles}
            className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${
              !containsFiles ? "bg-gray-400 cursor-not-allowed" : ""
            }`}
            disabled={!containsFiles}
          />
          <label
            htmlFor="exportFiles"
            className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none"
          >
            <Trans i18nKey="export_conversation.export_files" />
          </label>
        </div>

        {/* Export Button */}
        <div className="flex justify-end w-full">
          <button
            onClick={handleExport}
            type="button"
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none text-sm cursor-pointer"
          >
            <Trans i18nKey="export_conversation.export" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}