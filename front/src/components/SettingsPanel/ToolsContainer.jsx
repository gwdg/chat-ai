// components/settings/ToolsContainer.jsx
import React, { useMemo } from "react";
import { Trans } from "react-i18next";
import { useModal } from "../../modals/ModalContext";
import { useDispatch, useSelector } from "react-redux";
import {
  selectAgreeWebSearch,
  agreeWebSearch,
} from "../../Redux/reducers/interfaceSettingsSlice";
import {
  HelpCircle,
  Globe,
  Image as ImageIcon,
  Wand2,
  AudioLines,
} from "lucide-react";
import ToolTile from "./ToolTile";

/**
 * Manages state, disclaimer, persistence & layout for the tool toggles.
 */
export default function ToolsContainer({ localState, setLocalState }) {
  const { openModal } = useModal();
  const dispatch = useDispatch();
  const agreedWebSearch = useSelector(selectAgreeWebSearch);

  const settings = localState?.settings || {};
  const toolsState = settings.tools || {};
  const toolsEnabled = !!settings.enable_tools;

  // Tool list
  const TOOL_DEFS = useMemo(
    () => [
      { key: "web_search", Icon: Globe, label: "Web Search" },
      { key: "image_generation", Icon: ImageIcon, label: "Image Generation" },
      { key: "image_modification", Icon: Wand2, label: "Image Modification" },
      { key: "audio_generation", Icon: AudioLines, label: "Audio Generation" },
    ],
    []
  );

  // Generic toggle for non-web-search tools
  const toggleTool = (toolKey, nextValue) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, [toolKey]: nextValue },
      },
      flush: true,
    }));
  };

  // Keep old flag + new tools.web_search in sync
  const toggleWebSearch = (nextValue) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        enable_web_search: nextValue, // legacy support
        tools: {
          ...prev.settings?.tools,
          web_search: nextValue,
        },
      },
      flush: true,
    }));
  };

  // First-time disclaimer logic for Web Search
  const handleToggleWebSearch = (nextValue) => {
    if (nextValue && !agreedWebSearch) {
      openModal("disclaimerWebSearch", {
        onAgree: () => {
          toggleWebSearch(true);
          dispatch(agreeWebSearch());
        },
      });
      return;
    }
    toggleWebSearch(nextValue);
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex flex-row md:gap-4 gap-3 w-full md:items-center">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
          <p className="text-sm font-medium">GWDG Tools</p>
          <HelpCircle
            className="h-[16px] w-[16px] cursor-pointer text-sky-600 dark:text-sky-400"
            alt="help"
            onClick={() => openModal("helpTools")}
          />
        </div>

        <div className="w-full flex items-center gap-2">
          <input
            id="use-gwdg-tools"
            type="checkbox"
            checked={toolsEnabled}
            onChange={(e) =>
              setLocalState((prev) => {
                const nextEnabled = e.target.checked;
                const prevTools = prev.settings?.tools || {};

                // Turning OFF: preserve per-tool states; only master flag flips
                if (!nextEnabled) {
                  return {
                    ...prev,
                    settings: {
                      ...prev.settings,
                      enable_tools: false,
                    },
                    flush: true,
                  };
                }

                // Turning ON: restore previous tool states if they exist;
                // else initialize defaults (all ON except web_search unless already agreed).
                const isFirstTime = Object.keys(prevTools).length === 0;
                const initialWeb = isFirstTime
                  ? !!agreedWebSearch
                  : !!prevTools.web_search;
                const initialImgGen = isFirstTime
                  ? true
                  : !!prevTools.image_generation;
                const initialImgMod = isFirstTime
                  ? true
                  : !!prevTools.image_modification;
                const initialAudio = isFirstTime
                  ? true
                  : !!prevTools.audio_generation;

                return {
                  ...prev,
                  settings: {
                    ...prev.settings,
                    enable_tools: true,
                    enable_web_search: initialWeb, // legacy sync
                    tools: {
                      ...prevTools,
                      web_search: initialWeb,
                      image_generation: initialImgGen,
                      image_modification: initialImgMod,
                      audio_generation: initialAudio,
                    },
                  },
                  flush: true,
                };
              })
            }
            className="h-4 w-4 text-tertiary bg-gray-200 border-gray-300 rounded focus:ring-tertiary focus:ring-2"
          />
          {!toolsEnabled ? (
            <span className="text-sm text-gray-600 dark:text-gray-300">
              <Trans i18nKey="settings.tools_disabled">
                Tools are disabled
              </Trans>
            </span>
          ) : (
            <span className="text-sm text-green-600 dark:text-green-300">
              <Trans i18nKey="settings.tools_enabled">Tools are enabled</Trans>
            </span>
          )}
        </div>
      </div>

      {/* Icon grid – auto-fill, tidy at any width */}
      <div className="grid gap-3 sm:gap-4 place-items-center grid-cols-[repeat(auto-fill,minmax(6.2rem,1fr))]">
        {TOOL_DEFS.map(({ key, Icon, label }) => {
          const active = !!toolsState[key];
          const onToggle =
            key === "web_search"
              ? (next) => handleToggleWebSearch(next)
              : (next) => toggleTool(key, next);

          return (
            <div key={key} className="w-full flex flex-col items-center">
              <ToolTile
                enabledGlobally={toolsEnabled}
                active={active}
                onToggle={onToggle}
                Icon={Icon}
                label={label}
                size="sm" // << choose "sm" | "md" | "lg"
              />
              <span className="mt-1 text-center text-[11px] sm:text-xs leading-tight text-gray-600 dark:text-gray-300 min-h-[1.4rem] px-1">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
