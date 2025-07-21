/* eslint-disable no-unused-vars */
// Core imports
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import jsPDF from "jspdf";
import { useDispatch, useSelector } from "react-redux";
import "react-toastify/dist/ReactToastify.css";

// Modals and components imports
import HelpModal from "../../modals/HelpModal";
import MicModal from "../../modals/MicModal";
import CustomInstructionsModal from "../../modals/CustomInstructionsModal";
import ExportTypeModal from "../../modals/ExportTypeModal";
import SessionExpiredModal from "../../modals/SessionExpiredModal";
import BadRequestModal from "../../modals/BadRequestModal";
import HelpCustomInstructionsModal from "../../modals/HelpCustomInstructionsModal";
import HelpArcanaModal from "../../modals/HelpArcanaModal";
import HelpSystemModal from "../../modals/HelpSystemModal";
import HelpTopPModal from "../../modals/HelpTopPModal";
import ClearHistoryModal from "../../modals/ClearHistoryModal";
import ShareSettingsModal from "../../modals/ShareSettingsModal";
import Conversation from "./Conversation";
import SettingsPanel from "./SettingsPanel";

//Assets
import Logo from "../../assets/chatai-logo-v3-preview.png";

//Hooks and Redux
import {
  setCurrentConversation,
  updateConversation,
} from "../../Redux/reducers/conversationsSlice";
import { useToast } from "../../hooks/useToast";
import PdfNotProcessedModal from "../../modals/PdfNotProcessedModal";
import PreviewModal from "../../modals/PreviewModal";
import FileAlertModal from "../../modals/FileAlertModal";
import { toggleOption } from "../../Redux/actions/advancedOptionsAction";
import ClearMemoryModal from "../../modals/ClearMemoryModal";
import UserMemoryModal from "../../modals/UserMemoryModal";
import HelpMemoryModal from "../../modals/HelpMemoryModal";

function ChatWindow({
  modelSettings,
  modelList,
  onModelChange,
  showClearMemoryModal,
  setShowClearMemoryModal,
  showMemoryModal,
  setShowMemoryModal,
  userData,
}) {
  // Hooks
  const { notifySuccess, notifyError } = useToast();
  const dispatch = useDispatch();
  const { conversationId } = useParams();

  // Redux selectors
  const isDarkModeGlobal = useSelector((state) => state.theme.isDarkMode);
  const currentConversation = useSelector((state) =>
    state.conversations?.conversations?.find(
      (conv) => conv.id === conversationId
    )
  );

  // Initialize chat state
  const [localState, setLocalState] = useState({
    title: "",
    prompt: "",
    responses: [],
    conversation: [],
    settings: {
      ["model-name"]: "",
      model: "",
      temperature: null,
      top_p: null,
      systemPrompt: "",
      memory: 2,
    },
    exportOptions: {
      exportSettings: false,
      exportImage: false,
      exportArcana: false,
    },
    dontShow: {
      dontShowAgain: false,
      dontShowAgainShare: false,
      dontShowAgainMemory: false,
    },
    arcana: {
      id: "",
      //      key: "",
    },
  });
  const [isActive, setIsActive] = useState(false);

  // Modal states
  const [showModalSession, setShowModalSession] = useState(false);
  const [showBadRequest, setShowBadRequest] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showMicModal, setShowMicModal] = useState(false);
  const [showCustomHelpModal, setShowCustomHelpModal] = useState(false);
  const [showTopPHelpModal, setShowTopPHelpModal] = useState(false);
  const [showMemoryHelpModal, setShowMemoryHelpModal] = useState(false);
  const [showSystemHelpModal, setShowSystemHelpModal] = useState(false);
  const [showArcanasHelpModal, setShowArcanasHelpModal] = useState(false);
  const [showCusModal, setShowCusModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(isDarkModeGlobal);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [shareSettingsModal, setShareSettingsModal] = useState(false);
  const [pdfNotProcessedModal, setPdfNotProcessedModal] = useState(false);
  const [showAdvOpt, setShowAdvOpt] = useState(
    useSelector((state) => state.advOptions.isOpen)
  );
  const [previewFile, setPreviewFile] = useState(null);
  const [fileAlertModal, setFileAlertModal] = useState(null);

  //Refs
  const isIntentionalRefresh = useRef(false);

  // ==== EFFECTS SECTION ====

  // Effect 1: Initializes local state when conversation ID or current conversation changes
  useEffect(() => {
    // Only proceed if both conversationId and currentConversation exist
    if (conversationId && currentConversation) {
      // Update the current conversation in Redux store
      dispatch(setCurrentConversation(conversationId));

      // Initialize local state with all conversation data
      setLocalState({
        title: currentConversation.title, // Current title
        prompt: currentConversation.prompt, // Current prompt text
        responses: currentConversation.responses, // Array of AI responses
        conversation: currentConversation.conversation, // Full conversation history
        settings: { ...currentConversation.settings }, // Chat settings (temperature, etc.)
        exportOptions: { ...currentConversation.exportOptions }, // Export preferences
        dontShow: { ...currentConversation.dontShow }, // UI visibility settings
        arcana: { ...currentConversation.arcana }, // Arcana-specific settings
      });
    }
  }, [conversationId, currentConversation, dispatch]);

  // Effect 2: Debounced auto-save of conversation changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsActive(!document.hidden);
    };

    // Initial state
    setIsActive(!document.hidden);

    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Only dispatch updateConversation if this tab has focus
  useEffect(() => {
    // Only update if this tab is active
    if (!isActive) return;

    const timer = setTimeout(() => {
      if (currentConversation) {
        dispatch(
          updateConversation({
            id: conversationId,
            updates: {
              ...localState,
              lastModified: new Date().toISOString(),
            },
          })
        );
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localState, currentConversation, conversationId, dispatch, isActive]);

  // Effect 3: Handle dark mode toggling
  useEffect(() => {
    const root = window.document.documentElement;

    // Toggle dark mode class on root element
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  // ==== MEMOIZED VALUES ====

  // Memoize current model details to prevent unnecessary recalculations
  const currentModel = useMemo(
    () => modelList?.find((m) => m.name === modelSettings["model-name"]),
    [modelList, modelSettings]
  );

  // Memoize whether current model supports image input
  const isImageSupported = useMemo(
    () => currentModel?.input.includes("image") || false,
    [currentModel]
  );

  // Memoize whether current model supports image input
  const isThoughtSupported = useMemo(
    () => currentModel?.output.includes("thought") || false,
    [currentModel]
  );

  // Memoize whether current model supports image input
  const isArcanaSupported = useMemo(
    () => currentModel?.input.includes("arcana") || false,
    [currentModel]
  );

  // Memoize whether current model supports image input
  const isVideoSupported = useMemo(
    () => currentModel?.input.includes("video") || false,
    [currentModel]
  );
  // ==== UTILITY FUNCTIONS ====

  // Update partial local state while preserving other values
  const updateLocalState = (updates) => {
    setLocalState((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  // Update settings object within local state
  const updateSettings = (settingUpdates) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...settingUpdates,
      },
    }));
  };

  // Toggle advanced options visibility
  const toggleAdvOpt = () => {
    setShowAdvOpt(!showAdvOpt);
    dispatch(toggleOption());
  };

  // ==== SHARING FUNCTIONALITY ====

  // Generate and copy shareable settings URL
  const handleShareSettings = () => {
    // Validate system prompt exists
    if (!localState.settings.systemPrompt) {
      notifyError("System prompt is missing");
      return;
    }

    try {
      // Prepare settings object for sharing
      const settings = {
        systemPrompt: encodeURIComponent(localState.settings.systemPrompt),
        ["model-name"]: localState.settings["model-name"],
        model: localState.settings.model,
        temperature:
          localState.settings.temperature !== undefined &&
          localState.settings.temperature !== null
            ? Number(localState.settings.temperature)
            : null,
        top_p:
          localState.settings.top_p !== undefined &&
          localState.settings.top_p !== null
            ? Number(localState.settings.top_p)
            : null,
        // Include arcana settings if enabled
        ...(localState.exportOptions.exportArcana &&
          isArcanaSupported && {
            arcana: {
              id: localState.arcana.id,
              // key: localState.arcana.key,
            },
          }),
      };

      // Validate all settings are defined
      if (Object.values(settings).some((value) => value === undefined)) {
        throw new Error("Invalid settings detected");
      }

      // Convert settings to base64 URL
      const settingsString = JSON.stringify(settings);
      const encodedSettings = btoa(settingsString);

      const baseURL = window.location.origin;
      const url = `${baseURL}/chat?settings=${encodedSettings}`;

      // Copy URL to clipboard
      navigator.clipboard
        .writeText(url)
        .then(() => {
          notifySuccess("URL copied successfully");
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
          notifyError("Failed to copy URL to clipboard");
        });

      setShareSettingsModal(false);
    } catch (error) {
      console.error("Error generating settings URL:", error);
      notifyError("Failed to generate settings URL");
    }
  };

  // ==== EXPORT FUNCTIONALITY ====

  // Handle different export format selections
  const exportFile = (value) => {
    if (value === "json") {
      exportJSON(localState.conversation);
    } else if (value === "pdf") {
      exportPDF(localState.conversation);
    } else if (value === "text") {
      exportTextFile(localState.conversation);
    }
  };

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
  const exportTextFile = (conversation) => {
    let exportData = [...conversation];

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
  const exportJSON = (conversation) => {
    try {
      let exportData = [...conversation];

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
    let conversationData = [...conversation];

    // Update system message
    const systemMessageIndex = conversationData.findIndex(
      (msg) => msg.role === "system"
    );
    if (systemMessageIndex !== -1) {
      conversationData[systemMessageIndex] = {
        role: "system",
        content: localState.settings.systemPrompt,
      };
    }

    // Filter images if not enabled
    if (!localState.exportOptions.exportImage) {
      conversationData = conversationData.map((entry) => {
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
    for (const entry of conversationData) {
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

  // Clear conversation history
  const clearHistory = () => {
    setLocalState((prevState) => ({
      ...prevState,
      responses: [], // Clear all responses
      conversation:
        prevState.conversation.length > 0
          ? [prevState.conversation[0]] // Keep only system message if it exists
          : prevState.conversation,
    }));

    setShowHistoryModal(false);
    notifySuccess("History cleared");
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F5" || (e.ctrlKey && e.key === "r")) {
        if (selectedFiles.length > 0) {
          e.preventDefault();
          setFileAlertModal(true);
        }
      }
    };

    const handleBeforeUnload = (e) => {
      if (selectedFiles.length > 0 && !isIntentionalRefresh.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [selectedFiles]);

  return (
    <>
      <div className="flex mobile:flex-col flex-row h-full sm:justify-between relative">
        <Conversation
          modelList={modelList}
          selectedFiles={selectedFiles}
          localState={localState}
          isImageSupported={isImageSupported}
          isVideoSupported={isVideoSupported}
          isThoughtSupported={isThoughtSupported}
          isArcanaSupported={isArcanaSupported}
          setSelectedFiles={setSelectedFiles}
          setLocalState={setLocalState}
          setShowModalSession={setShowModalSession}
          setShowBadRequest={setShowBadRequest}
          setShowFileModal={setShowFileModal}
          setShowMicModal={setShowMicModal}
          setShowHistoryModal={setShowHistoryModal}
          toggleAdvOpt={toggleAdvOpt}
          updateLocalState={updateLocalState}
          updateSettings={updateSettings}
          clearHistory={clearHistory}
          notifySuccess={notifySuccess}
          notifyError={notifyError}
          setPdfNotProcessedModal={setPdfNotProcessedModal}
          showAdvOpt={showAdvOpt}
          setPreviewFile={setPreviewFile}
        />
        <SettingsPanel
          selectedFiles={selectedFiles}
          setSelectedFiles={setSelectedFiles}
          modelSettings={modelSettings}
          modelList={modelList}
          currentModel={currentModel}
          isImageSupported={isImageSupported}
          isVideoSupported={isVideoSupported}
          isThoughtSupported={isThoughtSupported}
          isArcanaSupported={isArcanaSupported}
          onModelChange={onModelChange}
          showAdvOpt={showAdvOpt}
          toggleAdvOpt={toggleAdvOpt}
          localState={localState}
          setLocalState={setLocalState}
          updateSettings={updateSettings}
          setShareSettingsModal={setShareSettingsModal}
          handleShareSettings={handleShareSettings}
          setShowHelpModal={setShowHelpModal}
          setShowArcanasHelpModal={setShowArcanasHelpModal}
          setShowCustomHelpModal={setShowCustomHelpModal}
          setShowTopPHelpModal={setShowTopPHelpModal}
          setShowMemoryHelpModal={setShowMemoryHelpModal}
          setShowSystemHelpModal={setShowSystemHelpModal}
          notifySuccess={notifySuccess}
          notifyError={notifyError}
          setShowModalSession={setShowModalSession}
          setPreviewFile={setPreviewFile}
          userData={userData}
        />
      </div>

      <>{showHelpModal ? <HelpModal showModal={setShowHelpModal} /> : null}</>

      <>
        {showCustomHelpModal ? (
          <HelpCustomInstructionsModal showModal={setShowCustomHelpModal} />
        ) : null}
      </>

      <>
        {showTopPHelpModal ? (
          <HelpTopPModal showModal={setShowTopPHelpModal} />
        ) : null}
      </>

      <>
        {showMemoryHelpModal ? (
          <HelpMemoryModal showModal={setShowMemoryHelpModal} />
        ) : null}
      </>

      <>
        {showSystemHelpModal ? (
          <HelpSystemModal showModal={setShowSystemHelpModal} />
        ) : null}
      </>

      <>
        {showArcanasHelpModal ? (
          <HelpArcanaModal showModal={setShowArcanasHelpModal} />
        ) : null}
      </>

      <>{showMicModal ? <MicModal showModal={setShowMicModal} /> : null}</>

      <>
        {showCusModal ? (
          <CustomInstructionsModal showModal={setShowCusModal} />
        ) : null}
      </>

      <>
        {showFileModal ? (
          <ExportTypeModal
            arcana={localState.arcana}
            showModal={setShowFileModal}
            exportFile={exportFile}
            conversation={localState.conversation}
            exportSettings={localState.exportOptions.exportSettings}
            exportImage={localState.exportOptions.exportImage}
            exportArcana={localState.exportOptions.exportArcana}
            setLocalState={setLocalState}
            isArcanaSupported={isArcanaSupported}
          />
        ) : null}
      </>

      <>
        {showModalSession ? (
          <SessionExpiredModal showModal={setShowModalSession} />
        ) : null}
      </>

      <>
        {showBadRequest ? (
          <BadRequestModal showModal={setShowBadRequest} />
        ) : null}
      </>

      <>
        {showHistoryModal ? (
          <ClearHistoryModal
            showModal={setShowHistoryModal}
            clearHistory={clearHistory}
            dontShowAgain={localState.dontShow.dontShowAgain}
            setLocalState={setLocalState}
          />
        ) : null}
      </>

      <>
        {shareSettingsModal ? (
          <ShareSettingsModal
            arcana={localState.arcana}
            exportArcana={localState.exportOptions.exportArcana}
            showModal={setShareSettingsModal}
            handleShareSettings={handleShareSettings}
            dontShowAgainShare={localState.dontShow.dontShowAgainShare}
            setLocalState={setLocalState}
            isArcanaSupported={isArcanaSupported}
          />
        ) : null}
      </>
      <>
        {pdfNotProcessedModal ? (
          <PdfNotProcessedModal showModal={setPdfNotProcessedModal} />
        ) : null}
      </>
      {previewFile && (
        <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
      {showClearMemoryModal && (
        <ClearMemoryModal
          showModal={setShowClearMemoryModal}
          setLocalState={setLocalState}
          dontShowAgainMemory={localState.dontShow.dontShowAgainMemory}
          localState={localState}
        />
      )}
      {showMemoryModal && (
        <UserMemoryModal
          showModal={setShowMemoryModal}
          setShowClearMemoryModal={setShowClearMemoryModal}
          localState={localState}
        />
      )}
      <>
        {fileAlertModal ? (
          <FileAlertModal
            showModal={setFileAlertModal}
            intentionalRefresh={isIntentionalRefresh}
          />
        ) : null}
      </>
    </>
  );
}

export default ChatWindow;
