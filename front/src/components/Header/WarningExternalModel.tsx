import { Trans } from "react-i18next";
import { useEffect, useState } from "react";
import { Lock, TriangleAlert } from "lucide-react";

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
        <TriangleAlert className="w-7 h-7 shrink-0 text-yellow-600 dark:text-yellow-400" />
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
  }, [isSafe]);

  const [showTextBox, setShowTextBox] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const isPopoverVisible = showTextBox || isHovering;

  return isSafe ? (
    <div
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <button
        onClick={() => setShowTextBox(!showTextBox)}
        className="flex items-center h-10 w-10 gap-2 px-2 py-2 relative
                  bg-green-100 hover:bg-green-200
                  dark:bg-green-900/30 dark:hover:bg-green-900/50
                  border border-green-300 dark:border-green-600
                  rounded-md text-green-800 dark:text-green-300
                  text-sm font-medium transition-colors shadow-md cursor-pointer"
      >
        <Lock className="w-full h-full"/>
        {/* <Trans i18nKey="alert.title" /> */}
      </button>

      {isPopoverVisible && (
        <div
          className="absolute right-0 mt-2 p-4 
                        bg-white dark:bg-gray-800 
                        border border-gray-200 dark:border-gray-600 
                        rounded-lg shadow-xl min-w-80 max-w-96 z-20"
        >
          <div className="text-green-600 dark:text-green-400 text-sm leading-relaxed">
            <Trans
              i18nKey={"alert.data_security_notice"}
            />
          </div>
          <button
            onClick={() => setShowTextBox(false)}
            className="absolute top-2 right-2 
                       text-gray-500 hover:text-gray-700 
                       dark:text-gray-400 dark:hover:text-white 
                       transition-colors cursor-pointer"
            title="Close"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <div
            className="absolute -top-1 right-17.5 md:right-6.5 w-2 h-2 
                          bg-white dark:bg-gray-800 
                          border-l border-t border-gray-200 dark:border-gray-600 
                          transform rotate-45"
          ></div>
        </div>
      )}
    </div>
  ) : (
    <div
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <button
        onClick={() => setShowTextBox(!showTextBox)}
        className="flex items-center h-10 w-10 gap-2 px-2 py-2 relative
                   bg-yellow-100 hover:bg-yellow-200 
                   dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 
                   border border-yellow-300 dark:border-yellow-600 
                   rounded-md text-yellow-800 dark:text-yellow-300 
                   text-sm font-medium transition-colors shadow-md cursor-pointer"
      >
        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        {/* <Trans i18nKey="alert.title" /> */}
      </button>

      {isPopoverVisible && (
        <div
          className="absolute right-0 mt-2 p-4 
                        bg-white dark:bg-gray-800 
                        border border-gray-200 dark:border-gray-600 
                        rounded-lg shadow-xl min-w-80 max-w-96 z-20"
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
            onClick={() => setShowTextBox(false)}
            className="absolute top-2 right-2 
                       text-gray-500 hover:text-gray-700 
                       dark:text-gray-400 dark:hover:text-white 
                       transition-colors cursor-pointer"
            title="Close"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <div
            className="absolute -top-1 right-17.5 md:right-6.5 w-2 h-2 
                          bg-white dark:bg-gray-800 
                          border-l border-t border-gray-200 dark:border-gray-600 
                          transform rotate-45"
          ></div>
        </div>
      )}
    </div>
  )
};
