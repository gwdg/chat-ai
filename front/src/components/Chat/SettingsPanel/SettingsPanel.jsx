/* eslint-disable no-unused-vars */
//Libraries
import { Trans, useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Joyride from "react-joyride";

//Components
import ArcanaContainer from "./ArcanaContainer";
import TemperatureSlider from "./TemperatureSlider";
import TopPSlider from "./TopPSlider";
import MemorySelector from "./MemorySelector";
import GWDGToggle from "./GWDGToggle";
import ModelSelector from "./ModelSelector";
import SystemPromptContainer from "./SystemPromptContainer";
import ShareSettingsButton from "./ShareSettingsButton";

//Redux
import {
  addConversation,
  selectConversations,
  updateConversation,
} from "../../../Redux/reducers/conversationsSlice";
import { processFile } from "../../../apis/processFile";
import { getModelsData } from "../../../apis/getModelsData";
import { selectDefaultModel } from "../../../Redux/reducers/defaultModelSlice";

// Hooks
import { importConversation } from "../../../hooks/importConversation";
import { getDefaultSettings } from "../../../utils/settingsUtils";

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const SettingsPanel = ({
  selectedFiles,
  setSelectedFiles,
  modelsData,
  onModelChange,
  showAdvOpt,
  toggleAdvOpt,
  localState,
  setLocalState,
  notifySuccess,
  notifyError,
  setShowModalSession,
  userData
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

  const [processingFiles, setProcessingFiles] = useState(new Set());
  const defaultModel = useSelector(selectDefaultModel);
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0); // Add this

  const currentModel = localState.settings["model"]
  // console.log("currentModel", currentModel)
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
    [dispatch, setLocalState]
  );

  // Reset settings to default values
  const resetDefault = () => {
    const defaultSettings = getDefaultSettings();

    // Update system prompt in conversation history
    let updatedMessages = localState.messages.map((item) => {
      if (item.role === "system") {
        return { ...item, content: "You are a helpful assistant" };
      } else {
        return item;
      }
    });

    // Reset temperature, top_p, and system prompt to defaults
    setLocalState((prevState) => ({
      ...prevState,
      messages: updatedMessages,
      settings: {
        ...prevState.settings,
        systemPrompt: "You are a helpful assistant",
        temperature: defaultSettings.temperature,
        top_p: defaultSettings.top_p,
        memory: 2,
      },
    }));
    // TODO look at this
    // if (systemPromptError) {
    //   setSystemPromptError("");
    // }
  }

  const dropdownRef = useRef(null);
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

  // processing function
  const handlePdfProcess = async (file, index) => {
    try {
      setProcessingFiles((prev) => new Set(prev).add(index));

      // Pass the original File object
      const result = await processFile(file.file);

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
            // ["model-name"]: matchedModel.name,
            model: matchedModel,
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

    // const fetchModelsAndProcess = async () => {
    //   if (hasFetchedModels.current) return;

    //   try {
    //     hasFetchedModels.current = true;
    //     const modelsData = await getModelsData();
    //     if (modelsData === 401) {
    //       openModal('errorSessionExpired');
    //     }
    //     if (!modelsData || modelsData.length === 0) {
    //       throw new Error("Failed to fetch models.");
    //     }
    //     handleArcanaParams(modelsData);
    //   } catch (error) {
    //     notifyError("Failed to fetch models. Please try again.");
    //     await sleep(10000);
    //     hasFetchedModels.current = false;
    //   }
    // };

    // if (
    //   conversations.length > 0 &&
    //   !hasFetchedModels.current &&
    //   !hasProcessedArcana.current
    // ) {
    //   fetchModelsAndProcess();
    // }
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
              ? "opacity-100 desktop:w-[40%] w-full flex transform translate-y-0"
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
                ? "flex desktop:static absolute bottom-0 left-0"
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
              {/* Model Selection Menu */}
              <ModelSelector
                modelsData={modelsData}
                localState={localState}
                setLocalState={setLocalState}
                onModelChange={onModelChange}
              />
              
              {/* Warning for external models */}
              {(typeof localState.settings.model === 'string'
                  ? localState.settings.model
                  : localState.settings.model?.name
                )?.toLowerCase()
                .includes("external") && (
                <div className="text-yellow-600 text-sm mb-3 select-none">
                  <Trans i18nKey={userData?.org == "MPG" ? "description.warning_settings_mpg" : "description.warning_settings"} />
                </div>
              )}

              {/* Use GWDG Tools – checkbox */}
              <GWDGToggle
                localState = {localState}
                setLocalState = {setLocalState}
              />

              {/* Arcana box */}
              <ArcanaContainer
                localState={localState}
                setLocalState={setLocalState}
              />
            
              {/* Arcana warning*/}
              {localState.arcana.id && (localState.settings.useGWDGTools || (currentModel?.input?.includes("arcana") || false)) && (
                <div className="text-yellow-600 text-xs w-full select-none">
                  <Trans i18nKey="description.warning_arcana" />
                </div>
              )}

              {/* temperature Slider */}
              <TemperatureSlider
                localState={localState}
                setLocalState={setLocalState}
              />

              {/* top_p Slider */}
              <TopPSlider
                localState={localState}
                setLocalState={setLocalState}
              />
                
              {/* Memory Selector */}
              <MemorySelector
                localState={localState}
                setLocalState={setLocalState}
              />
              
              {/* System Prompt */}
              <SystemPromptContainer
                localState={localState}
                setLocalState={setLocalState}
              />

              <div className="flex flex-wrap justify-left md:justify-end gap-2 md:gap-4 items-center w-full">
                {/* Hide Options Button */}
                <div
                  className="cursor-pointer select-none flex-1 gap-4 justify-center items-center p-4 bg-white dark:bg-bg_secondary_dark h-fit"
                  onClick={toggleAdvOpt}
                >
                  <p className="hidden desktop:block text-sm h-full text-tertiary cursor-pointer">
                    <Trans i18nKey="description.text9" />
                  </p>
                  <p className="block desktop:hidden text-sm h-full text-tertiary cursor-pointer">
                    <Trans i18nKey="description.text10" />
                  </p>
                </div>

                {/* Share Settings Button */}
                <ShareSettingsButton
                  localState={localState}
                  setLocalState={setLocalState}
                />

                {/* Reset Default Button */}
                <button
                  className="text-black p-3 bg-bg_reset_default active:bg-bg_reset_default_pressed dark:border-border_dark rounded-lg justify-center items-center md:w-fit shadow-lg dark:shadow-dark border select-none"
                  type="reset"
                  onClick={resetDefault}
                >
                  <div className="hidden desktop:block text-sm">
                    <Trans i18nKey="description.custom7" />
                  </div>
                  <div className="block desktop:hidden text-sm">
                    <Trans i18nKey="description.custom10" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
