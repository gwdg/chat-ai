/* eslint-disable no-unused-vars */
//Libraries
import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import jsPDF from "jspdf";
import { useDispatch, useSelector } from "react-redux";
import "react-toastify/dist/ReactToastify.css";

//Components
import Help_Model from "../model/Help_Model";
import Mic_Model from "../model/Mic_Model";
import Cutom_Instructions_Model from "../model/Cutom_Instructions_Model";
import ExportTypeModel from "../model/ExportTypeModel";
import Session_Expired from "../model/Session_Expired";
import Bad_Request_Model from "../model/Bad_Request_Model";
import Help_Model_Custom from "../model/Help_Model_Custom";
import Help_model_Arcanas from "../model/Help_model_Arcanas";
import Help_Model_System from "../model/Help_Model_System";
import Help_Model_Tpop from "../model/Help_Model_Tpop";
import Clear_History_Model from "../model/Clear_History_Model";
import Share_Settings_Model from "../model/Share_Settings_Model";
import Responses from "./Chat/Responses";
import Settings_Panel from "./Chat/Settings_Panel";

//Assets
import Logo from "../assets/chatai-logo-v3-preview.png";

//Hooks and Redux
import {
  setCurrentConversation,
  updateConversation,
} from "../Redux/reducers/conversationsSlice";
import { useToast } from "../hooks/useToast";

function Prompt({ modelSettings, modelList, onModelChange }) {
  // Hooks
  const { notifySuccess, notifyError } = useToast();
  const dispatch = useDispatch();
  const { conversationId } = useParams();

  // Redux state
  const isDarkModeGlobal = useSelector((state) => state.theme.isDarkMode);
  const currentConversation = useSelector((state) =>
    state.conversations?.conversations?.find(
      (conv) => conv.id === conversationId
    )
  );

  // Local useState
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
  const [isDarkMode, setIsDarkMode] = useState(isDarkModeGlobal);
  const [showHistoryModel, setShowHistoryModel] = useState(false);
  const [shareSettingsModel, setShareSettingsModel] = useState(false);
  const [showAdvOpt, setShowAdvOpt] = useState(
    useSelector((state) => state.advOptions.isOpen)
  );

  //Effects
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
  useEffect(() => {
    const root = window.document.documentElement;

    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  //Memo
  const currentModel = useMemo(
    () => modelList?.find((m) => m.name === modelSettings?.model),
    [modelList, modelSettings?.model]
  );
  const isImageSupported = useMemo(
    () => currentModel?.input.includes("image") || false,
    [currentModel]
  );

  //Functions
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

  const toggleAdvOpt = () => {
    setShowAdvOpt(!showAdvOpt);
    dispatch({ type: "SET_ADV" });
  };

  const handleShareSettings = () => {
    if (!localState.settings.systemPrompt) {
      notifyError("System prompt is missing");
      return;
    }

    try {
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

      if (Object.values(settings).some((value) => value === undefined)) {
        throw new Error("Invalid settings detected");
      }

      const settingsString = JSON.stringify(settings);
      const encodedSettings = btoa(settingsString);

      const baseURL = window.location.origin;
      const url = `${baseURL}/chat?settings=${encodedSettings}`;

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

  const exportFile = (value) => {
    if (value === "json") {
      exportJSON(localState.conversation);
    } else if (value === "pdf") {
      exportPDF(localState.conversation);
    } else if (value === "text") {
      exportTextFile(localState.conversation);
    }
  };

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

  const exportTextFile = (conversation) => {
    let exportData = [...conversation];

    const systemMessageIndex = exportData.findIndex(
      (msg) => msg.role === "system"
    );
    if (systemMessageIndex !== -1) {
      exportData[systemMessageIndex] = {
        role: "system",
        content: localState.settings.systemPrompt,
      };
    }

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

    if (localState.exportOptions.exportSettings) {
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

    const blob = new Blob([finalTextContent], { type: "text/plain" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = generateFileName("txt");

    link.click();

    URL.revokeObjectURL(link.href);
  };

  const exportJSON = (conversation) => {
    try {
      let exportData = [...conversation];

      const systemMessageIndex = exportData.findIndex(
        (msg) => msg.role === "system"
      );
      if (systemMessageIndex !== -1) {
        exportData[systemMessageIndex] = {
          role: "system",
          content: localState.settings.systemPrompt,
        };
      }

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

    const COLORS = {
      DEFAULT: [0, 0, 0],
      HEADER_DATE: [150, 150, 150],
      ROLE: [0, 102, 204],
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
        resetTextStyle();
      }
    };

    addHeader(true);
    resetTextStyle();

    let conversationData = [...conversation];

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

    for (const entry of conversationData) {
      addNewPageIfNeeded(lineHeight * 2);

      doc.setFontSize(10);
      doc.setTextColor(...COLORS.ROLE);
      doc.text(`${entry.role}:`, margin, y);
      y += lineHeight;

      resetTextStyle();

      if (typeof entry.content === "string") {
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
                resetTextStyle();
              }
            } else {
              const lines = doc.splitTextToSize(part, contentWidth);
              lines.forEach((line) => {
                addNewPageIfNeeded(lineHeight);
                doc.text(line, margin, y);
                y += lineHeight;
              });
            }
          }
        } else {
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
    addPageNumbers();
    doc.save(generateFileName("pdf"));
  };

  const clearHistory = () => {
    setLocalState((prevState) => ({
      ...prevState,
      responses: [],
      conversation:
        prevState.conversation.length > 0
          ? [prevState.conversation[0]]
          : prevState.conversation,
    }));

    setShowHistoryModel(false);
    notifySuccess("History cleared");
  };

  return (
    <>
      <div className="flex mobile:flex-col flex-row h-full sm:justify-between relative">
        <Responses
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
          clearHistory={clearHistory}
        />
        <Settings_Panel
          selectedFiles={selectedFiles}
          setSelectedFiles={setSelectedFiles}
          modelSettings={modelSettings}
          modelList={modelList}
          currentModel={currentModel}
          isImageSupported={isImageSupported}
          onModelChange={onModelChange}
          showAdvOpt={showAdvOpt}
          toggleAdvOpt={toggleAdvOpt}
          localState={localState}
          setLocalState={setLocalState}
          updateSettings={updateSettings}
          showModel={setShareSettingsModel}
          handleShareSettings={handleShareSettings}
          setShowHelpModel={setShowHelpModel}
          setShowArcanasHelpModel={setShowArcanasHelpModel}
          setShowCustomHelpModel={setShowCustomHelpModel}
          setShowTpopHelpModel={setShowTpopHelpModel}
          setShowSystemHelpModel={setShowSystemHelpModel}
          notifySuccess={notifySuccess}
          notifyError={notifyError}
        />
      </div>

      <>{showHelpModel ? <Help_Model showModel={setShowHelpModel} /> : null}</>

      <div className="">
        {showCustomHelpModel ? (
          <Help_Model_Custom showModel={setShowCustomHelpModel} />
        ) : null}
      </div>

      <div className="">
        {showTpopHelpModel ? (
          <Help_Model_Tpop showModel={setShowTpopHelpModel} />
        ) : null}
      </div>

      <div className="">
        {showSystemHelpModel ? (
          <Help_Model_System showModel={setShowSystemHelpModel} />
        ) : null}
      </div>

      <div className="">
        {showArcanasHelpModel ? (
          <Help_model_Arcanas showModel={setShowArcanasHelpModel} />
        ) : null}
      </div>

      <div className="">
        {showMicModel ? <Mic_Model showModel={setShowMicModel} /> : null}
      </div>

      <div className="">
        {showCusModel ? (
          <Cutom_Instructions_Model showModel={setShowCusModel} />
        ) : null}
      </div>

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

      <div className="">
        {showModelSession ? (
          <Session_Expired showModel={setShowModelSession} />
        ) : null}
      </div>

      <div className="">
        {showBadRequest ? (
          <Bad_Request_Model showModel={setShowBadRequest} />
        ) : null}
      </div>

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
