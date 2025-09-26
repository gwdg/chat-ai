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
  Book, // Arcana
  Server, // MCP
} from "lucide-react";
import ToolTile from "./ToolTile";

export default function ToolsContainer({ localState, setLocalState }) {
  const { openModal } = useModal();
  const dispatch = useDispatch();
  const agreedWebSearch = useSelector(selectAgreeWebSearch);

  const settings = localState?.settings || {};
  const toolsState = settings.tools || {};
  const toolsEnabled = !!settings.enable_tools;

  // Central: read helper values
  const arcanaValue = settings?.arcana?.id || "";
  const mcpValue = settings?.mcp_servers || "";

  // Tool list
  const TOOL_DEFS = useMemo(
    () => [
      { key: "web_search", Icon: Globe, label: "Web Search" },
      { key: "image_generation", Icon: ImageIcon, label: "Image Generation" },
      { key: "image_modification", Icon: Wand2, label: "Image Modification" },
      { key: "audio_generation", Icon: AudioLines, label: "Audio Generation" },
      { key: "arcana", Icon: Book, label: "Arcana" },
      { key: "mcp", Icon: Server, label: "MCP" },
    ],
    []
  );

  // Generic toggle for non-web-search tools (and not arcana/mcp)
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

  // Open Arcana config modal
  const openArcanaModal = (initial = "") => {
    openModal("configureArcana", {
      initialValue: initial,
      onSave: (val) => {
        setLocalState((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            arcana: { ...(prev.settings?.arcana || {}), id: val },
          },
          flush: true,
        }));
      },
    });
  };

  // Open MCP config modal
  const openMCPModal = (initial = "") => {
    openModal("configureMCP", {
      initialValue: initial,
      onSave: (val) => {
        setLocalState((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            mcp_servers: val,
          },
          flush: true,
        }));
      },
    });
  };

  const handleToggleArcana = (nextValue) => {
    toggleTool("arcana", nextValue);
    if (nextValue && !arcanaValue) {
      openArcanaModal("");
    }
  };

  const handleToggleMCP = (nextValue) => {
    toggleTool("mcp", nextValue);
    if (nextValue && !mcpValue) {
      openMCPModal("");
    }
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

                if (!nextEnabled) {
                  // OFF: only master flag flips; keep per-tool states as-is
                  return {
                    ...prev,
                    settings: {
                      ...prev.settings,
                      enable_tools: false,
                    },
                    flush: true,
                  };
                }

                // ON: restore previous or set sensible defaults
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
                const initialArcana = isFirstTime ? false : !!prevTools.arcana;
                const initialMCP = isFirstTime ? false : !!prevTools.mcp;

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
                      arcana: initialArcana,
                      mcp: initialMCP,
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
              : key === "arcana"
              ? (next) => handleToggleArcana(next)
              : key === "mcp"
              ? (next) => handleToggleMCP(next)
              : (next) => toggleTool(key, next);

          // dynamic tiny caption under the tile
          let caption = label;
          if (key === "arcana" && active && arcanaValue) {
            caption = `Arcana`;
          } else if (key === "mcp" && active && mcpValue) {
            caption = `MCP`;
          }

          return (
            <div key={key} className="w-full flex flex-col items-center">
              <ToolTile
                enabledGlobally={toolsEnabled}
                active={active}
                onToggle={onToggle}
                Icon={Icon}
                label={label}
                size="sm"
              />
              <span className="mt-1 text-center text-[11px] sm:text-xs leading-tight text-gray-600 dark:text-gray-300 min-h-[1.4rem] px-1 line-clamp-2">
                {caption}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
