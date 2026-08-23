/* eslint-disable no-unused-vars */
//Libraries
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

//Components
import ArcanaContainer from "./ArcanaContainer";
import ShareSettingsButton from "./ShareSettingsButton";
import SystemPromptContainer from "./SystemPromptContainer";
import TemperatureSlider from "./TemperatureSlider";
import TopPSlider from "./TopPSlider";

//Redux
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";

// Hooks
import { useToast } from "../../hooks/useToast";
import {DataSafetyText} from "../Header/WarningExternalModel";

import { useConversationList } from "../../db";
import { getDefaultSettings } from "../../utils/conversationUtils";
import MCPContainer from "./MCPContainer";
import VideoList from "./VideoList";

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const SettingsPanel = ({ localState, setLocalState, userData, modelsData }) => {
  const conversations = useConversationList();

  //Hooks
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const userSettings = useSelector(selectUserSettings);
  const settings = localState.settings;
  const tools = settings?.tools || {};
  const showArcanaBox = !!settings?.enable_tools && !!tools.arcana;
  const showMCPBox = !!settings?.enable_tools && !!tools.mcp;
  const showVideoList = !!tools.video_generation;

  const { notifySuccess, notifyError } = useToast();

  //Local useStates
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState("down");

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

  return (
    <>
      <div className="flex relative w-full h-full flex-col items-center text-tertiary min-w-0 min-h-0 max-h-full">
        {/* Settings Panel */}
        <div className="flex flex-col gap-3 p-3 lg:p-4 h-full w-full min-h-0 overflow-y-auto">

          {/* Warning for external models */}
          <DataSafetyText localState={localState} userData={userData} />
          {showVideoList && (
            <VideoList
              jobs={[]}
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
          {/* System Prompt */}
          <SystemPromptContainer
            localState={localState}
            setLocalState={setLocalState}
          />
          <div className="flex flex-wrap md:justify-end gap-2 md:gap-4 items-center w-full">
            {/* Share Settings Button */}
            <ShareSettingsButton
              localState={localState}
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
