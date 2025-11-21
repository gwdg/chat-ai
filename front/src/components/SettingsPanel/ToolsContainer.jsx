// components/settings/ToolsContainer.jsx
import React, { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
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
  Video,
  Wand2,
  AudioLines,
  Server, // MCP
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen } from "@fortawesome/free-solid-svg-icons";

function MiniToolButton({ active, disabled, onClick, Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "group w-full select-none",
        "rounded-xl border text-sm font-medium",
        "px-3 py-2 md:px-3.5 md:py-2.5",
        "flex flex-col items-center justify-center gap-2",
        "transition-all",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : active
          ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700 cursor-pointer"
          : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:bg-bg_secondary_dark dark:text-gray-100 dark:border-border_dark dark:hover:bg-gray-800 cursor-pointer",
        active ? "shadow-sm" : "shadow-none",
      ].join(" ")}
      title={label}
    >
      <Icon className="h-6 w-6 md:h-7 md:w-7 shrink-0" aria-hidden="true" />
      <span className="leading-none text-xs text-center">
        {label}
      </span>
    </button>
  );
}

export default function ToolsContainer({ localState, setLocalState }) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const dispatch = useDispatch();
  const agreedWebSearch = useSelector(selectAgreeWebSearch);

  const settings = localState?.settings || {};
  const toolsState = settings.tools || {};
  const toolsEnabled = !!settings.enable_tools;

  // Tool list (labels are translated)
  const TOOL_DEFS = useMemo(
    () => [
      { key: "web_search", Icon: Globe, label: t("settings.label_web_search") },
      {
        key: "image_generation",
        Icon: ImageIcon,
        label: t("settings.label_image_generation"),
      },
      {
        key: "image_modification",
        Icon: Wand2,
        label: t("settings.label_image_modification"),
      },
      {
        key: "audio_generation",
        Icon: AudioLines,
        label: t("settings.label_audio_generation"),
      },
      {
        key: "video_generation",
        Icon: Video,
        label: t("settings.label_video_generation"),
      },
      {
        key: "arcana",
        Icon: ({ className = "", ...rest }) => (
          <FontAwesomeIcon
            icon={faBookOpen}
            className={[
              "leading-none",
              "text-[18px] md:text-[22px] lg:text-[26px]",
              className,
            ].join(" ")}
            {...rest}
          />
        ),
        label: t("settings.label_arcana"),
      },
      { key: "mcp",
        Icon: Server,
        label: t("settings.label_mcp_server")
      },
    ],
    [t]
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

  // First-time disclaimer for Web Search only
  const handleToggleWebSearch = (nextValue) => {
    if (nextValue && !agreedWebSearch) {
      openModal("disclaimerWebSearch", {
        onAgree: () => {
          toggleTool("web_search", true);
          toggleTool("fetch_url", true);
          dispatch(agreeWebSearch());
        },
      });
      return;
    }
    toggleTool("web_search", nextValue);
    toggleTool("fetch_url", nextValue);
  };

  // Arcana/MCP toggles
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
          <p className="text-sm font-medium">{t("settings.tools_title")}</p>
          <HelpCircle
            className="h-[16px] w-[16px] cursor-pointer text-gray-500 dark:text-gray-400"
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
                settings: { ...prev.settings, enable_tools: !toolsEnabled },
                flush: true,
              }))
            }
            className={[
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer",
              toolsEnabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600",
            ].join(" ")}
            aria-label={
              toolsEnabled
                ? t("settings.tools_enabled")
                : t("settings.tools_disabled")
            }
          >
            <span
              className={[
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                toolsEnabled ? "translate-x-6" : "translate-x-1",
              ].join(" ")}
            />
          </button>

          {toolsEnabled ? (
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              <Trans i18nKey="settings.tools_enabled">Tools are enabled</Trans>
            </span>
          ) : (
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              <Trans i18nKey="settings.tools_disabled">Tools are disabled</Trans>
            </span>
          )}
        </div>
      </div>

      {/* Compact, responsive grid */}
      <div
        className={[
          "grid gap-2.5 sm:gap-3",
          "grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))]",
        ].join(" ")}
      >
        {TOOL_DEFS.map(({ key, Icon, label }) => {
          const active = !!toolsState[key];
          const onToggle =
            key === "web_search"
              ? () => handleToggleWebSearch(!active)
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
