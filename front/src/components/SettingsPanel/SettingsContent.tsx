/* eslint-disable no-unused-vars */
//Libraries
import { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Joyride from "react-joyride-react-19";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useModal } from "../../modals/ModalContext";
import { useWindowSize } from "../../hooks/useWindowSize";

//Components
import ArcanaContainer from "./ArcanaContainer";
import MemorySelector from "./MemorySelector";
import ShareSettingsButton from "./ShareSettingsButton";
import SystemPromptContainer from "./SystemPromptContainer";
import TemperatureSlider from "./TemperatureSlider";
import ToolsToggle from "./ToolsToggle";
import TopPSlider from "./TopPSlider";

//Redux
import { selectDefaultModel, selectUserSettings } from "../../Redux/reducers/userSettingsReducer";

// Hooks
import { useToast } from "../../hooks/useToast";
import {
  closeTour,
  selectShowSettings,
  selectShowTour,
  toggleSettings,
  toggleSidebar
} from "../../Redux/reducers/interfaceSettingsSlice";
import WebSearchToggle from "./WebSearchToggle";
import PartnerContainer from "../Header/PartnerContainer";
import UserContainer from "../Header/UserContainer";
import { ChevronRight } from "lucide-react";

import { getDefaultSettings } from "../../utils/conversationUtils";
import { useConversationList } from "../../db";
import MCPContainer from "./MCPContainer";

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const SettingsPanel = ({
  localState,
  setLocalState,
  userData,
  modelsData
}) => {
  const conversations = useConversationList();

  //Hooks
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const userSettings = useSelector(selectUserSettings);
  const settings = localState.settings;
  const migrationData = useSelector(state => state.migration_data);
  const { notifySuccess, notifyError } = useToast();
  const { openModal } = useModal();

  //Local useStates
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState("down");

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
        spotlight: { border: "none"},
      },
    },
    {
      target: ".model-selector",
      content: t("tour.model"),
      placement: "bottom",
      disableBeacon: false,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none"},
      },
    },
    {
      target: ".sidebar-wrapper",
      content: t("tour.sidebar"),
      placement: "right",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none"},
      },
    },
    {
      target: ".settings-toggle",
      content: t("tour.settings"),
      placement: "left",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none"},
      },
    },
    {
      target: ".user-profile-button",
      content: t("tour.profile"),
      placement: "left",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none"},
      },
    },
    {
      target: ".interface-toggles",
      content: t("tour.interface"),
      placement: "top",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none"},
      },
    },
  ];

  // Functions

  // Begin the tour (shouldn't this be useEffect?)
  useEffect(() => {
    if (!showTour) return;
    if (migrationData && Object.entries(migrationData).length > 0) return; // Skip if migration data exists
    // Start tour after short delay
    const onRunTour = () => {
      setRunTour(true);
    };
    setTimeout(() => {
      openModal("welcome", { onRunTour });
    }, 200);
  }, [showTour, migrationData]);

  // Handle tour actions
  const handleJoyrideCallback = useCallback(
    (data) => {
      const { action, index, status, type } = data;
      if (status === "finished" || status === "skipped") {
        dispatch(closeTour());
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
          ...item, content: [
            {
              type: "text",
              text: defaultSettings?.system_prompt || "You are a helpful assistant"
            }
          ]
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
          back: t("tour.back"),
          close: t("tour.close"),
          last: t("tour.last"),
          next: t("tour.next"),
          skip: t("tour.skip"),
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
    <div className="settings-toggle flex relative w-full h-full flex-col items-center text-tertiary ">
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
          <div className="flex gap-2 px-5 hidden md:flex">
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
        {/* Settings Panel */}
        <div className="flex flex-col gap-3 p-2 lg:p-4 h-full w-full">
          {/* User profile */}
          <div className="flex flex-row">
          {/* Warning for external models */}
          {localState.settings?.model?.name
            ?.toLowerCase()
            .includes("external") ? (
              <div className="text-yellow-600 text-sm mb-3 select-none">
                <Trans
                  i18nKey={
                    userData?.org == "MPG"
                      ? "alert.external_model_mpg"
                      : "alert.external_model"
                  }
                />
              </div>
            ) : (<div className="flex flex-grow md:hidden h-full py-1 text-lg text-primary"><b>Settings</b></div>)}
          <span className="md:hidden px-1">
            <UserContainer
              localState={localState}
              userData={userData}
              modelsData={modelsData}
            />
          </span>
          </div>
          {/* Use Tools – checkbox */}
          <ToolsToggle
            localState={localState}
            setLocalState={setLocalState}
          />
          <WebSearchToggle
            localState={localState}
            setLocalState={setLocalState}
          />
          {/* Arcana box */}
          <ArcanaContainer
            localState={localState}
            setLocalState={setLocalState}
          />
          {/* MCP box */}
          <MCPContainer
            localState={localState}
            setLocalState={setLocalState}
          />
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
