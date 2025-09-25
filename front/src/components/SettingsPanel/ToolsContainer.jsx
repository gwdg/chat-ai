import React, { useMemo } from "react";
import { Trans } from "react-i18next";
import { useModal } from "../../modals/ModalContext";
import {
  HelpCircle,
  Globe,
  Image as ImageIcon,
  Wand2,
  AudioLines,
} from "lucide-react";

function ToolTile({ enabledGlobally, active, onToggle, Icon, label }) {
  const isDisabled = !enabledGlobally;

  return (
    <button
      type="button"
      onClick={() => !isDisabled && onToggle(!active)}
      title={label}
      aria-label={label}
      aria-pressed={active}
      aria-disabled={isDisabled}
      className={[
        "group relative isolate rounded-2xl border",
        "flex items-center justify-center",
        "h-14 w-14 md:h-16 md:w-16",
        "transition-all duration-150",
        // --- states ---
        isDisabled
          ? [
              "cursor-not-allowed opacity-60",
              "border-gray-200 text-gray-400",
              "dark:border-gray-700 dark:text-gray-500",
              "bg-gray-50 dark:bg-gray-800/40",
            ].join(" ")
          : active
          ? [
              "cursor-pointer ring-2",
              "border-emerald-600 ring-emerald-500 bg-emerald-50",
              "text-emerald-800",
              "dark:border-emerald-500/70 dark:ring-emerald-400",
              "dark:bg-emerald-900/20 dark:text-emerald-200",
            ].join(" ")
          : [
              "cursor-pointer",
              "border-gray-200 bg-white text-gray-700",
              "hover:shadow-sm hover:-translate-y-0.5 hover:ring-2 hover:ring-emerald-200",
              "dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
              "dark:hover:ring-emerald-500/30",
            ].join(" "),
      ].join(" ")}
    >
      {/* subtle background dot grid (light/dark aware) */}
      <span
        aria-hidden
        className={[
          "pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity",
          "group-hover:opacity-100",
          "bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.05)_1px,transparent_0)]",
          "bg-[length:10px_10px]",
          // dark theme dots
          "dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)]",
          active ? "opacity-100" : "",
        ].join(" ")}
      />

      <Icon
        className={[
          "relative h-6 w-6 md:h-7 md:w-7 transition-transform",
          isDisabled ? "" : active ? "scale-105" : "group-hover:scale-105",
        ].join(" ")}
      />

      {/* tiny status dot at bottom */}
      <span
        aria-hidden
        className={[
          "absolute bottom-1.5 h-1.5 w-1.5 rounded-full",
          isDisabled
            ? "bg-gray-300 dark:bg-gray-600"
            : active
            ? "bg-emerald-600 dark:bg-emerald-400"
            : "bg-gray-200 group-hover:bg-emerald-300",
          "dark:group-hover:bg-emerald-400/70",
        ].join(" ")}
      />
    </button>
  );
}


function ToolsContainer({ localState, setLocalState }) {
  const { openModal } = useModal();
  const settings = localState?.settings || {};
  const toolsState = settings.tools || {};
  const toolsEnabled = !!settings.enable_tools;

  const TOOL_DEFS = useMemo(
    () => [
      { key: "web_search", Icon: Globe, label: "Web Search" },
      { key: "image_generation", Icon: ImageIcon, label: "Image Generation" },
      { key: "image_modification", Icon: Wand2, label: "Image Modification" },
      { key: "audio_generation", Icon: AudioLines, label: "Audio Generation" },
    ],
    []
  );

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

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex flex-row md:gap-4 gap-3 w-full md:items-center">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
          <p className="text-sm font-medium">GWDG Tools</p>
          <HelpCircle
            className="h-[16px] w-[16px] cursor-pointer text-[#009EE0]"
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
              setLocalState((prev) => ({
                ...prev,
                settings: { ...prev.settings, enable_tools: e.target.checked },
                flush: true,
              }))
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

      {/* Icon grid – auto-fit, wraps as needed */}
      <div className="grid gap-2 place-items-center grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(4rem,1fr))]">
        {TOOL_DEFS.map(({ key, Icon, label }) => (
          <ToolTile
            key={key}
            enabledGlobally={toolsEnabled}
            active={!!toolsState[key]}
            onToggle={(next) => toggleTool(key, next)}
            Icon={Icon}
            label={label}
          />
        ))}
      </div>
    </div>
  );
}

export default ToolsContainer;
