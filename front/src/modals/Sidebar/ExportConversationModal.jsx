import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";
import json_icon from "../../assets/json_icon.svg";
import pdf_icon from "../../assets/pdf_icon.svg";
import txt_icon from "../../assets/txt_icon.svg";
import { selectCurrentConversation } from "../../Redux/reducers/conversationsSlice";

export default function ExportConversationModal({
  isOpen,
  onClose,
  localState,
  setLocalState,
  exportSettings,
  exportImage,
  exportArcana,
}) {
  const [value, setValue] = useState("json");
  const [containsImage, setContainsImage] = useState(false);
  const isArcanaSupported = false; // TODO
  const currentConversation = useSelector(selectCurrentConversation);
  const messages = currentConversation?.messages
  const arcana = currentConversation.arcana

  // ==== EXPORT FUNCTIONALITY ====
  // Generate timestamped filename for exports
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

  // Export conversation as plain text
  const exportTextFile = (messages) => {
    let exportData = [...messages];

    // Update system message with current system prompt
    const systemMessageIndex = exportData.findIndex(
      (msg) => msg.role === "system"
    );
    if (systemMessageIndex !== -1) {
      exportData[systemMessageIndex] = {
        role: "system",
        content: localState.settings.systemPrompt,
      };
    }

    // Convert messages to formatted text
    const textContent = exportData
      .map((msg) => {
        let contentString = `${msg.role.toUpperCase()}: `;

        if (Array.isArray(msg.content)) {
          msg.content.forEach((item) => {
            if (item.type === "text") {
              contentString += `${item.text}\n`;
            } else if (item.type === "image_url") {
              if (localState.exportOptions.exportImage) {
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

    let finalTextContent = textContent;

    // Add settings information if enabled
    if (localState.exportOptions.exportSettings) {
      const additionalText = `\n\nSettings used\ntitle: ${
        localState.title
      }\nmodel-name: ${localState.settings["model-name"]}\nmodel: ${
        localState.settings.model
      }\ntemperature: ${localState.settings.temperature}\ntop_p: ${
        localState.settings.top_p
      }${
        localState.exportOptions.exportArcana && isArcanaSupported
          ? // ? `\nArcana: {\n  id: ${localState.arcana.id},\n  key: ${localState.arcana.key}\n}`
            `\nArcana: {\n  id: ${localState.arcana.id}}`
          : ""
      }`;
      finalTextContent += additionalText;
    }

    // Create and download text file
    const blob = new Blob([finalTextContent], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = generateFileName("txt");
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Export conversation as JSON
  const exportJSON = (messages) => {
    try {
      let exportData = [...messages];

      // Update system message
      const systemMessageIndex = exportData.findIndex(
        (msg) => msg.role === "system"
      );
      if (systemMessageIndex !== -1) {
        exportData[systemMessageIndex] = {
          role: "system",
          content: localState.settings.systemPrompt,
        };
      }

      // Filter out images if not enabled
      if (!localState.exportOptions.exportImage) {
        exportData = exportData.map((msg) => {
          if (Array.isArray(msg.content)) {
            let filteredContent = msg.content
              .filter((item) => item.type === "text")
              .map((item) => item.text)
              .join("\n");

            return { ...msg, content: filteredContent };
          }
          return msg;
        });
      }

      // Add settings if enabled
      if (localState.exportOptions.exportSettings) {
        const settingsObject = {
          title: localState.title,
          ["model-name"]: localState.settings["model-name"],
          model: localState.settings.model,
          temperature: localState.settings.temperature,
          top_p: localState.settings.top_p,
          ...(localState.exportOptions.exportArcana &&
            isArcanaSupported && {
              arcana: {
                id: localState.arcana.id,
                //key: localState.arcana.key,
              },
            }),
        };

        exportData = { ...settingsObject, messages: exportData };
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
      notifyError("An error occurred while exporting to JSON: ", error);
    }
  };

  // Export conversation as PDF
  const exportPDF = async (conversation) => {
    // Initialize PDF document
    const doc = new jsPDF();
    doc.setProperties({
      title: "Chat AI Conversation", // TODO Replace with actual title
      subject: "History",
      author: "Chat AI",
      keywords: "LLM Generated",
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

    // Prepare conversation data
    let messagesData = [...messages];

    // Update system message
    const systemMessageIndex = messagesData.findIndex(
      (msg) => msg.role === "system"
    );
    if (systemMessageIndex !== -1) {
      messagesData[systemMessageIndex] = {
        role: "system",
        content: localState.settings.systemPrompt,
      };
    }

    // Filter images if not enabled
    if (!localState.exportOptions.exportImage) {
      messagesData = messagesData.map((entry) => {
        if (Array.isArray(entry.content)) {
          const filteredContent = entry.content
            .filter((item) => item.type === "text")
            .map((item) => item.text)
            .join("\n");
          return { ...entry, content: filteredContent };
        }
        return entry;
      });
    }

    // Process each message in conversation
    for (const entry of messagesData) {
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
        localState.exportOptions.exportImage
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
    if (localState.exportOptions.exportSettings) {
      addNewPageIfNeeded(
        lineHeight *
          (localState.exportOptions.exportArcana && isArcanaSupported ? 7 : 5)
      );
      y += lineHeight * 2;

      resetTextStyle();
      doc.text("Settings used", margin, y);
      y += lineHeight;
      doc.text(`title: ${localState.title}`, margin, y);
      y += lineHeight;
      doc.text(`model-name: ${localState.settings.model}`, margin, y);
      y += lineHeight;
      doc.text(`model-name: ${modelSettings["model-name"]}`, margin, y);
      y += lineHeight;
      doc.text(`temperature: ${localState.settings.temperature}`, margin, y);
      y += lineHeight;
      doc.text(`top_p: ${localState.settings.top_p}`, margin, y);
      y += lineHeight;

      // Add Arcana settings if enabled
      if (localState.exportOptions.exportArcana && isArcanaSupported) {
        doc.text("Arcana: {", margin, y);
        y += lineHeight;
        doc.text(`  id: ${localState.arcana.id}`, margin, y);
        y += lineHeight;
        doc.text("}", margin, y);
        y += lineHeight;
      }
    }

    // Add page numbers and save the PDF
    addPageNumbers();
    doc.save(generateFileName("pdf"));
  };

  // Handle different export format selections
  const exportFile = (value) => {
    if (value === "json") {
      exportJSON(localState.messages);
    } else if (value === "pdf") {
      exportPDF(localState.messages);
    } else if (value === "text") {
      exportTextFile(localState.messages);
    }
  };

  useEffect(() => {
    setContainsImage(
      messages.some(
        (message) =>
          message.role === "user" &&
          Array.isArray(message.content) &&
          message.content.some((item) => item.type === "image_url")
      )
    );
  }, [messages]);

  const handleChange = (format) => {
    setValue(format);
  };

  const handleExport = () => {
    exportFile(value, messages);
    onClose();
  };

  const exportOptions = [
    { id: "json", icon: json_icon, label: "description.fileFormat1" },
    { id: "pdf", icon: pdf_icon, label: "description.fileFormat2" },
    { id: "text", icon: txt_icon, label: "description.fileFormat3" },
  ];

  const handleCheckboxChange = (event) => {
    setLocalState((prev) => ({
      ...prev,
      exportOptions: {
        ...prev.exportOptions,
        exportSettings: event.target.checked,
      },
    }));
  };

  const handleCheckboxChangeImages = (event) => {
    setLocalState((prev) => ({
      ...prev,
      exportOptions: {
        ...prev.exportOptions,
        exportImage: event.target.checked,
      },
    }));
  };

  const handleCheckboxChangeArcana = (event) => {
    setLocalState((prev) => ({
      ...prev,
      exportOptions: {
        ...prev.exportOptions,
        exportArcana: event.target.checked,
      },
    }));
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="description.export_title"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4">
        {/* Export format options */}
        {exportOptions.map((option) => (
          <div
            key={option.id}
            className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all duration-200
              ${
                value === option.id
                  ? "border-tertiary bg-gray-100 dark:bg-gray-800"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            onClick={() => handleChange(option.id)}
          >
            <img src={option.icon} alt={option.id} className="h-8 w-8" />
            <label
              className={`text-sm ${
                value === option.id
                  ? "text-tertiary"
                  : "text-black dark:text-white"
              }`}
            >
              <Trans i18nKey={option.label} />
            </label>
          </div>
        ))}

        {/* Arcana Export Option */}
        {arcana?.id && exportSettings ? (
          <>
            <p className="text-red-600 text-xs">
              <Trans i18nKey="description.arcana_warn" />
            </p>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="exportArcana"
                checked={exportArcana}
                onChange={handleCheckboxChangeArcana}
                className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${
                  !arcana.id ? "bg-gray-400 cursor-not-allowed" : ""
                }`}
                disabled={!arcana.id || !isArcanaSupported}
              />
              <label
                htmlFor="exportArcana"
                className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none"
              >
                <Trans i18nKey="description.exportArcana" />
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
            onChange={handleCheckboxChange}
            className="h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out"
          />
          <label
            htmlFor="exportSettings"
            className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none"
          >
            <Trans i18nKey="description.exportSettings" />
          </label>
        </div>

        {/* Export Images Checkbox */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="exportImage"
            checked={exportImage}
            onChange={handleCheckboxChangeImages}
            className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${
              !containsImage ? "bg-gray-400 cursor-not-allowed" : ""
            }`}
            disabled={!containsImage}
          />
          <label
            htmlFor="exportImage"
            className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none"
          >
            <Trans i18nKey="description.exportImages" />
          </label>
        </div>

        {/* Export Button */}
        <div className="flex justify-end w-full">
          <button
            onClick={handleExport}
            type="button"
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none text-sm"
          >
            <Trans i18nKey="description.export" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}