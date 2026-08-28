import { Trans } from "react-i18next";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Locked, WarningAltFilled, Close } from "@carbon/icons-react";

function isSafeSettings(localState) {
  const modelName = localState?.settings?.model?.name;
  const isExternalModel =
    typeof modelName === "string" &&
    modelName.toLowerCase().includes("external");

  const toolsEnabled = !!localState?.settings?.enable_tools;
  const tools = localState?.settings?.tools || {};

  // Web search should only trigger warnings when the toolset is active
  const webSearchEnabled =
    toolsEnabled &&
    (localState?.settings?.enable_web_search ||
      !!tools.web_search ||
      !!tools.fetch_url);

  const mcpEnabled = toolsEnabled && !!tools.mcp;

  return !(isExternalModel || webSearchEnabled || mcpEnabled);
}

export function DataSafetyText({ localState, userData }) {
  const isSafe = isSafeSettings(localState);
  if(isSafe) return null;
  return (
    <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-600 rounded-md text-yellow-800 dark:text-yellow-300">
      <div className="flex items-center gap-2 p-2 text-sm text-yellow-700 dark:text-yellow-300 select-none">
        <WarningAltFilled size={28} className="shrink-0 text-yellow-600 dark:text-yellow-400" />
        <Trans
        i18nKey={
            userData?.org === "MPG"
            ? "alert.data_security_warning_mpg"
            : "alert.data_security_warning"
        }
        />
      </div>
    </div>
  );
}

/** Everything the two states differ by — colours, icon and message. */
const TONES = {
  safe: {
    Icon: Locked,
    button:
      `bg-green-100 hover:bg-green-200
       dark:bg-green-900/30 dark:hover:bg-green-900/50
       border-green-300 dark:border-green-600
       text-green-800 dark:text-green-300`,
    text: "text-green-600 dark:text-green-400",
  },
  warning: {
    Icon: WarningAltFilled,
    button:
      `bg-yellow-100 hover:bg-yellow-200
       dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50
       border-yellow-300 dark:border-yellow-600
       text-yellow-800 dark:text-yellow-300`,
    text: "text-yellow-600 dark:text-yellow-400",
  },
};

const PANEL_WIDTH = 224; // w-56, needed to place the portalled panel

export default function WarningExternalModel({
  localState,
  userData,
  // Render the panel through a portal, for callers whose container clips
  // absolutely positioned children (the prompt box is an overflow container).
  portalPanel = false,
  // Smaller trigger, so the button fits a toolbar row of 24px icons.
  compact = false,
}) {
  // Add safety check for model
  const isSafe = isSafeSettings(localState);

  useEffect(() => {
    setShowTextBox(true);
    setSuppressHoverTooltip(false);
  }, [isSafe]);

  const [showTextBox, setShowTextBox] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [suppressHoverTooltip, setSuppressHoverTooltip] = useState(false);
  const isPopoverVisible = (showTextBox && !isSafe) || (isHovering && !suppressHoverTooltip);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [panelPosition, setPanelPosition] = useState({ left: 0, bottom: 0 });

  // Keep the portalled panel pinned above its button.
  const measure = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const maxLeft = window.innerWidth - PANEL_WIDTH - 8;
    setPanelPosition({
      left: Math.max(8, Math.min(rect.right - PANEL_WIDTH, maxLeft)),
      bottom: window.innerHeight - rect.top + 8,
    });
  }, []);

  useLayoutEffect(() => {
    if (!portalPanel || !isPopoverVisible) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [portalPanel, isPopoverVisible, measure]);

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (suppressHoverTooltip) {
      setSuppressHoverTooltip(false);
    }
  };

  const handleCloseTooltip = () => {
    setShowTextBox(false);
    setSuppressHoverTooltip(true);
  };

  const handleToggleButton = () => {
    setSuppressHoverTooltip(false);
    setShowTextBox((prev) => !prev);
  };

  const tone = isSafe ? TONES.safe : TONES.warning;
  const ToneIcon = tone.Icon;
  const messageKey = isSafe
    ? "alert.data_security_notice"
    : userData?.org === "MPG"
      ? "alert.data_security_warning_mpg"
      : "alert.data_security_warning";

  const panel = (
    <div
      className={`${
        portalPanel ? "fixed z-[999999]" : "absolute right-0 bottom-full mb-2 z-20"
      } p-4 bg-white dark:bg-gray-800
         border border-gray-200 dark:border-gray-600
         rounded-lg shadow-xl w-56 max-w-[calc(100vw-2rem)]`}
      style={
        portalPanel
          ? { left: panelPosition.left, bottom: panelPosition.bottom }
          : undefined
      }
    >
      <div className={`${tone.text} text-sm leading-relaxed`}>
        <Trans i18nKey={messageKey} />
      </div>
      <button
        onClick={handleCloseTooltip}
        className="absolute top-2 right-2
                   text-gray-500 hover:text-gray-700
                   dark:text-gray-400 dark:hover:text-white
                   transition-colors cursor-pointer"
        title="Close"
      >
        <Close size={16} />
      </button>
      {/* The tail's offsets assume the inline anchor, so it is inline only. */}
      {!portalPanel && (
        <div
          className="absolute -bottom-1 right-17.5 md:right-6.5 w-2 h-2
                        bg-white dark:bg-gray-800
                        border-r border-b border-gray-200 dark:border-gray-600
                        transform rotate-45"
        ></div>
      )}
    </div>
  );

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        ref={buttonRef}
        onClick={handleToggleButton}
        onFocus={() => setSuppressHoverTooltip(false)}
        className={`flex items-center justify-center gap-2 relative border
                    rounded-xl text-sm font-medium transition-colors cursor-pointer
                    ${compact ? "h-8 w-8 p-1.5" : "h-10 w-10 px-2 py-1"}
                    ${tone.button}`}
      >
        <ToneIcon size={compact ? 20 : 24} />
      </button>

      {isPopoverVisible &&
        (portalPanel ? createPortal(panel, document.body) : panel)}
    </div>
  );
}
