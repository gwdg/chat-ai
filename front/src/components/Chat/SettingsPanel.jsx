/* eslint-disable no-unused-vars */
//Libraries
import { Trans, useTranslation } from "react-i18next";
import { useEffect,  useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

//Components
import ArcanaContainer from "../Arcanas/ArcanaContainer";

//Assets
import help from "../../assets/icon_help.svg";
import image_supported from "../../assets/image_supported.svg";
import video_icon from "../../assets/video_icon.svg";
import thought_supported from "../../assets/thought_supported.svg";
import books from "../../assets/books.svg";
import cross from "../../assets/cross.svg";
import dropdown from "../../assets/icon_dropdown.svg";
import uploaded from "../../assets/file_uploaded.svg";
import share_icon from "../../assets/share_icon.svg";

//Redux
import {
  addConversation,
  selectConversations,
  updateConversation,
} from "../../Redux/reducers/conversationsSlice";
import { processPdfDocument } from "../../apis/PdfProcessApi";
import DemandStatusIcon from "../Others/DemandStatusIcon";
import { fetchAvailableModels } from "../../apis/ModelListApi";

const SettingsPanel = ({
  selectedFiles,
  setSelectedFiles,
  modelSettings,
  modelList,
  currentModel,
  isImageSupported,
  isVideoSupported,
  isThoughtSupported,
  isArcanaSupported,
  onModelChange,
  showAdvOpt,
  toggleAdvOpt,
  localState,
  setLocalState,
  updateSettings,
  setShareSettingsModal,
  handleShareSettings,
  setShowHelpModal,
  setShowArcanasHelpModal,
  setShowCustomHelpModal,
  setShowTopPHelpModal,
  setShowSystemHelpModal,
  notifySuccess,
  notifyError,
  setShowModalSession,
  setPreviewFile,
}) => {
  const conversations = useSelector(selectConversations);

  //Hooks
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const currentConversationId = useSelector(
    (state) => state.conversations.currentConversationId
  );

  //Local useStates
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState("down");
  const [isHovering, setHovering] = useState(false);
  const [isHoveringTopP, setHoveringTopP] = useState(false);
  const [systemPromptError, setSystemPromptError] = useState("");
  const [processingFiles, setProcessingFiles] = useState(new Set());

  //Refs
  const hasProcessedSettings = useRef(false);
  const hasProcessedImport = useRef(false);
  const hasProcessedArcana = useRef(false);
  const hasFetchedModels = useRef(false);
  const dropdownRef = useRef(null);

  //Functions
  // Remove a file from the selectedFiles array at specified index
  const removeFile = (index) => {
    // Create deep copy to avoid mutating state directly
    const newFiles = JSON.parse(JSON.stringify(selectedFiles));
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  // Convert file size from bytes to human-readable format (e.g., KB, MB, GB)
  function formatFileSize(bytes) {
    const units = ["Bytes", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    // Keep dividing by 1024 until we reach the appropriate unit
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    // Return formatted string with 2 decimal places and unit
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  // Handle changes to the system instructions/prompt
  const handleInstructionsChange = (event) => {
    const { value } = event.target;

    // Clear any existing error when user starts typing
    if (systemPromptError) {
      setSystemPromptError("");
    }

    // Update system prompt in local state
    setLocalState((prevState) => ({
      ...prevState,
      settings: {
        ...prevState.settings,
        systemPrompt: value,
      },
    }));
  };

  // Reset settings to default values
  const resetDefault = () => {
    // Update system prompt in conversation history
    let updatedConversation = localState.conversation.map((item) => {
      if (item.role === "system") {
        return { ...item, content: "You are a helpful assistant" };
      } else {
        return item;
      }
    });

    // Reset temperature, top_p, and system prompt to defaults
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

  // Validate the system prompt is not empty
  const validateSystemPrompt = () => {
    if (!localState.settings.systemPrompt?.trim()) {
      setSystemPromptError(t("description.custom6"));
      return false;
    }
    return true;
  };

  // Handle model selection change
  const handleChangeModel = (option) => {
    onModelChange(option.name, option.id);
    setIsOpen(false);
  };

  // Toggle dropdown open/close state
  const toggleOpen = () => setIsOpen(!isOpen);

  // Handle temperature setting change
  const handleChangeTemp = (newValue) => {
    // Convert to float and update settings
    const numVal = parseFloat(newValue);
    updateSettings({ temperature: numVal });
  };

  // Handle top_p setting change
  const handleChangeTopP = (newValue) => {
    // Convert to float and update settings
    const numVal = parseFloat(newValue);
    updateSettings({ top_p: numVal });
  };

  // Handle share settings modal display
  const handleShareSettingsModal = () => {
    // Check if user has chosen to not show the modal again
    if (localState.dontShow.dontShowAgainShare) {
      handleShareSettings();
    } else {
      setShareSettingsModal(true);
    }
  };

  // processing function
  const handlePdfProcess = async (file, index) => {
    try {
      setProcessingFiles((prev) => new Set(prev).add(index));

      // Pass the original File object
      const result = await processPdfDocument(file.file);

      if (result.success && result.content) {
        setSelectedFiles((prevFiles) => {
          const newFiles = [...prevFiles];
          newFiles[index] = {
            ...newFiles[index],
            processed: true,
            processedContent: result.content,
          };
          return newFiles;
        });

        notifySuccess("PDF processed successfully");
      } else {
        throw new Error(
          result.error || "No content received from PDF processing"
        );
      }
    } catch (error) {
      setSelectedFiles((prevFiles) => {
        const newFiles = [...prevFiles];
        newFiles[index] = {
          ...newFiles[index],
          processed: false,
        };
        return newFiles;
      });
      console.error("PDF processing error:", error);
      notifyError(`Failed to process PDF: ${error.message}`);
    } finally {
      setProcessingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  // Calculate dropdown direction based on available space
  useEffect(() => {
    if (dropdownRef.current) {
      // Get dropdown position relative to viewport
      const rect = dropdownRef.current.getBoundingClientRect();
      // Calculate available space above and below
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Set direction based on which has more space
      setDirection(spaceBelow > spaceAbove ? "down" : "up");
    }
  }, [isOpen]); // Only recalculate when dropdown opens/closes

  // Handle settings from URL parameters
  useEffect(() => {
    const handleSettings = async () => {
      const encodedSettings = searchParams.get("settings");

      // Only process settings if they exist, we're on chat page, and haven't processed them yet
      if (
        encodedSettings &&
        location.pathname === "/chat" &&
        !hasProcessedSettings.current
      ) {
        try {
          hasProcessedSettings.current = true;

          // Decode and parse settings from URL
          const decodedSettings = atob(encodedSettings);
          const settings = JSON.parse(decodedSettings);

          // Create new conversation
          const action = dispatch(addConversation());
          const newId = action.payload?.id;

          if (newId) {
            // Update local state with decoded settings
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
              // Include arcana settings if present
              ...(settings.arcana && {
                arcana: {
                  id: settings.arcana.id,
                  key: settings.arcana.key,
                },
              }),
            }));

            // Update conversation in Redux store
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

    // Only process if conversations are loaded
    if (conversations.length > 0) {
      handleSettings();
    }
  }, [
    searchParams,
    location.pathname,
    conversations.length,
    currentConversationId,
    dispatch,
    navigate,
    notifyError,
    setLocalState,
  ]);

  const handleBeforeUnload = (e) => {
    if (selectedFiles.length > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  };

  // Handle importing chat from URL
  useEffect(() => {
    const handleImport = async () => {
      const importUrl = searchParams.get("import");

      if (
        !importUrl ||
        location.pathname !== "/chat" ||
        hasProcessedImport.current
      ) {
        return;
      }

      try {
        hasProcessedImport.current = true;
        const response = await fetch(importUrl);

        if (!response.ok) {
          throw new Error(
            response.status >= 500
              ? "Server Error: Please try again later."
              : "Client Error: The provided link might be incorrect."
          );
        }

        const parsedData = await response.json();
        const action = dispatch(addConversation());
        const newId = action.payload?.id;

        if (!newId) {
          throw new Error("Failed to create new conversation");
        }

        // Handle both formats: array and object with messages
        const messages = Array.isArray(parsedData)
          ? parsedData
          : parsedData.messages;

        if (!Array.isArray(messages)) {
          throw new Error("Invalid format: messages must be an array");
        }

        // Process messages into conversation format
        const newArray = [];
        for (let i = 0; i < messages.length - 1; i++) {
          if (
            messages[i].role === "user" &&
            messages[i + 1]?.role === "assistant"
          ) {
            newArray.push({
              prompt: messages[i].content,
              response: messages[i + 1].content,
            });
          }
        }

        // Find system message
        const systemMessage = messages.find((msg) => msg.role === "system");

        // Get title from first non-system message or use default
        const firstNonSystemMessage = messages.find(
          (msg) => msg.role !== "system"
        );
        const title = firstNonSystemMessage?.content || "Imported Conversation";

        // Prepare settings with optional fields
        const settings = {
          systemPrompt: systemMessage?.content || "You are a helpful assistant",
          model: "Meta Llama 3.1 8B Instruct", // default value
          model_api: "meta-llama-3.1-8b-instruct", // default value
          temperature: 0.5, // default value
          top_p: 0.5, // default value
        };

        // If it's object format, apply any provided settings
        if (!Array.isArray(parsedData)) {
          if (parsedData["model-name"])
            settings.model = parsedData["model-name"];
          if (parsedData.model) settings.model_api = parsedData.model;
          if (parsedData.temperature !== undefined)
            settings.temperature = Number(parsedData.temperature);
          if (parsedData.top_p !== undefined)
            settings.top_p = Number(parsedData.top_p);
        }

        // Prepare conversation update
        const updates = {
          conversation: messages,
          responses: newArray,
          title,
          settings,
        };

        // Only add arcana if both id and key are present
        if (
          !Array.isArray(parsedData) &&
          parsedData.arcana?.id &&
          parsedData.arcana?.key
        ) {
          updates.arcana = {
            id: parsedData.arcana.id,
            key: parsedData.arcana.key,
          };
        }

        // Update conversation
        dispatch(
          updateConversation({
            id: newId,
            updates,
          })
        );

        // Navigate and notify
        navigate(`/chat/${newId}`, { replace: true });
        notifySuccess("Chat imported successfully");
      } catch (error) {
        console.error("Import error:", error);
        notifyError(error.message || "An unexpected error occurred");
        navigate(`/chat/${currentConversationId}`, { replace: true });
        window.location.reload();
      }
    };

    if (conversations.length > 0) {
      handleImport();
    }
  }, [
    searchParams,
    location.pathname,
    conversations.length,
    currentConversationId,
    dispatch,
    navigate,
    notifyError,
    notifySuccess,
  ]);

  // Handle Arcana parameters from URL
  useEffect(() => {
    const handleArcanaParams = async (modelsList) => {
      const arcanaID = searchParams.get("arcana");
      const arcanaKey = searchParams.get("arcana_key");
      const modelParam = searchParams.get("model");

      if (
        arcanaID &&
        arcanaKey &&
        modelParam &&
        modelsList?.length > 0 &&
        location.pathname === "/chat" &&
        !hasProcessedArcana.current
      ) {
        try {
          hasProcessedArcana.current = true;

          const formattedModelParam = modelParam
            .toLowerCase()
            .replace(/\s+/g, "-");

          const matchedModel = modelsList.find(
            (m) => m.id === formattedModelParam && m.input.includes("arcana")
          );

          if (!matchedModel) {
            throw new Error("Model not found or does not support Arcana.");
          }

          // Update local state
          setLocalState((prev) => ({
            ...prev,
            arcana: {
              id: decodeURIComponent(arcanaID),
              key: decodeURIComponent(arcanaKey),
            },
            settings: {
              ...prev.settings,
              model: matchedModel.name,
              model_api: matchedModel.id,
              temperature: 0,
              top_p: 0.05,
            },
          }));

          // Find current conversation
          const currentConversation = conversations?.find(
            (conv) => conv.id === currentConversationId
          );

          // Update Redux store
          dispatch(
            updateConversation({
              id: currentConversationId,
              updates: {
                arcana: {
                  id: decodeURIComponent(arcanaID),
                  key: decodeURIComponent(arcanaKey),
                },
                settings: {
                  ...currentConversation?.settings,
                  model: matchedModel.name,
                  model_api: matchedModel.id,
                  temperature: 0,
                  top_p: 0.05,
                },
              },
            })
          );

          // Safe scrollTop access (if relevant)
          const chatContainer = document.getElementById("chat-container");
          if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }

          // Navigate to conversation
          navigate(`/chat/${currentConversationId}`, { replace: true });
        } catch (error) {
          hasProcessedArcana.current = false; // ✅ Reset flag if failed
          notifyError(
            "Invalid model or arcana parameters. Redirecting to default chat."
          );
          navigate(`/chat/${currentConversationId}`, { replace: true });
        }
      }
    };

    const fetchModelsAndProcess = async () => {
      if (hasFetchedModels.current) return;

      try {
        hasFetchedModels.current = true;
        const modelsList = await fetchAvailableModels(setShowModalSession);

        if (!modelsList || modelsList.length === 0) {
          throw new Error("Failed to fetch models.");
        }

        handleArcanaParams(modelsList);
      } catch (error) {
        notifyError("Failed to fetch models. Please try again.");
        hasFetchedModels.current = false;
      }
    };

    if (
      conversations.length > 0 &&
      !hasFetchedModels.current &&
      !hasProcessedArcana.current
    ) {
      fetchModelsAndProcess();
    }
  }, [
    searchParams,
    location.pathname,
    conversations,
    currentConversationId,
    dispatch,
    navigate,
    notifyError,
    setLocalState,
    setShowModalSession,
  ]);

  return (
    <div
      className={`relative transition-all duration-300 ease-in-out
    ${
      showAdvOpt
        ? "opacity-100 w-[40%] mobile:w-full flex p-2 transform translate-y-0"
        : "opacity-0 max-h-0 transform -translate-y-4 overflow-hidden"
    }`}
    >
      <div
        className={`relative w-full flex-col items-center mobile:p-0 text-tertiary flex gap-4 mobile:max-h-[40px]`}
      >
        {/* Settings Panel */}
        <div
          className={`${
            showAdvOpt
              ? "flex static mobile:absolute bottom-0 left-0"
              : "hidden"
          } mobile:w-full w-[calc(100%-12px)] border dark:border-border_dark rounded-2xl bg-white dark:bg-bg_secondary_dark`}
        >
          <div
            className={`transform transition-all duration-300 ${
              showAdvOpt
                ? "translate-y-0 opacity-100"
                : "translate-y-full opacity-0"
            } flex flex-col gap-4 p-3 sm:p-4 h-fit w-full`}
          >
            <div className="flex flex-col mobile:hidden gap-4">
              <div className="flex flex-wrap items-center gap-4 select-none">
                <div className="flex-shrink-0 flex items-center gap-2 min-w-fit">
                  <p className="flex-shrink-0 text-[18px] whitespace-nowrap">
                    <Trans i18nKey="description.choose" />
                  </p>
                  <img
                    src={help}
                    alt="help"
                    className="h-[20px] w-[20px] cursor-pointer"
                    onClick={() => setShowHelpModal(true)}
                  />
                </div>

                <div
                  className="relative flex-1 min-w-[200px]"
                  ref={dropdownRef}
                  tabIndex={0}
                  onBlur={() => setIsOpen(false)}
                >
                  <div
                    className="text-tertiary flex items-center mt-1 cursor-pointer text-[18px] w-full py-[10px] px-3 appearance-none focus:outline-none rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark"
                    onClick={toggleOpen}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <DemandStatusIcon
                        status={currentModel?.status}
                        demand={currentModel?.demand}
                      />
                      <div className="text-xl overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                        {modelSettings.model}
                      </div>
                      {isImageSupported && (
                        <img
                          src={image_supported}
                          alt="image_supported"
                          className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 mx-0.5"
                        />
                      )}
                      {isVideoSupported && (
                        <img
                          src={video_icon}
                          alt="video_icon"
                          className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 mx-0.5"
                        />
                      )}
                      {isThoughtSupported && (
                        <img
                          src={thought_supported}
                          alt="thought_supported"
                          className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 mx-0.5"
                        />
                      )}
                      {isArcanaSupported && (
                        <img
                          src={books}
                          alt="books"
                          className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 mx-0.5"
                        />
                      )}
                      <img
                        src={dropdown}
                        alt="drop-down"
                        className="h-[30px] w-[30px] cursor-pointer flex-shrink-0"
                      />
                    </div>
                  </div>

                  {isOpen && (
                    <div
                      className={`absolute w-full ${
                        direction === "up" ? "bottom-full" : "top-full"
                      } mt-1 rounded-2xl border-opacity-10 border dark:border-border_dark z-[99] max-h-[200px] overflow-y-auto bg-white dark:bg-black`}
                    >
                      {modelList.map((option, index) => (
                        <div
                          key={index}
                          className={`flex items-center gap-2 text-tertiary text-xl w-full px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                            index === 0
                              ? "rounded-t-2xl"
                              : index === modelList.length - 1
                              ? "rounded-b-2xl"
                              : ""
                          }`}
                          onClick={() => handleChangeModel(option)}
                        >
                          <DemandStatusIcon
                            status={option?.status}
                            demand={option?.demand}
                          />
                          <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                            {option.name}
                          </div>
                          {option.input.includes("image") && (
                            <img
                              src={image_supported}
                              alt="image_supported"
                              className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 ml-0.5"
                            />
                          )}
                          {option.input.includes("video") && (
                            <img
                              src={video_icon}
                              alt="video_icon"
                              className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 ml-0.5"
                            />
                          )}
                          {option.output.includes("thought") && (
                            <img
                              src={thought_supported}
                              alt="thought_supported"
                              className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 ml-0.5"
                            />
                          )}
                          {option.input.includes("arcana") && (
                            <img
                              src={books}
                              alt="books"
                              className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 ml-0.5"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {localState.settings.model.toLowerCase().includes("external") && (
              <div className="text-yellow-600 text-sm mb-3 select-none">
                <Trans i18nKey="description.warning_settings" />
              </div>
            )}

            {isArcanaSupported ? (
              <div className="flex gap-4 w-full items-center">
                <div className="flex-shrink-0 flex items-center gap-2 select-none">
                  <p className="text-[18px]">Arcana</p>
                  <img
                    src={help}
                    alt="help"
                    className="h-[20px] w-[20px] cursor-pointer"
                    onClick={() => setShowArcanasHelpModal(true)}
                  />
                </div>
                <ArcanaContainer
                  localState={localState}
                  setLocalState={setLocalState}
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-4 items-center">
              {localState.arcana.id &&
                localState.arcana.key &&
                isArcanaSupported && (
                  <div className="text-yellow-600 text-sm w-full select-none">
                    <Trans i18nKey="description.warning_arcana" />
                  </div>
                )}

              <div className="flex flex-col md:flex-row md:gap-4 gap-5 w-full md:items-center">
                <div className="flex-shrink-0 flex items-center gap-2 select-none min-w-[80px]">
                  <p className="text-[18px]">temp</p>
                  <img
                    src={help}
                    alt="help"
                    className="h-[20px] w-[20px] cursor-pointer"
                    onClick={() => setShowCustomHelpModal(true)}
                  />
                </div>
                <div className="w-full">
                  <div className="relative w-full">
                    <div className="select-none flex justify-between text-xs text-tertiary mb-2 absolute top-[-20px] w-full">
                      <span>Logical</span>
                      <span>Creative</span>
                    </div>
                    <div className="tick-marks-container cursor-pointer">
                      {[...Array(21)].map((_, i) => (
                        <div key={i} className="tick-mark"></div>
                      ))}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={localState.settings.temperature}
                      className="slider-input"
                      onChange={(event) => handleChangeTemp(event.target.value)}
                      onMouseEnter={() => setHovering(true)}
                      onMouseLeave={() => setHovering(false)}
                    />
                    {isHovering && (
                      <output
                        className="slider-tooltip"
                        style={{
                          left: `calc(${
                            (localState.settings.temperature / 2) * 100
                          }% - 15px)`,
                        }}
                      >
                        {Number(localState.settings.temperature).toFixed(1)}
                      </output>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:gap-4 gap-5 w-full md:items-center">
                <div className="flex-shrink-0 flex items-center gap-2 select-none min-w-[80px]">
                  <p className="text-[18px]">top_p</p>
                  <img
                    src={help}
                    alt="help"
                    className="h-[20px] w-[20px] cursor-pointer"
                    onClick={() => setShowTopPHelpModal(true)}
                  />
                </div>
                <div className="w-full">
                  <div className="relative w-full">
                    <div className="select-none flex justify-between text-xs text-tertiary mb-2 absolute top-[-20px] w-full">
                      <span>Focused</span>
                      <span>Diverse</span>
                    </div>
                    <div className="tick-marks-container cursor-pointer">
                      {[...Array(20)].map((_, i) => (
                        <div key={i} className="tick-mark"></div>
                      ))}
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={localState.settings.top_p}
                      className="slider-input"
                      onChange={(event) => handleChangeTopP(event.target.value)}
                      onMouseEnter={() => setHoveringTopP(true)}
                      onMouseLeave={() => setHoveringTopP(false)}
                    />
                    {isHoveringTopP && (
                      <output
                        className="slider-tooltip"
                        style={{
                          left: `calc(${
                            ((localState.settings.top_p - 0.05) / 0.95) * 100
                          }% - 15px)`,
                        }}
                      >
                        {Number(localState.settings.top_p).toFixed(2)}
                      </output>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full flex flex-col gap-4">
                <div className="flex-shrink-0 flex items-center gap-2 select-none">
                  <p className="text-[18px]">System prompt</p>
                  <img
                    src={help}
                    alt="help"
                    className="h-[20px] w-[20px] cursor-pointer"
                    onClick={() => setShowSystemHelpModal(true)}
                  />
                </div>
                <div className="w-full relative">
                  <div className="relative z-10">
                    <textarea
                      className={`dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border ${
                        systemPromptError
                          ? "border-red-500"
                          : "dark:border-border_dark"
                      } outline-none rounded-2xl shadow-lg dark:shadow-dark w-full min-h-[150px]`}
                      type="text"
                      name="systemPrompt"
                      placeholder={t("description.custom4")}
                      value={localState.settings.systemPrompt}
                      onChange={handleInstructionsChange}
                      onBlur={() => validateSystemPrompt()}
                    />
                  </div>
                  {systemPromptError && (
                    <p className="text-red-600 text-12-500">
                      {systemPromptError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap justify-left md:justify-end gap-2 md:gap-4 items-center w-full">
                <div
                  className="cursor-pointer select-none flex-1 gap-4 justify-center items-center p-4 bg-white dark:bg-bg_secondary_dark h-fit"
                  onClick={toggleAdvOpt}
                >
                  <p className="hidden desktop:block text-[18px] h-full text-tertiary cursor-pointer">
                    <Trans i18nKey="description.text9" />
                  </p>
                  <p className="block desktop:hidden text-[18px] h-full text-tertiary cursor-pointer">
                    <Trans i18nKey="description.text10" />
                  </p>
                </div>

                <button
                  className="text-white p-3 bg-green-600 hover:bg-green-550 active:bg-green-700 dark:border-border_dark rounded-lg justify-center items-center md:w-fit shadow-lg dark:shadow-dark border select-none flex gap-2"
                  type="reset"
                  onClick={() => handleShareSettingsModal()}
                >
                  <div className="hidden desktop:block">
                    <Trans i18nKey="description.custom9" />
                  </div>
                  <img
                    src={share_icon}
                    alt="share_icon"
                    className="hidden desktop:block h-[20px] w-[20px] cursor-pointer"
                  />
                  <img
                    src={share_icon}
                    alt="share_icon"
                    className="block desktop:hidden h-[30px] w-[30px] cursor-pointer"
                  />
                </button>

                <button
                  className="text-black p-3 bg-bg_reset_default active:bg-bg_reset_default_pressed dark:border-border_dark rounded-lg justify-center items-center md:w-fit shadow-lg dark:shadow-dark border select-none"
                  type="reset"
                  onClick={resetDefault}
                >
                  <div className="hidden desktop:block">
                    <Trans i18nKey="description.custom7" />
                  </div>
                  <div className="block desktop:hidden">
                    <Trans i18nKey="description.custom10" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Files mapping */}
        {selectedFiles.length > 0 ? (
          <div
            className={`${
              showAdvOpt ? "flex" : "mobile:flex hidden"
            } mobile:w-full w-[calc(100%-12px)] mt-[YourFirstChildHeight] border dark:border-border_dark rounded-2xl bg-white dark:bg-bg_secondary_dark`}
          >
            <div className="w-full">
              {selectedFiles.length > 0 && (
                <div className="flex flex-col gap-4 select-none p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-base sm:text-lg font-medium">
                      <Trans i18nKey="description.file1" />
                    </p>
                    <p
                      className="text-red-400 hover:text-red-300 cursor-pointer text-xs sm:text-sm font-medium"
                      onClick={() => setSelectedFiles([])}
                    >
                      <Trans i18nKey="description.file2" />
                    </p>
                  </div>

                  <ul className="flex flex-col gap-3 sm:gap-4 overflow-auto max-h-[400px] pb-2 sm:pb-4">
                    {Array.from(selectedFiles).map((file, index) => (
                      <li
                        key={`${file.name}-${index}`}
                        className="cursor-pointer flex gap-2 sm:gap-3 items-center bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-850 p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-colors duration-150"
                        onClick={() => setPreviewFile(file)}
                      >
                        {file.type === "image" ? (
                          <img
                            className="h-[36px] w-[36px] sm:h-[42px] sm:w-[42px] rounded-md object-cover flex-shrink-0"
                            src={file.text}
                            alt={file.name}
                          />
                        ) : file.type === "video" ? (
                          <img
                            className="h-[36px] w-[36px] sm:h-[42px] sm:w-[42px] flex-shrink-0"
                            src={video_icon}
                            alt="video"
                          />
                        ) : (
                          <img
                            className="h-[36px] w-[36px] sm:h-[42px] sm:w-[42px] flex-shrink-0"
                            src={uploaded}
                            alt="uploaded"
                          />
                        )}

                        <div className="flex justify-between items-start sm:items-center w-full min-w-0">
                          <div className="flex flex-col gap-1 min-w-0 pr-2 w-full">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-2">
                              <p className="overflow-hidden whitespace-nowrap text-ellipsis w-full max-w-[150px] sm:max-w-[200px] font-medium text-sm sm:text-base">
                                {file.name}
                              </p>
                              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                                {formatFileSize(file.size)}
                              </p>
                            </div>

                            {file.fileType === "pdf" && (
                              <div className="flex items-center mt-1">
                                {file.processed ? (
                                  <span className="text-green-500 text-xs sm:text-sm font-medium px-2 py-0.5 sm:py-1 bg-green-100 dark:bg-green-900 bg-opacity-30 rounded-2xl">
                                    Processed
                                  </span>
                                ) : processingFiles.has(index) ? (
                                  <div className="flex items-center gap-1 sm:gap-2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                                    <svg
                                      className="animate-spin h-3 w-3 sm:h-4 sm:w-4"
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                    >
                                      <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                      />
                                      <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                      />
                                    </svg>
                                    <span>Processing...</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePdfProcess(file, index);
                                    }}
                                    className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 text-xs sm:text-sm transition-colors"
                                  >
                                    Process
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Cross icon with improved tap area for mobile */}
                          <button
                            className="p-1.5 sm:p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full flex-shrink-0 focus:outline-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(index);
                            }}
                            aria-label="Remove file"
                          >
                            <img
                              src={cross}
                              alt="remove"
                              className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]"
                            />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SettingsPanel;
