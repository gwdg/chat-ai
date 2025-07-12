/* eslint-disable no-unused-vars */
//Libraries
import { Trans, useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Joyride from "react-joyride";

//Components
import ArcanaContainer from "../Arcanas/ArcanaContainer";

//Assets
import help from "../../assets/icon_help.svg";
import image_supported from "../../assets/image_supported.svg";
import video_icon from "../../assets/video_icon.svg";
import thought_supported from "../../assets/thought_supported.svg";
import books from "../../assets/books.svg";
import dropdown from "../../assets/icon_dropdown.svg";
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
import { selectDefaultModel } from "../../Redux/reducers/defaultModelSlice";

// Hooks
import { importConversation } from "../../hooks/importConversation";
import { getDefaultSettings } from "../../utils/settingsUtils";

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

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
  setShowMemoryHelpModal,
  setShowSystemHelpModal,
  notifySuccess,
  notifyError,
  setShowModalSession,
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
  const currentVersion = useSelector((state) => state.version);

  //Local useStates
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState("down");
  const [isHovering, setHovering] = useState(false);
  const [isHoveringTopP, setHoveringTopP] = useState(false);
  const [systemPromptError, setSystemPromptError] = useState("");
  const [processingFiles, setProcessingFiles] = useState(new Set());
  const defaultModel = useSelector(selectDefaultModel);
  const [searchQuery, setSearchQuery] = useState("");
  const [runTour, setRunTour] = useState(false);
  const [originalZoom, setOriginalZoom] = useState("");
  const [tourStepIndex, setTourStepIndex] = useState(0); // Add this

  const tourSteps = [
    {
      target: ".memory-option-off",
      content: t("description.tour.memory.off"),
      placement: "top",
      disableBeacon: true,
    },
    {
      target: ".memory-option-recall",
      content: t("description.tour.memory.recall"),
      placement: "top",
      disableBeacon: true,
    },
    {
      target: ".memory-option-on",
      content: t("description.tour.memory.on"),
      placement: "top",
      disableBeacon: true,
    },
    {
      target: ".user-profile-button",
      content: t("description.tour.memory.settings"),
      placement: "top",
      disableBeacon: true,
    },
  ];

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

  // 3. SIMPLIFIED startTour FUNCTION (no loading states)
  const startTour = useCallback(() => {
    if (!showAdvOpt) {
      // If settings panel isn't open, don't start tour yet
      return;
    }

    // Store current zoom and transition to 100%
    const currentZoom = document.body.style.zoom || "90%";
    setOriginalZoom(currentZoom);
    document.body.style.zoom = "100%";

    // Start tour after zoom transition
    setTimeout(() => {
      setRunTour(true);
    }, 450);
  }, [showAdvOpt]);

  // 4. UPDATED handleJoyrideCallback WITH VERSION UPDATE
  const handleJoyrideCallback = useCallback(
    (data) => {
      const { action, index, status, type } = data;


      if (status === "finished" || status === "skipped") {
        setRunTour(false);
        setTourStepIndex(0); // Reset step index

        // Update version to 3 after tour completion
        dispatch({ type: "SET_VERSION", payload: 3 });

        // Restore original zoom
        document.body.style.zoom = originalZoom;
      } else if (type === "step:after") {
        // Update step index and memory setting when navigating
        const newIndex = index + (action === "prev" ? -1 : 1);
        setTourStepIndex(newIndex);

        // Change memory setting based on current step
        const memoryValues = [0, 1, 2, 2]; // Off, Recall, On
        const memoryValue = memoryValues[newIndex];

        if (memoryValue !== undefined) {
          setLocalState((prev) => ({
            ...prev,
            settings: {
              ...prev.settings,
              memory: memoryValue,
            },
          }));
        }
      } else if (type === "step:before") {
        // Set memory when step starts (including first step)
        const memoryValues = [0, 1, 2, 2]; // None, Recall, Learn
        const memoryValue = memoryValues[index];

        if (memoryValue !== undefined) {
          setLocalState((prev) => ({
            ...prev,
            settings: {
              ...prev.settings,
              memory: memoryValue,
            },
          }));
        }
      }
    },
    [originalZoom, dispatch, setLocalState]
  );

  // Filter function to search through models
  const filteredModelList = useMemo(() => {
    if (!searchQuery.trim()) {
      return modelList;
    }

    const query = searchQuery.toLowerCase();

    return modelList.filter((model) => {
      // Search by model name
      const nameMatch = model.name.toLowerCase().includes(query);

      // Search by input types (text, image, video, arcana)
      const inputMatch = model.input.some((inputType) =>
        inputType.toLowerCase().includes(query)
      );

      // Search by output types (text, thought)
      const outputMatch = model.output.some((outputType) =>
        outputType.toLowerCase().includes(query)
      );

      // Search by status
      const statusMatch = model.status.toLowerCase().includes(query);

      // Search by owner
      const ownerMatch = model.owned_by.toLowerCase().includes(query);

      return (
        nameMatch || inputMatch || outputMatch || statusMatch || ownerMatch
      );
    });
  }, [modelList, searchQuery]);

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
    const defaultSettings = getDefaultSettings();

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
        temperature: defaultSettings.temperature,
        top_p: defaultSettings.top_p,
        memory: 2,
      },
    }));
    updateSettings({ systemPrompt: "You are a helpful assistant" });
    if (systemPromptError) {
      setSystemPromptError("");
    }
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

  // Helper function to process URL settings
  const processUrlSettings = (urlSettings) => {
    const defaultSettings = getDefaultSettings();

    return {
      ...defaultSettings,
      ...urlSettings,
      // Handle systemPrompt decoding specifically
      systemPrompt: urlSettings.systemPrompt
        ? decodeURIComponent(urlSettings.systemPrompt)
        : defaultSettings.systemPrompt,
    };
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
          const urlSettings = JSON.parse(decodedSettings);

          // Process settings with defaults
          const processedSettings = processUrlSettings(urlSettings);

          // Create new conversation
          const action = dispatch(addConversation());
          const newId = action.payload?.id;

          if (newId) {
            // Prepare update object
            const conversationUpdates = {
              settings: processedSettings,
              ...(urlSettings.arcana && {
                arcana: {
                  id: urlSettings.arcana.id,
                  // key: urlSettings.arcana.key,
                },
              }),
            };

            // Update local state
            setLocalState((prev) => ({
              ...prev,
              ...conversationUpdates,
            }));

            // Update conversation in Redux store
            dispatch(
              updateConversation({
                id: newId,
                updates: conversationUpdates,
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
    const handleImportUrl = async () => {
      const importUrl = searchParams.get("import");
      if (
        !importUrl ||
        location.pathname !== "/chat" ||
        hasProcessedImport.current
      ) {
        return;
      }

      hasProcessedImport.current = true;

      // Download JSON file
      const response = await fetch(importUrl, dispatch);

      if (!response.ok) {
        throw new Error(
          response.status >= 500
            ? "Server Error: Please try again later."
            : "Client Error: The provided link might be incorrect."
        );
      }
      const parsedData = await response.json();
      return importConversation(
        parsedData,
        dispatch,
        currentConversationId,
        defaultModel,
        notifyError,
        notifySuccess,
        navigate
      );
    };

    if (conversations.length > 0) {
      handleImportUrl();
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
      // const arcanaKey = searchParams.get("arcana_key");
      const modelParam = searchParams.get("model");

      // Check if we have an arcana ID and model param (key is now optional)
      if (
        arcanaID &&
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

          // Create arcana object with optional key
          const arcanaObject = {
            id: decodeURIComponent(arcanaID),
            // Only include key if it exists, otherwise use null or empty string
            // depending on what your backend expects for missing key
            // key: arcanaKey ? decodeURIComponent(arcanaKey) : null,
          };

          // Create custom settings for the new conversation
          const customSettings = {
            ["model-name"]: matchedModel.name,
            model: matchedModel.id,
            temperature: 0,
            top_p: 0.05,
          };

          // Create a new conversation with arcana settings
          const newConversationAction = dispatch(
            addConversation(null, customSettings)
          );

          const newConversationId = newConversationAction.meta.id;

          // Update the newly created conversation with arcana data
          dispatch(
            updateConversation({
              id: newConversationId,
              updates: {
                arcana: arcanaObject,
              },
            })
          );

          // Update local state to match the new conversation
          setLocalState((prev) => ({
            ...prev,
            arcana: arcanaObject,
            settings: {
              ...prev.settings,
              ...customSettings,
            },
          }));

          // Safe scrollTop access (if relevant)
          const chatContainer = document.getElementById("chat-container");
          if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }

          // Navigate to the new conversation
          navigate(`/chat/${newConversationId}`, { replace: true });
        } catch (error) {
          hasProcessedArcana.current = false; // Reset flag if failed
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
        await sleep(10000);
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

  useEffect(() => {
    // Auto-start tour if version is 2 and settings panel is open
    if (currentVersion === 2 && showAdvOpt && !runTour) {
      // Small delay to ensure panel is fully rendered
      setTimeout(() => {
        startTour();
      }, 800); // Give time for panel animation to complete
    }
  }, [currentVersion, showAdvOpt, runTour, startTour]);

  return (
    <>
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        disableOverlay={false}
        disableOverlayClose={true}
        disableScrolling={true}
        callback={handleJoyrideCallback}
        locale={{
          back: t("description.tour.back"),
          close: t("description.tour.close"),
          last: t("description.tour.last"),
          next: t("description.tour.next"),
          skip: t("description.tour.skip"),
        }}
        styles={{
          options: {
            primaryColor: "#009EE0",
            zIndex: 20000,
          },
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.75)", // Dark overlay to hide zoom
            mixBlendMode: "normal",
          },
          spotlight: {
            borderRadius: 8,
            border: "2px solid #009EE0",
            backgroundColor: "transparent",
          },
          tooltip: {
            borderRadius: 12,
            fontSize: 16,
            fontFamily: "inherit",
            padding: 20,
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
            backgroundColor: "var(--tooltip-bg, #ffffff)",
            color: "var(--tooltip-text, #333333)",
          },
          tooltipContent: {
            padding: 0,
          },
          buttonNext: {
            backgroundColor: "#009EE0",
            fontSize: 14,
            fontWeight: 600,
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
          },
          buttonBack: {
            color: "#6b7280",
            fontSize: 14,
            padding: "10px 16px",
            marginRight: 12,
            border: "1px solid #d1d5db",
            borderRadius: 8,
            backgroundColor: "transparent",
          },
          buttonSkip: {
            color: "#6b7280",
            fontSize: 14,
            padding: "10px 16px",
            backgroundColor: "transparent",
            border: "none",
          },
        }}
      />

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
                    onBlur={(e) => {
                      // Only close if the new focus target is not within this dropdown
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        setIsOpen(false);
                      }
                    }}
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
                          {modelSettings["model-name"]}
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
                        } mt-1 rounded-2xl border-opacity-10 border dark:border-border_dark z-[99] max-h-[280px] bg-white dark:bg-black shadow-lg`}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {/* Search Input */}
                        <div className="p-3 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-black rounded-t-2xl">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder={t(
                                "description.placeholder_modelList"
                              )}
                              value={searchQuery}
                              autoFocus={true}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-tertiary focus:border-transparent"
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>

                        {/* Model List Container */}
                        <div className="max-h-[200px] overflow-y-auto overflow-x-hidden">
                          {filteredModelList.length > 0 ? (
                            <div className="py-1">
                              {filteredModelList.map((option, index) => (
                                <div
                                  key={option.id}
                                  className={`group flex items-center gap-2 w-full px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                    index === filteredModelList.length - 1
                                      ? "rounded-b-2xl"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    handleChangeModel(option);
                                    setSearchQuery("");
                                  }}
                                >
                                  {/* Status Icon */}
                                  <div className="flex-shrink-0">
                                    <DemandStatusIcon
                                      status={option?.status}
                                      demand={option?.demand}
                                    />
                                  </div>

                                  {/* Model Name - with proper text handling */}
                                  <div className="flex-1 min-w-0 mr-2">
                                    <div className="text-xl text-tertiary truncate">
                                      {option.name}
                                    </div>
                                  </div>

                                  {/* Capability Icons */}
                                  <div className="flex items-center gap-0.5 flex-shrink-0">
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
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                              No models found matching &quot;{searchQuery}&quot;
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {localState.settings["model-name"]
                .toLowerCase()
                .includes("external") && (
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
                {localState.arcana.id && isArcanaSupported && (
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
                        onChange={(event) =>
                          handleChangeTemp(event.target.value)
                        }
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
                        onChange={(event) =>
                          handleChangeTopP(event.target.value)
                        }
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
                {/* Memory */}
                <div className="w-full flex gap-4">
                  <div className="flex-shrink-0 flex items-center gap-2 select-none">
                    <p className="text-[18px]">Memory</p>
                    <img
                      src={help}
                      alt="help"
                      className="h-[20px] w-[20px] cursor-pointer"
                      onClick={() => setShowMemoryHelpModal(true)}
                    />
                  </div>

                  <div className="w-full">
                    <div className="flex bg-white dark:bg-bg_secondary_dark border dark:border-border_dark rounded-xl shadow-lg dark:shadow-dark overflow-hidden">
                      {/* None Option */}
                      <div
                        className={`memory-option-off flex-1 p-2 text-center cursor-pointer transition-all duration-200 select-none ${
                          localState.settings.memory === 0
                            ? "bg-tertiary text-white"
                            : "text-tertiary hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        onClick={() =>
                          setLocalState((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              memory: 0,
                            },
                          }))
                        }
                      >
                        <p className="text-[16px] font-medium">None</p>
                      </div>

                      {/* Recall Option */}
                      <div
                        className={`memory-option-recall flex-1 p-2 text-center cursor-pointer transition-all duration-200 select-none border-l border-r dark:border-border_dark ${
                          localState.settings.memory === 1
                            ? "bg-tertiary text-white"
                            : "text-tertiary hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        onClick={() =>
                          setLocalState((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              memory: 1,
                            },
                          }))
                        }
                      >
                        <p className="text-[16px] font-medium">Recall</p>
                      </div>

                      {/* Learn Option */}
                      <div
                        className={`memory-option-on flex-1 p-2 text-center cursor-pointer transition-all duration-200 select-none ${
                          localState.settings.memory === 2
                            ? "bg-tertiary text-white"
                            : "text-tertiary hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        onClick={() =>
                          setLocalState((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              memory: 2,
                            },
                          }))
                        }
                      >
                        <p className="text-[16px] font-medium">Learn</p>
                      </div>
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
                        className={`dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark w-full min-h-[150px]`}
                        type="text"
                        name="systemPrompt"
                        placeholder={t("description.custom4")}
                        value={localState.settings.systemPrompt}
                        onChange={handleInstructionsChange}
                        onBlur={() => validateSystemPrompt()}
                      />
                    </div>
                    {(systemPromptError ||
                      !localState.settings.systemPrompt) && (
                      <p className="text-yellow-600 text-12-500">
                        <Trans i18nKey="description.custom6" />
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
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
