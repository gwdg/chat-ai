/* eslint-disable no-unused-vars */
//Libraries
import { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Joyride from "react-joyride-react-19";
import { useDispatch, useSelector } from "react-redux";
import { useWindowSize } from "../../hooks/useWindowSize";
import { useModal } from "../../modals/ModalContext";

//Components
import ArcanaContainer from "./ArcanaContainer";
import MemorySelector from "./MemorySelector";
import ShareSettingsButton from "./ShareSettingsButton";
import SystemPromptContainer from "./SystemPromptContainer";
import TemperatureSlider from "./TemperatureSlider";
import TopPSlider from "./TopPSlider";

//Redux
import {
  selectDefaultModel,
  selectUserSettings,
} from "../../Redux/reducers/userSettingsReducer";

// Hooks
import { ChevronRight } from "lucide-react";
import { useToast } from "../../hooks/useToast";
import {
  closeTour,
  selectShowTour,
  toggleSettings,
  toggleSidebar,
} from "../../Redux/reducers/interfaceSettingsSlice";
import PartnerContainer from "../Header/PartnerContainer";
import UserContainer from "../Header/UserContainer";
import {DataSafetyText} from "../Header/WarningExternalModel";

import { useConversationList } from "../../db";
import { getDefaultSettings } from "../../utils/conversationUtils";
import MCPContainer from "./MCPContainer";
import ToolsContainer from "./ToolsContainer";
import VideoQueuePreview from "./VideoQueuePreview";

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const SettingsPanel = ({ localState, setLocalState, userData, modelsData, videoQueue, videoToolEnabled }) => {
  const conversations = useConversationList();

  //Hooks
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const userSettings = useSelector(selectUserSettings);
  const settings = localState.settings;
  const tools = settings?.tools || {};
  const showArcanaBox = !!settings?.enable_tools && !!tools.arcana;
  const showMCPBox = !!settings?.enable_tools && !!tools.mcp;
  const showVideoQueue = !!videoToolEnabled;

  const migrationData = useSelector((state) => state.migration_data) || {};
  const { notifySuccess, notifyError } = useToast();
  const { openModal } = useModal();

  const welcomeTimerRef = useRef(null);
  //Local useStates
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState("down");
  const [tourReady, setTourReady] = useState(false);
  const defaultModel = useSelector(selectDefaultModel);
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0); // Add this
  const { isMobile, isTablet, isDesktop } = useWindowSize();

  const showTourSelected = useSelector(selectShowTour);
  const showTour = !isMobile && showTourSelected;

  const tourSteps = [
    // {
    //   target: ".memory-option-off",
    //   content: t("tour.memory.off"),
    //   placement: "top",
    //   disableBeacon: true,
    // },
    // {
    //   target: ".memory-option-recall",
    //   content: t("tour.memory.recall"),
    //   placement: "top",
    //   disableBeacon: true,
    // },
    // {
    //   target: ".memory-option-on",
    //   content: t("tour.memory.on"),
    //   placement: "top",
    //   disableBeacon: true,
    // },
    {
      target: ".prompt-area",
      content: t("tour.prompt"),
      placement: "bottom",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none" },
      },
    },
    {
      target: ".model-selector",
      content: t("tour.model"),
      placement: "bottom",
      disableBeacon: false,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none" },
      },
    },
    {
      target: ".sidebar-wrapper",
      content: t("tour.sidebar"),
      placement: "right",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none" },
      },
    },
    {
      target: ".settings-toggle",
      content: t("tour.settings"),
      placement: "left",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none" },
      },
    },
    {
      target: ".user-profile-button",
      content: t("tour.profile"),
      placement: "left",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none" },
      },
    },
    {
      target: ".interface-toggles",
      content: t("tour.interface"),
      placement: "top",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none" },
      },
    },
  ];

  // Handle tour actions
  const handleJoyrideCallback = useCallback(
    (data) => {
      const { action, index, status, type } = data;
      if (status === "finished" || status === "skipped") {
        dispatch(closeTour());
        setRunTour(false);
        setTourStepIndex(0); // Reset step index

        // Update version to 3 after tour completion
        // dispatch({ type: "SET_VERSION", payload: 3 });
      } else if (type === "step:after") {
        // Update step index and memory setting when navigating
        const newIndex = index + (action === "prev" ? -1 : 1);
        if (newIndex === 0) {
          dispatch(toggleSidebar(false));
          dispatch(toggleSettings(false));
        } else if (newIndex === 1) {
          dispatch(toggleSidebar(false));
          dispatch(toggleSettings(false));
        } else if (newIndex === 2) {
          dispatch(toggleSidebar(true));
          dispatch(toggleSettings(false));
        } else if (newIndex === 3) {
          dispatch(toggleSidebar(false));
          dispatch(toggleSettings(true));
        } else if (newIndex === 4) {
          dispatch(toggleSidebar(false));
          dispatch(toggleSettings(false));
        } else if (newIndex === 5) {
          dispatch(toggleSidebar(false));
          dispatch(toggleSettings(false));
        }
        setTimeout(() => {
          setTourStepIndex(newIndex);
        }, 500);
      } else if (type === "step:before") {
      }
    },
    [dispatch, setLocalState]
  );

  // Reset settings to default values
  const resetDefault = () => {
    const defaultSettings = getDefaultSettings(userSettings);

    // Update system prompt in conversation history
    let updatedMessages = localState.messages.map((item) => {
      if (item.role === "system") {
        return {
          ...item,
          content: [
            {
              type: "text",
              text:
                defaultSettings?.system_prompt || "You are a helpful assistant",
            },
          ],
        };
      } else {
        return item;
      }
    });

    // Reset temperature, top_p, and system prompt to defaults
    setLocalState((prev) => ({
      ...prev,
      messages: updatedMessages,
      settings: {
        ...prev.settings,
        ...defaultSettings,
      },
    }));
  };

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

  useEffect(() => {
    const id = requestAnimationFrame(() => setTourReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!tourReady) return;
    if (!showTour) {
      // if we go back to mobile, cancel pending timer and stop tour
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
      setRunTour(false);
      return;
    }
    if (Object.keys(migrationData).length > 0) return;
    if (runTour) return; // already running

    const onRunTour = () => setRunTour(true);
    welcomeTimerRef.current = setTimeout(() => {
      openModal("welcome", { onRunTour });
    }, 200);

    return () => {
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
    };
  }, [showTour, migrationData, openModal, runTour, tourReady]);

  const targetsReady =
    typeof window !== "undefined" &&
    Array.isArray(tourSteps) &&
    tourSteps.every((s) => s?.target && document.querySelector(s.target));

  return (
    <>
      {showTour && tourReady && targetsReady && (
        <Joyride
          steps={tourSteps}
          run={runTour}
          continuous
          showProgress
          showSkipButton
          disableOverlay={false}
          disableOverlayClose
          disableScrolling
          callback={handleJoyrideCallback}
          locale={{
            back: t("tour.back"),
            close: t("tour.close"),
            last: t("tour.last"),
            next: t("tour.next"),
            skip: t("tour.skip"),
          }}
          styles={{
            options: { primaryColor: "#009EE0", zIndex: 20000 },
            overlay: {
              backgroundColor: "rgba(0,0,0,0.75)",
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
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
              backgroundColor: "var(--tooltip-bg, #ffffff)",
              color: "var(--tooltip-text, #333333)",
            },
            tooltipContent: { padding: 0 },
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
      )}
      <div className="settings-toggle flex relative w-full h-full flex-col items-center text-tertiary min-w-0 max-h-[100vh] xl:max-h-[96vh]">
        {/* Logos and User Profile */}
        <div className="w-full hidden md:flex items-center gap-3 justify-between p-3">
          <button
            onClick={() => dispatch(toggleSettings())}
            className="cursor-pointer p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Close Settings"
          >
            <ChevronRight className="w-7 h-7 text-tertiary" />
          </button>
          {/* Partner logos */}
          <div className="gap-2 px-5 hidden md:flex">
            <PartnerContainer />
          </div>
          <div className="flex items-center gap-2">
            {/* User profile */}
            <span className="border-l border-gray-200 dark:border-gray-700 pl-3">
              <UserContainer
                localState={localState}
                userData={userData}
                modelsData={modelsData}
              />
            </span>

            {/* <ThemeToggle /> */}
          </div>
        </div>
        {/* User profile Mobile */}
        <div className="md:hidden flex flex-row justify-between items-center w-full p-3">
            <div className="flex flex-grow py-1 text-lg text-primary">
                <b>Settings</b>
            </div>
            <span className="px-1">
                <UserContainer
                localState={localState}
                userData={userData}
                modelsData={modelsData}
                />
            </span>
        </div>
        {/* Settings Panel */}
        <div className="flex flex-col gap-3 pt-1 p-2 lg:pt-1 lg:p-4 h-full w-full overflow-y-auto">
          
          {/* Warning for external models */}
          <DataSafetyText localState={localState} userData={userData} />
          {/* Use Tools – checkbox */}
          {/* <ToolsToggle localState={localState} setLocalState={setLocalState} />
          <WebSearchToggle
            localState={localState}
            setLocalState={setLocalState}
          /> */}
          <ToolsContainer
            localState={localState}
            setLocalState={setLocalState}
          />
          {showVideoQueue && (
            <VideoQueuePreview
              jobs={videoQueue?.jobs || []}
              onDownload={() => {}}
            />
          )}
          {/* Arcana box (only when enabled AND has an ID) */}
          {showArcanaBox && (
            <ArcanaContainer
              localState={localState}
              setLocalState={setLocalState}
            />
          )}
          {/* MCP box (only when enabled AND has a value) */}
          {showMCPBox && (
            <MCPContainer
              localState={localState}
              setLocalState={setLocalState}
            />
          )}
          {/* temperature Slider */}
          <TemperatureSlider
            localState={localState}
            setLocalState={setLocalState}
          />
          {/* top_p Slider */}
          <TopPSlider localState={localState} setLocalState={setLocalState} />
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
          <div className="flex flex-wrap md:justify-end gap-2 md:gap-4 items-center w-full">
            {/* Share Settings Button */}
            <ShareSettingsButton
              localState={localState}
              setLocalState={setLocalState}
            />

            {/* Reset Default Button */}
            <button
              className="text-black p-3 bg-bg_reset_default active:bg-bg_reset_default_pressed dark:border-border_dark rounded-lg justify-center items-center md:w-fit shadow-lg dark:shadow-dark border select-none cursor-pointer"
              type="reset"
              onClick={resetDefault}
            >
              <div className="hidden desktop:block text-sm">
                <Trans i18nKey="settings.reset_default" />
              </div>
              <div className="block desktop:hidden text-sm">
                <Trans i18nKey="settings.default" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
