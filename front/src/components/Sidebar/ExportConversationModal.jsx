import { useState, useEffect } from "react";
import { Trans } from "react-i18next";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import katexStyles from "katex/dist/katex.min.css?inline";
import BaseModal from "../../modals/BaseModal";
import icon_file_json from "../../assets/icons/file_json.svg";
import icon_file_pdf from "../../assets/icons/file_pdf.svg";
import icon_file_text from "../../assets/icons/file_text.svg";
import { getConversation, loadFile, loadFileMeta } from "../../db";
import { useToast } from "../../hooks/useToast";
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
  const [exportMcpServers, setExportMcpServers] = useState(false);
  const [exportFiles, setExportFiles] = useState(false);
  const [containsFiles, setContainsFiles] = useState(true); // TODO set dynamically
  const [conversation, setConversation] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

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
  const mcpServers = conversation?.settings?.mcp_servers;
  const hasMcpServers =
    typeof mcpServers === "string"
      ? mcpServers.trim().length > 0
      : Array.isArray(mcpServers)
        ? mcpServers.length > 0
        : false;

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
      let msg = messages[i];
      if (!messages[i]?.content) continue;
      const role = messages[i]?.role;
      if (!["system", "user", "assistant", "info"].includes(role)) continue;
      const content = messages[i].content;
      let processedMessage = { "role": role };
      if (msg?.feedback) {
        processedMessage.feedback = msg.feedback;
      }
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
      if (i === messages.length - 1
        && processedMessage.role === "user"
        && processedMessage.content === "")
        continue;

      // Handle user-assistant not switching roles
      if (role === "assistant" && expectUser)
        processedMessages.push({ "role": "user", "content": "" })
      else if (role === "user" && !expectUser)
        processedMessages.push({ "role": "assistant", "content": "" })

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
    if (exportMcpServers && hasMcpServers) settings.mcp_servers = conversation.settings.mcp_servers;
    if (conversation?.settings?.top_p) settings.top_p = conversation.settings.top_p;
    if (conversation?.settings?.tools) settings.tools = Object.keys(conversation.settings.tools)
      .filter(t => conversation.settings.tools[t] === true)
      .map(t => ({ type: t }));
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
        const mcpServersText = Array.isArray(settings?.mcp_servers)
          ? settings.mcp_servers.join(", ")
          : settings?.mcp_servers;
        const additionalText =
          `\n\nConversation settings\ntitle: ${conversation.title
          }\nmodel-name: ${settings?.["model-name"]
          }\nmodel: ${settings?.model
          }\ntemperature: ${settings?.temperature
          }\ntop_p: ${settings?.top_p
          }\n${exportArcana && isArcanaSupported && settings?.arcana?.id
            ? `Arcana ID: ${settings.arcana.id}`
            : ""
          }${exportMcpServers && hasMcpServers && mcpServersText
            ? `\nMCP server: ${mcpServersText}`
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
      let exportData = { messages: processedMessages };

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

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const renderMarkdownToPrintableHtml = (markdownText) => {
    try {
      return renderToStaticMarkup(
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[
            [
              rehypeKatex,
              {
                output: "htmlAndMathml",
                throwOnError: false,
                strict: false,
                trust: false,
              },
            ],
          ]}
        >
          {markdownText}
        </ReactMarkdown>
      );
    } catch (error) {
      return `<div class="pdf-export-pre" dir="auto">${escapeHtml(markdownText)}</div>`;
    }
  };

  const buildPrintableMessageHtml = (content) => {
    if (typeof content !== "string") {
      return `<div class="pdf-export-pre" dir="auto">${escapeHtml("Content unavailable")}</div>`;
    }

    return `<div class="pdf-export-markdown" dir="auto">${renderMarkdownToPrintableHtml(content)}</div>`;
  };

  const buildPrintableExportHtml = ({ processedMessages, processedSettings, fileTitle }) => {
    const settingsLines = [];

    if (exportSettings && processedSettings) {
      settingsLines.push(`title: ${conversation?.title ?? ""}`);
      settingsLines.push(`model: ${processedSettings?.model ?? ""}`);
      settingsLines.push(`model name: ${processedSettings?.["model-name"] ?? ""}`);
      settingsLines.push(`temperature: ${processedSettings?.temperature ?? ""}`);
      settingsLines.push(`top_p: ${processedSettings?.top_p ?? ""}`);

      if (exportArcana && isArcanaSupported && processedSettings?.arcana?.id) {
        settingsLines.push(`Arcana ID ${processedSettings.arcana.id}`);
      }

      if (exportMcpServers && hasMcpServers && processedSettings?.mcp_servers) {
        const mcpServersText = Array.isArray(processedSettings.mcp_servers)
          ? processedSettings.mcp_servers.join(", ")
          : processedSettings.mcp_servers;
        settingsLines.push(`MCP server: ${mcpServersText}`);
      }
    }

    const messagesHtml = processedMessages
      .map((entry) => {
        let contentHtml = "";

        if (typeof entry.content === "string") {
          contentHtml = buildPrintableMessageHtml(entry.content);
        } else if (Array.isArray(entry.content) && exportFiles) {
          contentHtml = entry.content
            .map((item) => {
              if (item?.type === "text") {
                return buildPrintableMessageHtml(item.text || "");
              }

              if (item?.type === "image_url") {
                if (item?.image_url?.url?.startsWith("data:image")) {
                  return `<div class="pdf-export-image-wrap"><img class="pdf-export-image" src="${item.image_url.url}" alt="Embedded image" /></div>`;
                }
                return `<div class="pdf-export-pre" dir="auto">${escapeHtml("[Invalid image format]")}</div>`;
              }

              return "";
            })
            .join("");
        } else {
          contentHtml = `<div class="pdf-export-pre" dir="auto">${escapeHtml("Content unavailable")}</div>`;
        }

        return `
          <section class="pdf-export-message" dir="auto">
            <div class="pdf-export-role">${escapeHtml(entry.role)}:</div>
            ${contentHtml}
          </section>
        `;
      })
      .join("");

    const settingsHtml =
      exportSettings && processedSettings
        ? `
          <section class="pdf-export-settings" dir="auto">
            <div class="pdf-export-settings-title">Conversation settings</div>
            <div class="pdf-export-pre">${escapeHtml(settingsLines.join("\n"))}</div>
          </section>
        `
        : "";

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(fileTitle)}</title>
    <style>
      @page { margin: 14mm 12mm 16mm 12mm; }
      ${katexStyles}
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #111827; }
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .pdf-export-root { max-width: 820px; margin: 0 auto; padding: 0 0 8px; }
      .pdf-export-header {
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 1px solid #e5e7eb;
      }
      .pdf-export-title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 4px;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .pdf-export-date {
        font-size: 11px;
        color: #6b7280;
      }
      .pdf-export-message {
        margin-bottom: 12px;
        padding: 10px 12px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #fff;
        page-break-inside: auto;
        break-inside: auto;
      }
      .pdf-export-role {
        font-weight: 600;
        font-size: 12px;
        color: #0066cc;
        margin-bottom: 6px;
        page-break-after: avoid;
        break-after: avoid;
      }
      .pdf-export-pre {
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .pdf-export-markdown {
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .pdf-export-markdown > *:first-child { margin-top: 0; }
      .pdf-export-markdown > *:last-child { margin-bottom: 0; }
      .pdf-export-markdown p { margin: 0 0 8px; white-space: pre-wrap; }
      .pdf-export-markdown ul,
      .pdf-export-markdown ol { margin: 0 0 8px 20px; padding: 0; }
      .pdf-export-markdown li { margin: 0 0 4px; }
      .pdf-export-markdown h1,
      .pdf-export-markdown h2,
      .pdf-export-markdown h3,
      .pdf-export-markdown h4,
      .pdf-export-markdown h5,
      .pdf-export-markdown h6 {
        margin: 10px 0 6px;
        line-height: 1.3;
      }
      .pdf-export-markdown code {
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        padding: 0 3px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
      }
      .pdf-export-markdown pre {
        margin: 0 0 8px;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 10px;
      }
      .pdf-export-markdown pre code {
        border: 0;
        padding: 0;
        background: transparent;
      }
      .pdf-export-code-label {
        font-size: 11px;
        color: #6b7280;
        margin: 4px 0;
      }
      .pdf-export-code {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
      }
      .pdf-export-image-wrap { margin-top: 8px; }
      .pdf-export-image {
        max-width: 220px;
        max-height: 220px;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
      }
      .pdf-export-settings {
        margin-top: 16px;
        padding-top: 10px;
        border-top: 1px solid #e5e7eb;
      }
      .pdf-export-settings-title {
        font-weight: 600;
        margin-bottom: 8px;
      }
    </style>
  </head>
  <body>
    <div class="pdf-export-root" dir="auto">
      <header class="pdf-export-header">
        <div class="pdf-export-title">${escapeHtml(conversation?.title || "Chat AI Conversation")}</div>
        <div class="pdf-export-date">${escapeHtml(new Date().toLocaleString())}</div>
      </header>
      ${messagesHtml}
      ${settingsHtml}
    </div>
  </body>
</html>`;
  };

  const exportPDFWithBrowserPrint = async ({ processedMessages, processedSettings }) => {
    const fileName = generateFileName("pdf");
    const fileTitle = fileName.replace(/\.pdf$/i, "");
    const printableHtml = buildPrintableExportHtml({ processedMessages, processedSettings, fileTitle });

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.border = "0";

    document.body.appendChild(iframe);

    try {
      const printDoc = iframe.contentDocument;
      const printWindow = iframe.contentWindow;
      if (!printDoc || !printWindow) {
        throw new Error("Failed to create print frame");
      }

      printDoc.open();
      printDoc.write(printableHtml);
      printDoc.close();

      if (printDoc.fonts?.ready) {
        await printDoc.fonts.ready;
      }

      const imageElements = Array.from(printDoc.images || []);
      await Promise.all(
        imageElements.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) {
                if (typeof img.decode === "function") {
                  img.decode().catch(() => null).finally(resolve);
                  return;
                }
                resolve();
                return;
              }
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      );

      await new Promise((resolve) =>
        printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(resolve))
      );

      const cleanup = () => {
        iframe.remove();
      };

      const cleanupTimeout = window.setTimeout(cleanup, 60_000);
      const afterPrintHandler = () => {
        window.clearTimeout(cleanupTimeout);
        cleanup();
      };

      printWindow.addEventListener("afterprint", afterPrintHandler, { once: true });
      printWindow.focus();
      printWindow.print();

    } catch (error) {
      iframe.remove();
      throw error;
    }
  };

  // Export conversation as PDF
  const exportPDF = async () => {
    try {
      let processedMessages = await processMessages();
      const processedSettings = exportSettings ? processSettings() : null;
      await exportPDFWithBrowserPrint({ processedMessages, processedSettings });
    } catch (error) {
      console.log(error)
      notifyError("An error occurred while exporting to PDF");
    }
  };

  // Handle Format Change
  const handleFormatChange = (format) => {
    if (isExporting) return;
    setExportFormat(format);
  };

  // Handle export
  const handleExport = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      await refreshConversation();
      if (exportFormat === "json") {
        await exportJSON();
      } else if (exportFormat === "pdf") {
        await exportPDF();
      } else if (exportFormat === "text") {
        await exportTextFile();
      }
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsExporting(false);
    }
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

  const toggleExportMcpServers = (event) => {
    setExportMcpServers(event.target.checked);
  };

  const handleModalClose = () => {
    if (isExporting) return;
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleModalClose}
      titleKey="export_conversation.title"
      maxWidth="max-w-md"
    >
      <div
        className={`flex flex-col gap-4 ${isExporting ? "opacity-90" : ""}`}
        aria-busy={isExporting}
      >
        {/* Export format options */}
        {exportOptions.map((option) => (
          <div
            key={option.id}
            className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all duration-200
              ${exportFormat === option.id
                ? "border-tertiary bg-gray-100 dark:bg-gray-800"
                : "border-gray-300 dark:border-gray-600"
              }
              ${isExporting ? "opacity-70 cursor-not-allowed" : ""}`}
            onClick={() => {
              if (!isExporting) {
                handleFormatChange(option.id);
              }
            }}
          >
            <img src={option.icon} alt={option.id} className="h-8 w-8" />
            <label
              className={`text-sm ${exportFormat === option.id
                  ? "text-tertiary"
                  : "text-black dark:text-white"
                }`}
            >
              <Trans i18nKey={option.label} />
            </label>
          </div>
        ))}

        {exportFormat === "pdf" && (
          <div className="rounded-lg border border-gray-300 dark:border-gray-600 p-3 flex flex-col gap-3">
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
              PDF export
            </div>
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              A browser print dialog will open. Set destination to "Save as PDF", then click Save.
            </p>
          </div>
        )}

        {/* Arcana Export Option */}
        {arcana?.id && isArcanaSupported && exportSettings ? (
          <>
            {exportArcana && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                <Trans i18nKey="alert.arcana_export" />
              </p>
            )}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="exportArcana"
                checked={exportArcana}
                onChange={toggleExportArcana}
                className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${!arcana.id ? "bg-gray-400 cursor-not-allowed" : ""
                  }`}
                disabled={!arcana?.id || !isArcanaSupported || isExporting}
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

        {/* MCP servers Export Option */}
        {hasMcpServers && exportSettings ? (
          <>
            {exportMcpServers && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                <Trans i18nKey="alert.mcp_export" />
              </p>
            )}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="exportMcpServers"
                checked={exportMcpServers}
                onChange={toggleExportMcpServers}
                className="h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out"
                disabled={isExporting}
              />
              <label
                htmlFor="exportMcpServers"
                className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none"
              >
                <Trans i18nKey="export_conversation.export_mcp_servers" />
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
            disabled={isExporting}
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
            className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${!containsFiles ? "bg-gray-400 cursor-not-allowed" : ""
              }`}
            disabled={!containsFiles || isExporting}
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
            disabled={isExporting}
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 inline-flex"
          >
            {isExporting ? (
              <span className="mx-auto inline-flex items-center gap-2">
                <span
                  className="h-4 w-4 rounded-full border-2 border-white/80 border-t-transparent animate-spin"
                  aria-hidden="true"
                />
                <span>Exporting...</span>
              </span>
            ) : exportFormat === "pdf" ? (
              <span>Open Save as PDF</span>
            ) : (
              <Trans i18nKey="export_conversation.export" />
            )}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
