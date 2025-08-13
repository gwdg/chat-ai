// Core imports
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import "react-toastify/dist/ReactToastify.css";

// Modals and components imports
import SettingsPanel from "./SettingsPanel/SettingsPanel";

//Hooks and Redux
import Sidebar from "./Sidebar";
import { selectDarkMode, selectShowSettings, selectShowSidebar, toggleSidebar } from "../../Redux/reducers/interfaceSettingsSlice";
import WarningButton from "../Others/WarningButton";
import { useModal } from "../../modals/ModalContext";
import HallucinationWarning from "./HallucinationWarning";
import Responses from "./Responses";
import Prompt from "./Prompt";

function Chat({
  localState,
  setLocalState,
  modelsData,
  userData,
  showFooter,
  mainDiv,
}) {
  // Hooks
  const dispatch = useDispatch();
  const { openModal } = useModal();

  // Redux selectors

  const showSettings = useSelector(selectShowSettings);
  const showSidebar = useSelector(selectShowSidebar);

  const [selectedFiles, setSelectedFiles] = useState([]);
  // const [isDarkMode, setIsDarkMode] = useState(isDarkModeGlobal);
  
  //Refs
  const isIntentionalRefresh = useRef(false);

  const currentModel = "meta-llama-3.1-8b-instruct" // TODO localState.csettings["model"]

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F5" || (e.ctrlKey && e.key === "r")) {
        if (selectedFiles.length > 0) {
          e.preventDefault();
          openModal("unsentFiles")
        }
      }
    };

    const handleBeforeUnload = (e) => {
      if (selectedFiles.length > 0 && !isIntentionalRefresh.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [selectedFiles]);

  

  return (
    <>
      {/* Main chat container */}
      <div className="flex flex-1 overflow-hidden relative bg-bg_light dark:bg-bg_dark">
        <div className="flex flex-col flex-1 w-full overflow-hidden">
          <div
            ref={mainDiv}
            className={`flex-1 overflow-y-auto bg-bg_light dark:bg-bg_dark desktop:rounded-2xl 
          overscroll-behavior-contain
          ${
            showFooter
              ? "h-[calc(100vh-54px-58px)] desktop:h-[calc(100vh-112px)]"
              : "h-[calc(100vh-54px-32px)] desktop:h-[calc(100vh-132px)]"
          }`}
            style={{
              WebkitOverflowScrolling: "touch",
              height: showFooter
                ? "calc(100dvh - 54px - 58px)"
                : "calc(100dvh - 54px - 32px)",
            }}
          >
      <div className="flex h-full w-full relative">
        {showSidebar && (
          <>
            {/* Mobile overlay backdrop */}
            <div
              className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20 backdrop-blur-sm"
              onClick={() => dispatch(toggleSidebar())}
              style={{
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
                touchAction: "none",
              }}
            />

            {/* Sidebar container with proper mobile sizing */}
            <div
              className={`
              ${showSidebar ? "translate-x-0" : "-translate-x-full"}
              custom:translate-x-0 transition-transform duration-200 ease-out
              fixed custom:relative desktop:w-[vw] max-w-sm w-72
              h-[calc(100vh-54px)] custom:h-full top-[54px] custom:top-0
              z-30 custom:z-auto flex-shrink-0 p-1.5
            `}
            >
              <Sidebar
                onClose={() => dispatch(toggleSidebar())}
              />
            </div>
          </>
        )}

        <div className="flex flex-col desktop:flex-row flex-1 h-full w-full">
          {!showSettings && (
            <WarningButton
              currentModel={currentModel}
              userData={userData}
            />
          )}
        {/* Main Conversation Window */}
        <div
          className={`flex flex-col items-center w-full ${
            !showSettings ? "desktop:w-[80%] py-1 mx-auto my-0" : "desktop:w-[60%] p-1"
          } h-full gap-2 sm:justify-between relative bg-bg_light dark:bg-bg_dark`}
        >
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col relative w-[calc(100%-8px)] desktop:w-full border dark:border-border_dark rounded-xl shadow-md dark:shadow-dark bg-white dark:bg-bg_secondary_dark">
            {/* Show Hallucination Warning */}
            <HallucinationWarning />
            {/* Show responses */}
            <Responses
              modelsData={modelsData}
              localState={localState}
              setLocalState={setLocalState}
              setSelectedFiles={setSelectedFiles}
              currentModel={currentModel}
            />
          </div>
          {/* Show Prompt */}
          <Prompt
            localState={localState}
            setLocalState={setLocalState}
            modelsData={modelsData}
            currentModel={currentModel}
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
          />
        </div>
        {showSettings && (
        <SettingsPanel
          localState={localState}
          setLocalState={setLocalState}
          modelsData={modelsData}
          userData={userData}
          selectedFiles={selectedFiles}
          setSelectedFiles={setSelectedFiles}
        />
        )}
      </div>
      </div>
      </div>
      </div>
      </div>
    </>
  );
}

export default Chat;
