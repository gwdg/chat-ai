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

/**
 * A compact, dot-free, pill-like toggle button.
 */
function MiniToolButton({ active, disabled, onClick, Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "group w-full select-none",
        "rounded-xl border text-sm",
        "px-3 py-2 md:px-3.5 md:py-2.5",
        "flex items-center justify-center gap-2",
        "transition-all",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : active
          ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-700 cursor-pointer"
          : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:bg-bg_secondary_dark dark:text-gray-100 dark:border-border_dark dark:hover:bg-gray-800 cursor-pointer",
        // subtle shadow only when active
        active ? "shadow-sm" : "shadow-none",
      ].join(" ")}
      title={label}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="leading-none">{label}</span>
    </button>
  );
}

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
      { key: "arcana", Icon: Book, label: "Arcana" },
      { key: "mcp", Icon: Server, label: "MCP" },
    ],
    []
  );

  // Simple setter for per-tool flags
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

  // Keep legacy web_search flag in sync
  const toggleWebSearch = (nextValue) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        enable_web_search: nextValue, // legacy support
        tools: { ...prev.settings?.tools, web_search: nextValue },
      },
      flush: true,
    }));
  };

  // First-time disclaimer for Web Search only (keep)
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

  // ⛔️ Removed popups: just toggle Arcana/MCP on/off.
  const handleToggleArcana = (nextValue) => {
    toggleTool("arcana", nextValue);
  };

  const handleToggleMCP = (nextValue) => {
    toggleTool("mcp", nextValue);
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

        <div className="w-full flex items-center gap-3 select-none">
          <button
            type="button"
            onClick={() =>
              setLocalState((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  enable_tools: !toolsEnabled,
                },
                flush: true,
              }))
            }
            className={[
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer",
              toolsEnabled ? "bg-sky-500" : "bg-gray-300 dark:bg-gray-600",
            ].join(" ")}
          >
            <span
              className={[
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                toolsEnabled ? "translate-x-6" : "translate-x-1",
              ].join(" ")}
            />
          </button>

          {toolsEnabled ? (
            <span className="text-sm font-medium text-sky-700 dark:text-sky-300">
              Tools enabled
            </span>
          ) : (
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Tools disabled
            </span>
          )}
        </div>
      </div>

      {/* Compact, responsive, dot-free grid */}
      <div
        className={[
          "grid gap-2.5 sm:gap-3",
          // auto-fill min width ~7.25rem so tiles stay small
          "grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))]",
        ].join(" ")}
      >
        {TOOL_DEFS.map(({ key, Icon, label }) => {
          const active = !!toolsState[key];

          const onToggle =
            key === "web_search"
              ? () => handleToggleWebSearch(!active)
              : key === "arcana"
              ? () => handleToggleArcana(!active)
              : key === "mcp"
              ? () => handleToggleMCP(!active)
              : () => toggleTool(key, !active);

          return (
            <MiniToolButton
              key={key}
              active={active}
              disabled={!toolsEnabled}
              onClick={onToggle}
              Icon={Icon}
              label={label}
            />
          );
        })}
      </div>
    </div>
  );
}
