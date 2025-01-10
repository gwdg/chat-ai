/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
// Libraries and dependencies
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useTranslation, Trans } from "react-i18next";

import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import jsPDF from "jspdf";
import { useDispatch, useSelector } from "react-redux";
import "react-toastify/dist/ReactToastify.css";
import Tooltip from "./Others/Tooltip";

import Help_Model from "../model/Help_Model";
import Mic_Model from "../model/Mic_Model";
import Cutom_Instructions_Model from "../model/Cutom_Instructions_Model";
import ExportTypeModel from "../model/ExportTypeModel";
import Session_Expired from "../model/Session_Expired";
import Bad_Request_Model from "../model/Bad_Request_Model";

import Logo from "../assets/chatai-logo-v3-preview.png"; // Chat AI logo
import Help_Model_Custom from "../model/Help_Model_Custom";
import Help_model_Arcanas from "../model/Help_model_Arcanas";
import Help_Model_System from "../model/Help_Model_System";
import Help_Model_Tpop from "../model/Help_Model_Tpop";
import Clear_History_Model from "../model/Clear_History_Model";
import Share_Settings_Model from "../model/Share_Settings_Model";
import {
  addConversation,
  selectConversations,
  setCurrentConversation,
  updateConversation,
} from "../Redux/reducers/conversationsSlice";
import { useToast } from "../hooks/useToast";
import ArcanaContainer from "./Arcanas/ArcanaContainer";
import Responses from "./Chat/Responses";
import Settings_Panel from "./Chat/Settings_Panel";

const getStatusColor = (status) => {
  switch (status) {
    case "ready":
      return "limegreen";
    case "loading":
      return "orange";
    case "offline":
      return "grey";
    default:
      return "red";
  }
};

function Prompt({ modelSettings, modelList, onModelChange }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const hasProcessedSettings = useRef(false);
  const hasProcessedImport = useRef(false);
  const hasProcessedArcana = useRef(false);
  const { notifySuccess, notifyError } = useToast();

  // Redux State and Dispatch
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const { conversationId } = useParams();

  const isDarkModeGlobal = useSelector((state) => state.theme.isDarkMode);
  const conversations = useSelector(selectConversations);
  const currentConversationId = useSelector(
    (state) => state.conversations.currentConversationId
  );
  const currentConversation = useSelector((state) =>
    state.conversations?.conversations?.find(
      (conv) => conv.id === conversationId
    )
  );

  const [localState, setLocalState] = useState({
    prompt: "",
    responses: [],
    conversation: [],
    settings: {
      model: "",
      model_api: "",
      temperature: null,
      top_p: null,
      systemPrompt: "",
    },
    exportOptions: {
      exportSettings: false,
      exportImage: false,
      exportArcana: false,
    },
    dontShow: {
      dontShowAgain: false,
      dontShowAgainShare: false,
    },
    arcana: {
      id: "",
      key: "",
    },
  });

  useEffect(() => {
    if (conversationId && currentConversation) {
      dispatch(setCurrentConversation(conversationId));
      setLocalState({
        prompt: currentConversation.prompt,
        responses: currentConversation.responses,
        conversation: currentConversation.conversation,
        settings: { ...currentConversation.settings },
        exportOptions: { ...currentConversation.exportOptions },
        dontShow: { ...currentConversation.dontShow },
        arcana: { ...currentConversation.arcana },
      });
    }
  }, [conversationId, currentConversation]);

  useEffect(() => {
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
  }, [localState, currentConversation]);

  const updateLocalState = (updates) => {
    setLocalState((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const updateSettings = (settingUpdates) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...settingUpdates,
      },
    }));
  };

  //Theme for toast

  // Language list for speech recognition

  // All state variables
  const [isOpen, setIsOpen] = useState(false);
  const [showModelSession, setShowModelSession] = useState(false);
  const [showBadRequest, setShowBadRequest] = useState(false);
  const [showHelpModel, setShowHelpModel] = useState(false);
  const [showMicModel, setShowMicModel] = useState(false);
  const [showCustomHelpModel, setShowCustomHelpModel] = useState(false);
  const [showTpopHelpModel, setShowTpopHelpModel] = useState(false);
  const [showSystemHelpModel, setShowSystemHelpModel] = useState(false);
  const [showArcanasHelpModel, setShowArcanasHelpModel] = useState(false);
  const [showCusModel, setShowCusModel] = useState(false);
  const [showFileModel, setShowFileModel] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [direction, setDirection] = useState("down");
  const [isDarkMode, setIsDarkMode] = useState(isDarkModeGlobal);
  const [isHovering, setHovering] = useState(false);
  const [isHoveringTpop, setHoveringTpop] = useState(false);
  const [showHistoryModel, setShowHistoryModel] = useState(false);
  const [shareSettingsModel, setShareSettingsModel] = useState(false);
  const [systemPromptError, setSystemPromptError] = useState("");
  // Computed properties using useMemo

  const currentModel = useMemo(
    () => modelList?.find((m) => m.name === modelSettings?.model),
    [modelList, modelSettings?.model]
  );
  const isImageSupported = useMemo(
    () => currentModel?.input.includes("image") || false,
    [currentModel]
  );

  const modelStatus = useMemo(
    () => ({
      color: currentModel ? getStatusColor(currentModel.status) : "red",
    }),
    [currentModel]
  );
  const [showAdvOpt, setShowAdvOpt] = useState(
    useSelector((state) => state.advOptions.isOpen) // Accessing dark mode state from Redux store
  );

  const dropdownRef = useRef(null);

  useEffect(() => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setDirection(spaceBelow > spaceAbove ? "down" : "up");
    }
  }, [isOpen]);

  // useEffect for theme
  useEffect(() => {
    const root = window.document.documentElement;
    // Add or remove 'dark' class to root element based on dark mode state
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]); // Run this effect when isDarkMode changes


  // Function to detect clicks outside the textarea and container for a given index

  // Handles retrying the conversation

  // Handle model change
  const handleChangeModel = (option) => {
    onModelChange(option.name, option.id);
    setIsOpen(false);
  };

  function formatFileSize(bytes) {
    const units = ["Bytes", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  // Removes a file from selected files
  const removeFile = (index) => {
    const newFiles = JSON.parse(JSON.stringify(selectedFiles));
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  // Reads a file as text

  // Exports conversation to a file
  const exportFile = (value) => {
    // setShowFileModel(true); // Uncomment if you need to show a model before export
    if (value === "json") {
      exportJSON(localState.conversation);
    } else if (value === "pdf") {
      exportPDF(localState.conversation);
    } else if (value === "text") {
      exportTextFile(localState.conversation);
    }
  };

  // Function to generate a consistent file name
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

  // Function to export conversation as a text file
  const exportTextFile = (conversation) => {
    // Start with a copy of the conversation
    let exportData = [...conversation];

    // Update system message with latest system prompt
    const systemMessageIndex = exportData.findIndex(
      (msg) => msg.role === "system"
    );
    if (systemMessageIndex !== -1) {
      exportData[systemMessageIndex] = {
        role: "system",
        content: localState.settings.systemPrompt,
      };
    }

    // Convert conversation JSON to a formatted string
    const textContent = exportData
      .map((msg) => {
        let contentString = `${msg.role.toUpperCase()}: `;

        // Check if content is an array (i.e., contains text and image types)
        if (Array.isArray(msg.content)) {
          msg.content.forEach((item) => {
            if (item.type === "text") {
              contentString += `${item.text}\n`; // Add text part
            } else if (item.type === "image_url") {
              if (localState.exportOptions.exportImage) {
                contentString += "[Image]\n"; // Add image placeholder if exportImage is true
              }
            }
          });
        } else {
          // For text-only content
          contentString += msg.content;
        }

        return contentString;
      })
      .join("\n\n");

    let finalTextContent = textContent;

    if (localState.exportOptions.exportSettings) {
      // Append model information at the end of the text file
      const additionalText = `\n\nSettings used\nmodel-name: ${
        localState.settings.model
      }\nmodel: ${localState.settings.model_api}\ntemperature: ${
        localState.settings.temperature
      }\ntop_p: ${localState.settings.top_p}${
        localState.exportOptions.exportArcana
          ? `\nArcana: {\n  id: ${localState.arcana.id},\n  key: ${localState.arcana.key}\n}`
          : ""
      }`;
      finalTextContent += additionalText;
    }

    // Create a blob from the final string
    const blob = new Blob([finalTextContent], { type: "text/plain" });

    // Create a link element
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = generateFileName("txt"); // Set the consistent file name

    // Trigger the download
    link.click();

    // Clean up the object URL
    URL.revokeObjectURL(link.href);
  };

  // Exports conversation to a JSON file
  const exportJSON = (conversation) => {
    try {
      // Start with a copy of the conversation
      let exportData = [...conversation];

      // Update system message with latest system prompt
      const systemMessageIndex = exportData.findIndex(
        (msg) => msg.role === "system"
      );
      if (systemMessageIndex !== -1) {
        exportData[systemMessageIndex] = {
          role: "system",
          content: localState.settings.systemPrompt,
        };
      }

      // Continue with the rest of the export logic
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

      if (localState.exportOptions.exportSettings) {
        const settingsObject = {
          "model-name": localState.settings.model,
          model: localState.settings.model_api,
          temperature: localState.settings.temperature,
          top_p: localState.settings.top_p,
          ...(localState.exportOptions.exportArcana && {
            arcana: {
              id: localState.arcana.id,
              key: localState.arcana.key,
            },
          }),
        };

        exportData = { ...settingsObject, messages: exportData };
      }

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

  // Function to export conversation as a PDF file
  const exportPDF = async (conversation) => {
    const doc = new jsPDF();
    doc.setProperties({
      title: "CHAT AI Conversation",
      subject: "History",
      author: "CHAT-AI",
      keywords: "LLM Generated",
      creator: "LLM",
    });
    doc.setFont("helvetica");

    // Define colors as constants for consistency
    const COLORS = {
      DEFAULT: [0, 0, 0], // Black
      HEADER_DATE: [150, 150, 150], // Gray for date
      ROLE: [0, 102, 204], // Blue for role names
    };

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    const lineHeight = 7;
    let y = margin;
    const headerHeight = 25;

    const addHeader = (isFirstPage) => {
      y = margin;
      if (isFirstPage) {
        doc.addImage(Logo, "PNG", margin, margin, 20, 10);
      }
      const date = new Date().toLocaleDateString();
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.HEADER_DATE);
      doc.text(date, pageWidth - margin - 5, margin + 10, { align: "right" });
      doc.line(margin, headerHeight, pageWidth - margin, headerHeight);
      y = headerHeight + 10;
    };

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

    const resetTextStyle = () => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.DEFAULT);
    };

    const addNewPageIfNeeded = (spaceNeeded) => {
      if (y + spaceNeeded > pageHeight - margin) {
        doc.addPage();
        addHeader(false);
        resetTextStyle(); // Reset text style after new page
      }
    };

    // Initialize the PDF
    addHeader(true);
    resetTextStyle();

    // Process conversation
    let conversationData = [...conversation];

    // Update system message with latest system prompt
    const systemMessageIndex = conversationData.findIndex(
      (msg) => msg.role === "system"
    );
    if (systemMessageIndex !== -1) {
      conversationData[systemMessageIndex] = {
        role: "system",
        content: localState.settings.systemPrompt,
      };
    }

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

    // Render conversation content
    for (const entry of conversationData) {
      addNewPageIfNeeded(lineHeight * 2);

      // Role header
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.ROLE);
      doc.text(`${entry.role}:`, margin, y);
      y += lineHeight;

      // Reset to default style for content
      resetTextStyle();

      if (typeof entry.content === "string") {
        if (entry.content.includes("```")) {
          // Handle code blocks
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

                doc.setFillColor(240, 240, 240);
                doc.rect(
                  margin,
                  y,
                  contentWidth,
                  lineHeight * codeLines.length,
                  "F"
                );
                doc.setFont("Courier", "normal");
                codeLines.forEach((line, index) => {
                  doc.text(line, margin + 5, y + 5 + index * lineHeight);
                });
                y += lineHeight * (codeLines.length + 0.5);
                resetTextStyle(); // Reset after code block
              }
            } else {
              // Normal text
              const lines = doc.splitTextToSize(part, contentWidth);
              lines.forEach((line) => {
                addNewPageIfNeeded(lineHeight);
                doc.text(line, margin, y);
                y += lineHeight;
              });
            }
          }
        } else {
          // Regular text content
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
        entry.content.forEach((item) => {
          if (item.type === "text") {
            const lines = doc.splitTextToSize(item.text, contentWidth);
            lines.forEach((line) => {
              addNewPageIfNeeded(lineHeight);
              doc.text(line, margin, y);
              y += lineHeight;
            });
          } else if (item.type === "image_url") {
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
        addNewPageIfNeeded(lineHeight);
        doc.text("Content unavailable", margin, y);
        y += lineHeight;
      }

      y += lineHeight;
    }

    // Add settings information
    if (localState.exportOptions.exportSettings) {
      addNewPageIfNeeded(
        lineHeight * (localState.exportOptions.exportArcana ? 7 : 5)
      );
      y += lineHeight * 2;

      resetTextStyle();
      doc.text(`Settings used`, margin, y);
      y += lineHeight;
      doc.text(`model-name: ${modelSettings.model}`, margin, y);
      y += lineHeight;
      doc.text(`model: ${localState.settings.model_api}`, margin, y);
      y += lineHeight;
      doc.text(`temperature: ${localState.settings.temperature}`, margin, y);
      y += lineHeight;
      doc.text(`top_p: ${localState.settings.top_p}`, margin, y);
      y += lineHeight;

      if (localState.exportOptions.exportArcana) {
        doc.text(`Arcana: {`, margin, y);
        y += lineHeight;
        doc.text(`  id: ${localState.arcana.id}`, margin, y);
        y += lineHeight;
        doc.text(`  key: ${localState.arcana.key}`, margin, y);
        y += lineHeight;
        doc.text(`}`, margin, y);
        y += lineHeight;
      }
    }
    // Add page numbers and save
    addPageNumbers();
    doc.save(generateFileName("pdf"));
  };

  const toggleAdvOpt = () => {
    setShowAdvOpt(!showAdvOpt);
    dispatch({ type: "SET_ADV" });
  };

  // Handles changing the selected model
  const toggleOpen = () => setIsOpen(!isOpen);

  const handleChangeTemp = (newValue) => {
    const numVal = parseFloat(newValue);
    updateSettings({ temperature: numVal });
  };

  const handleChangeTpop = (newValue) => {
    const numVal = parseFloat(newValue);
    updateSettings({ top_p: numVal });
  };

  const resetDefault = () => {
    let updatedConversation = localState.conversation.map((item) => {
      if (item.role === "system") {
        return { ...item, content: "You are a helpful assistant" };
      } else {
        return item;
      }
    });
    setLocalState((prevState) => ({
      ...prevState,
      conversation: updatedConversation,
      settings: {
        ...prevState.settings,
        temperature: 0.5,
        top_p: 0.5,
      },
    }));
    updateSettings({ systemPrompt: "You are a helpful assistant" });
  };

  const handleInstructionsChange = (event) => {
    const { value } = event.target;

    // Clear error when user starts typing
    if (systemPromptError) {
      setSystemPromptError("");
    }

    setLocalState((prevState) => ({
      ...prevState,
      settings: {
        ...prevState.settings,
        systemPrompt: value,
      },
    }));
  };

  const validateSystemPrompt = () => {
    if (!localState.settings.systemPrompt?.trim()) {
      setSystemPromptError(t("description.custom6")); // Your error message
      return false;
    }
    return true;
  };

  useEffect(() => {
    const handleSettings = async () => {
      const encodedSettings = searchParams.get("settings");

      if (
        encodedSettings &&
        location.pathname === "/chat" &&
        !hasProcessedSettings.current
      ) {
        try {
          hasProcessedSettings.current = true;

          // Try to decode the settings
          const decodedSettings = atob(encodedSettings);
          const settings = JSON.parse(decodedSettings);

          const action = dispatch(addConversation());
          const newId = action.payload?.id;

          if (newId) {
            setLocalState((prev) => ({
              ...prev,
              settings: {
                systemPrompt: settings.systemPrompt
                  ? decodeURIComponent(settings.systemPrompt)
                  : "You are a helpful assistant",
                model: settings.model_name || "Meta Llama 3.1 8B Instruct",
                model_api: settings.model || "meta-llama-3.1-8b-instruct",
                temperature: settings.temperature || 0.5,
                top_p: settings.top_p || 0.5,
              },
              ...(settings.arcana && {
                arcana: {
                  id: settings.arcana.id,
                  key: settings.arcana.key,
                },
              }),
            }));

            dispatch(
              updateConversation({
                id: newId,
                updates: {
                  settings: {
                    systemPrompt: settings.systemPrompt
                      ? decodeURIComponent(settings.systemPrompt)
                      : "You are a helpful assistant",
                    model: settings.model_name || "Meta Llama 3.1 8B Instruct",
                    model_api: settings.model || "meta-llama-3.1-8b-instruct",
                    temperature: settings.temperature ?? 0.5,
                    top_p: settings.top_p ?? 0.5,
                  },
                  ...(settings.arcana && {
                    arcana: {
                      id: settings.arcana.id,
                      key: settings.arcana.key,
                    },
                  }),
                },
              })
            );

            // Navigate to new conversation
            navigate(`/chat/${newId}`, { replace: true });
          }
        } catch (error) {
          console.error("Error applying shared settings:", error);
          notifyError(
            "Invalid settings in shared link. Redirecting to default chat."
          );
          navigate(`/chat/${currentConversationId}`, { replace: true });
          window.location.reload();
        }
      }
    };

    if (conversations.length > 0) {
      handleSettings();
    }
  }, [searchParams, location.pathname, conversations.length]);

  useEffect(() => {
    const handleImport = async () => {
      const importUrl = searchParams.get("import");

      if (
        importUrl &&
        location.pathname === "/chat" &&
        !hasProcessedImport.current
      ) {
        try {
          hasProcessedImport.current = true;
          const response = await fetch(importUrl);

          if (!response.ok) {
            if (response.status >= 400 && response.status < 500) {
              throw new Error("Client Error: Failed to fetch the JSON file.");
            } else if (response.status >= 500) {
              throw new Error("Server Error: Please try again later.");
            } else {
              throw new Error("Unknown Error: Could not fetch the JSON file.");
            }
          }

          const parsedData = await response.json();
          const action = dispatch(addConversation());
          const newId = action.payload?.id;

          if (newId) {
            if (Array.isArray(parsedData.messages)) {
              // Handle object with messages format
              let newArray = [];
              for (let i = 0; i < parsedData.messages.length; i++) {
                if (
                  parsedData.messages[i].role === "user" &&
                  parsedData.messages[i + 1]?.role === "assistant"
                ) {
                  newArray.push({
                    prompt: parsedData.messages[i].content,
                    response: parsedData.messages[i + 1]?.content,
                  });
                }
              }

              const systemMessage = parsedData?.messages?.find(
                (message) => message.role === "system"
              );

              dispatch(
                updateConversation({
                  id: newId,
                  updates: {
                    title: parsedData.messages[1].content,
                    conversation: parsedData.messages,
                    responses: newArray,
                    settings: {
                      systemPrompt:
                        systemMessage?.content || "You are a helpful assistant",
                      model:
                        parsedData["model-name"] ||
                        parsedData.model ||
                        "Meta Llama 3.1 8B Instruct",
                      model_api:
                        parsedData.model || "meta-llama-3.1-8b-instruct",
                      temperature: parsedData.temperature || 0.5,
                      top_p: parsedData.top_p || 0.5,
                    },
                    ...(parsedData.arcana && {
                      arcana: {
                        id: parsedData.arcana.id,
                        key: parsedData.arcana.key,
                      },
                    }),
                  },
                })
              );
            } else if (Array.isArray(parsedData)) {
              // Handle array format
              let newArray = [];
              for (let i = 0; i < parsedData.length; i++) {
                if (
                  parsedData[i].role === "user" &&
                  parsedData[i + 1]?.role === "assistant"
                ) {
                  newArray.push({
                    prompt: parsedData[i].content,
                    response: parsedData[i + 1]?.content,
                  });
                }
              }

              const systemMessage = parsedData?.find(
                (message) => message.role === "system"
              );

              dispatch(
                updateConversation({
                  id: newId,
                  updates: {
                    title: parsedData[1].content,
                    conversation: parsedData,
                    responses: newArray,
                    settings: {
                      systemPrompt:
                        systemMessage?.content || "You are a helpful assistant",
                      model: "Meta Llama 3.1 8B Instruct",
                      model_api: "meta-llama-3.1-8b-instruct",
                      temperature: 0.5,
                      top_p: 0.5,
                    },
                  },
                })
              );
            }

            // Navigate after update
            navigate(`/chat/${newId}`, { replace: true });
            notifySuccess("Chat imported successfully");
          }
        } catch (error) {
          if (error.name === "TypeError") {
            notifyError("Network Error: Unable to reach the server.");
            navigate(`/chat/${currentConversationId}`, { replace: true });
            window.location.reload();
          } else if (error.message.includes("Client Error")) {
            notifyError("Client Error: The provided link might be incorrect.");
            navigate(`/chat/${currentConversationId}`, { replace: true });
            window.location.reload();
          } else if (error.message.includes("Server Error")) {
            notifyError("Server Error: Please try again later.");
            navigate(`/chat/${currentConversationId}`, { replace: true });
            window.location.reload();
          } else {
            notifyError(error.message || "An unexpected error occurred.");
            navigate(`/chat/${currentConversationId}`, { replace: true });
            window.location.reload();
          }
          console.error("Error:", error);
          navigate(`/chat/${currentConversationId}`, { replace: true });
          window.location.reload();
        }
      }
    };

    if (conversations.length > 0) {
      handleImport();
    }
  }, [searchParams, location.pathname, conversations.length]);

  useEffect(() => {
    const handleArcanaParams = async () => {
      const arcanaID = searchParams.get("arcana");
      const arcanaKey = searchParams.get("arcana_key");

      if (
        arcanaID &&
        arcanaKey &&
        location.pathname === "/chat" &&
        !hasProcessedArcana.current
      ) {
        try {
          hasProcessedArcana.current = true;

          setLocalState((prev) => ({
            ...prev,
            arcana: {
              id: decodeURIComponent(arcanaID),
              key: decodeURIComponent(arcanaKey),
            },
            settings: {
              ...prev.settings,
              temperature: 0,
              top_p: 0.05,
            },
          }));
          const currentConversation = conversations?.find(
            (conv) => conv.id === currentConversationId
          );
          dispatch(
            updateConversation({
              id: currentConversationId,
              updates: {
                arcana: {
                  id: decodeURIComponent(arcanaID),
                  key: decodeURIComponent(arcanaKey),
                },
                settings: {
                  ...currentConversation.settings,
                  temperature: 0,
                  top_p: 0.05,
                },
              },
            })
          );
          navigate(`/chat/${currentConversationId}`, { replace: true });
        } catch (error) {
          console.error("Error processing arcana parameters:", error);
          hasProcessedArcana.current = false;
          notifyError(
            "Invalid arcana parameters in shared link. Redirecting to default chat."
          );
          navigate(`/chat/${currentConversationId}`, { replace: true });
        }
      }
    };

    if (conversations.length > 0) {
      handleArcanaParams();
    }
  }, [
    searchParams,
    location.pathname,
    conversations.length,
    currentConversationId,
    dispatch,
    navigate,
  ]);

  const handleShareSettingsModel = () => {
    if (localState.dontShow.dontShowAgainShare) {
      handleShareSettings();
    } else {
      setShareSettingsModel(true);
    }
  };

  const handleShareSettings = () => {
    if (!localState.settings.systemPrompt) {
      notifyError("System prompt is missing");
      return;
    }

    try {
      // Build the settings object with validation
      const settings = {
        systemPrompt: encodeURIComponent(localState.settings.systemPrompt),
        model_name: localState.settings.model,
        model: localState.settings.model_api,
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
        ...(localState.exportOptions.exportArcana && {
          arcana: {
            id: localState.arcana.id,
            key: localState.arcana.key,
          },
        }),
      };

      // Validate the settings object
      if (Object.values(settings).some((value) => value === undefined)) {
        throw new Error("Invalid settings detected");
      }

      // Convert settings object to a Base64-encoded string
      const settingsString = JSON.stringify(settings);
      const encodedSettings = btoa(settingsString);

      // Get the base URL dynamically and always use /chat path
      const baseURL = window.location.origin;
      const url = `${baseURL}/chat?settings=${encodedSettings}`;

      // Copy to clipboard
      navigator.clipboard
        .writeText(url)
        .then(() => {
          notifySuccess("URL copied successfully");
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
          notifyError("Failed to copy URL to clipboard");
        });

      setShareSettingsModel(false);
    } catch (error) {
      console.error("Error generating settings URL:", error);
      notifyError("Failed to generate settings URL");
    }
  };

  return (
    <>
      <div className="flex mobile:flex-col flex-row h-full sm:justify-between relative">
        {/* Section 1 */}
        <Responses
          // UI State

          // UI State
          modelList={modelList}
          selectedFiles={selectedFiles}
          setSelectedFiles={setSelectedFiles}
          localState={localState}
          setLocalState={setLocalState}
          isImageSupported={isImageSupported}
          setShowModelSession={setShowModelSession}
          setShowBadRequest={setShowBadRequest}
          setShowFileModel={setShowFileModel}
          setShowMicModel={setShowMicModel}
          setShowHistoryModel={setShowHistoryModel}
          toggleAdvOpt={toggleAdvOpt}
          updateLocalState={updateLocalState}
          updateSettings={updateSettings}
        />
        {/* Section 2 */}
        <Settings_Panel
          // File Management
          selectedFiles={selectedFiles}
          setSelectedFiles={setSelectedFiles}
          removeFile={removeFile}
          formatFileSize={formatFileSize}
          // Advanced Options State
          showAdvOpt={showAdvOpt}
          showHelpModel={showHelpModel}
          showArcanasHelpModel={showArcanasHelpModel}
          showCustomHelpModel={showCustomHelpModel}
          showTpopHelpModel={showTpopHelpModel}
          showSystemHelpModel={showSystemHelpModel}
          // Model Settings
          modelSettings={modelSettings}
          modelStatus={modelStatus}
          modelList={modelList}
          isImageSupported={isImageSupported}
          // Dropdown State
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          direction={direction}
          dropdownRef={dropdownRef}
          toggleOpen={toggleOpen}
          // Local State Management
          localState={localState}
          setLocalState={setLocalState}
          // Temperature Slider
          isHovering={isHovering}
          setHovering={setHovering}
          handleChangeTemp={handleChangeTemp}
          // Top_p Slider
          isHoveringTpop={isHoveringTpop}
          setHoveringTpop={setHoveringTpop}
          handleChangeTpop={handleChangeTpop}
          // System Prompt
          systemPromptError={systemPromptError}
          handleInstructionsChange={handleInstructionsChange}
          validateSystemPrompt={validateSystemPrompt}
          // Event Handlers
          handleChangeModel={handleChangeModel}
          toggleAdvOpt={toggleAdvOpt}
          handleShareSettingsModel={handleShareSettingsModel}
          resetDefault={resetDefault}
          getStatusColor={getStatusColor}
          // Help Modal Controls
          setShowHelpModel={setShowHelpModel}
          setShowArcanasHelpModel={setShowArcanasHelpModel}
          setShowCustomHelpModel={setShowCustomHelpModel}
          setShowTpopHelpModel={setShowTpopHelpModel}
          setShowSystemHelpModel={setShowSystemHelpModel}
          // Translation
          t={t}
          // Components
          ArcanaContainer={ArcanaContainer}
        />
      </div>

      {/* Help model for info on changing model */}
      <>{showHelpModel ? <Help_Model showModel={setShowHelpModel} /> : null}</>

      {/* Help model for info on custom temperature */}
      <div className="">
        {showCustomHelpModel ? (
          <Help_Model_Custom showModel={setShowCustomHelpModel} />
        ) : null}
      </div>

      {/* Help model for info on custom temperature */}
      <div className="">
        {showTpopHelpModel ? (
          <Help_Model_Tpop showModel={setShowTpopHelpModel} />
        ) : null}
      </div>

      {/* Help model for info on system prompt */}
      <div className="">
        {showSystemHelpModel ? (
          <Help_Model_System showModel={setShowSystemHelpModel} />
        ) : null}
      </div>

      {/* Help model for info on custom instructions */}
      <div className="">
        {showArcanasHelpModel ? (
          <Help_model_Arcanas showModel={setShowArcanasHelpModel} />
        ) : null}
      </div>

      {/* Pop-up if microphone permission is not given or denied */}
      <div className="">
        {showMicModel ? <Mic_Model showModel={setShowMicModel} /> : null}
      </div>

      {/* Pop-up for info about custom instructions */}
      <div className="">
        {showCusModel ? (
          <Cutom_Instructions_Model showModel={setShowCusModel} />
        ) : null}
      </div>

      {/* Pop-up  for export file model*/}
      <div className="">
        {showFileModel ? (
          <ExportTypeModel
            arcana={localState.arcana}
            showModel={setShowFileModel}
            exportFile={exportFile}
            conversation={localState.conversation}
            exportSettings={localState.exportOptions.exportSettings}
            exportImage={localState.exportOptions.exportImage}
            exportArcana={localState.exportOptions.exportArcana}
            setLocalState={setLocalState}
          />
        ) : null}
      </div>

      {/* Pop-up  for session expired model*/}
      <div className="">
        {showModelSession ? (
          <Session_Expired showModel={setShowModelSession} />
        ) : null}
      </div>

      {/* Pop-up token limit exceed*/}
      <div className="">
        {showBadRequest ? (
          <Bad_Request_Model showModel={setShowBadRequest} />
        ) : null}
      </div>

      {/* Pop-up clear history*/}
      <div className="">
        {showHistoryModel ? (
          <Clear_History_Model
            showModel={setShowHistoryModel}
            clearHistory={clearHistory}
            dontShowAgain={localState.dontShow.dontShowAgain}
            setLocalState={setLocalState}
          />
        ) : null}
      </div>

      {/* Pop-up share settings*/}
      <div className="">
        {shareSettingsModel ? (
          <Share_Settings_Model
            arcana={localState.arcana}
            exportArcana={localState.exportOptions.exportArcana}
            showModel={setShareSettingsModel}
            handleShareSettings={handleShareSettings}
            dontShowAgainShare={localState.dontShow.dontShowAgainShare}
            setLocalState={setLocalState}
          />
        ) : null}
      </div>
    </>
  );
}

export default Prompt;
