import { Trans } from "react-i18next";
import { useEffect, useState } from "react";
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


export default function WarningExternalModel({ localState, userData }) {
  // Add safety check for model
  const isSafe = isSafeSettings(localState);

  useEffect(() => {
    setShowTextBox(true);
    setSuppressHoverTooltip(false);
  }, [isSafe]);

  const [showTextBox, setShowTextBox] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [suppressHoverTooltip, setSuppressHoverTooltip] = useState(false);
  const isPopoverVisible = showTextBox || (isHovering && !suppressHoverTooltip);

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

  return isSafe ? (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleToggleButton}
        onFocus={() => setSuppressHoverTooltip(false)}
        className="flex items-center h-10 w-10 gap-2 px-2 py-2 relative
                  bg-green-100 hover:bg-green-200
                  dark:bg-green-900/30 dark:hover:bg-green-900/50
                  border border-green-300 dark:border-green-600
                  rounded-md text-green-800 dark:text-green-300
                  text-sm font-medium transition-colors shadow-md cursor-pointer"
      >
        <Locked size={24} className="w-full h-full"/>
        {/* <Trans i18nKey="alert.title" /> */}
      </button>

      {isPopoverVisible && (
        <div
          className="absolute right-0 bottom-full mb-2 p-4
                        bg-white dark:bg-gray-800
                        border border-gray-200 dark:border-gray-600
                        rounded-lg shadow-xl w-56 max-w-[calc(100vw-2rem)] z-20"
        >
          <div className="text-green-600 dark:text-green-400 text-sm leading-relaxed">
            <Trans
              i18nKey={"alert.data_security_notice"}
            />
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
          <div
            className="absolute -bottom-1 right-17.5 md:right-6.5 w-2 h-2
                          bg-white dark:bg-gray-800
                          border-r border-b border-gray-200 dark:border-gray-600
                          transform rotate-45"
          ></div>
        </div>
      )}
    </div>
  ) : (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleToggleButton}
        onFocus={() => setSuppressHoverTooltip(false)}
        className="flex items-center h-10 w-10 gap-2 px-2 py-2 relative
                   bg-yellow-100 hover:bg-yellow-200 
                   dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 
                   border border-yellow-300 dark:border-yellow-600 
                   rounded-md text-yellow-800 dark:text-yellow-300 
                   text-sm font-medium transition-colors shadow-md cursor-pointer"
      >
        <WarningAltFilled size={24} className="w-full h-full" />
        {/* <Trans i18nKey="alert.title" /> */}
      </button>

      {isPopoverVisible && (
        <div
          className="absolute right-0 bottom-full mb-2 p-4
                        bg-white dark:bg-gray-800
                        border border-gray-200 dark:border-gray-600
                        rounded-lg shadow-xl w-56 max-w-[calc(100vw-2rem)] z-20"
        >
          <div className="text-yellow-600 dark:text-yellow-400 text-sm leading-relaxed">
            <Trans
              i18nKey={
                userData?.org === "MPG"
                  ? "alert.data_security_warning_mpg"
                  : "alert.data_security_warning"
              }
            />
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
          <div
            className="absolute -bottom-1 right-17.5 md:right-6.5 w-2 h-2
                          bg-white dark:bg-gray-800
                          border-r border-b border-gray-200 dark:border-gray-600
                          transform rotate-45"
          ></div>
        </div>
      )}
    </div>
  )
};
