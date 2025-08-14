import { useCallback, useEffect, useRef, useState, useMemo } from "react";

import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { useToast } from "../hooks/useToast";
import { useModal } from "../modals/ModalContext";
import { useSelector, useDispatch } from "react-redux";
import { selectCurrentConversation, selectCurrentConversationId, updateConversation } from "../Redux/reducers/conversationsSlice";
import { setCurrentConversation } from "../Redux/reducers/currentConversationSlice";
import { selectShowSettings, selectShowSidebar } from "../Redux/reducers/interfaceSettingsSlice";
import Sidebar from "../components/Sidebar/Sidebar";
import HallucinationWarning from "../components/Others/HallucinationWarning";
import Conversation from "../components/Conversation/Conversation";
import Prompt from "../components/Prompt/Prompt";
import SettingsPanel from "../components/SettingsPanel/SettingsPanel";
import { selectDarkMode } from "../Redux/reducers/interfaceSettingsSlice";
import { toggleSidebar } from "../Redux/reducers/interfaceSettingsSlice";
import { getDefaultConversation, getDefaultSettings } from "../utils/conversationUtils";
import WarningButton from "../components/Others/WarningButton";

import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { useSyncConversation } from "../hooks/useSyncConversation";

// Main layout component that manages the overall structure and state of the chat application
function ChatPage() {
  // UI state management
  const [showFooter, setShowFooter] = useState(false);
  const showSettings = useSelector(selectShowSettings);
  const showSidebar = useSelector(selectShowSidebar);
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Refs and hooks initialization
  const { openModal } = useModal();
  const mainDiv = useRef(null);
  const dispatch = useDispatch();
  const defaultSettings = useMemo(() => getDefaultSettings(), []);

  // Getters for modelsData and userData
  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();

  // Initialize localState as empty conversation
  const [localState, setLocalState] = useState(() => getDefaultConversation());
  // Sync local state with redux and current conversation
  useSyncConversation ({
    localState,
    setLocalState
  });

  // Handle Refresh
  const isIntentionalRefresh = useRef(false);
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


  // Scroll utility functions
  const scrollToBottom = useCallback(() => {
    if (mainDiv.current) {
      mainDiv.current.scrollTop = mainDiv.current.scrollHeight;
    }
  }, []);

  const scrollToTop = useCallback(() => {
    if (mainDiv.current) {
      mainDiv.current.scrollTop = 0;
    }
  }, []);

  // Toggle footer and scroll accordingly
  const toggleFooter = useCallback(() => {
    setShowFooter((prev) => {
      const newState = !prev;
      setTimeout(newState ? scrollToTop : scrollToBottom, 0);
      return newState;
    });
  }, [scrollToTop, scrollToBottom]);  

  // Handle resize events
  useEffect(() => {
    const handleResize = () => {
      toggleSidebar(window.innerWidth > 1080);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle dark mode toggling
  const isDarkMode = useSelector(selectDarkMode);
  useEffect(() => {
    const root = window.document.documentElement;
      // Toggle dark mode class on root element
      if (isDarkMode) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
  }, [isDarkMode]);
 
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-black">
      {/* Header */}
      <Header
        localState={localState}
        setLocalState={setLocalState} 
        modelsData={modelsData}
        userData={userData}
      />
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
              {/* Sidebar */}
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
                {/* External model warning when settings is hidden */}
                {!showSettings && (
                  <WarningButton
                    localState={localState}
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
                    <Conversation
                      localState={localState}
                      setLocalState={setLocalState}
                      modelsData={modelsData}
                    />
                  </div>
                  {/* Show Prompt */}
                  <Prompt
                    localState={localState}
                    setLocalState={setLocalState}
                    modelsData={modelsData}
                    selectedFiles={selectedFiles}
                    setSelectedFiles={setSelectedFiles}
                  />
                </div>
                {/* Settings Panel */}
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
      {/* Footer */}
      <Footer
        showFooter={showFooter}
        toggleFooter={toggleFooter}
        setShowFooter={setShowFooter}
        scrollToTop={scrollToTop}
      />
    </div>
  );
}

export default ChatPage;
