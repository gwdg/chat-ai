// Core imports
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import "react-toastify/dist/ReactToastify.css";

// Modals and components imports
import Conversation from "./Conversation";
import SettingsPanel from "./SettingsPanel/SettingsPanel";

//Hooks and Redux
import {
  setCurrentConversation,
  updateConversation,
} from "../../Redux/reducers/conversationsSlice";
import { toggleOption } from "../../Redux/actions/advancedOptionsAction";
import Sidebar from "./Sidebar";
import WarningButton from "../Others/WarningButton";
import { useModal } from "../../modals/ModalContext";

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
  const { conversationId } = useParams();
  const { openModal } = useModal();

  // Redux selectors
  const isDarkModeGlobal = useSelector((state) => state.theme.isDarkMode);
  const currentConversation = useSelector((state) =>
    state.conversations?.conversations?.find(
      (conv) => conv.id === conversationId
    )
  );

  const [isActive, setIsActive] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(isDarkModeGlobal);
  const [showAdvOpt, setShowAdvOpt] = useState(
    useSelector((state) => state.advOptions.isOpen)
  );
  //Refs
  const isIntentionalRefresh = useRef(false);

  // ==== EFFECTS SECTION ====

  // Responsive sidebar handling
    useEffect(() => {
      const handleResize = () => {
        setShowSidebar(window.innerWidth > 1080);
      };
  
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

  // Effect 1: Initializes local state when conversation ID or current conversation changes
  useEffect(() => {
    // Only proceed if both conversationId and currentConversation exist
    if (conversationId && currentConversation) {
      // Update the current conversation in Redux store
      dispatch(setCurrentConversation(conversationId));

      // Initialize local state with all conversation data
      setLocalState({
        title: currentConversation.title, // Current title
        prompt: currentConversation.prompt, // Current prompt text
        responses: currentConversation.responses, // Array of AI responses
        messages: currentConversation.messages, // Full conversation history
        settings: { ...currentConversation.settings }, // Chat settings (temperature, etc.)
        exportOptions: { ...currentConversation.exportOptions }, // Export preferences
        dontShow: { ...currentConversation.dontShow }, // UI visibility settings
        arcana: { ...currentConversation.arcana }, // Arcana-specific settings
      });
    }
  }, [conversationId, currentConversation, dispatch]);

  // Effect 2: Debounced auto-save of conversation changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsActive(!document.hidden);
    };

    // Initial state
    setIsActive(!document.hidden);

    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Only dispatch updateConversation if this tab has focus
  useEffect(() => {
    // Only update if this tab is active
    if (!isActive) return;

    const timer = setTimeout(() => {
      if (currentConversation) {
        dispatch(
          updateConversation({
            id: conversationId,
            updates: {
              ...localState,
              lastModified: new Date().toISOString(),
            },
          })
        );
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localState, currentConversation, conversationId, dispatch, isActive]);

  // Effect 3: Handle dark mode toggling
  useEffect(() => {
    const root = window.document.documentElement;

    // Toggle dark mode class on root element
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  const currentModel = localState.settings["model"]

  // Toggle advanced options visibility
  const toggleAdvOpt = () => {
    setShowAdvOpt(!showAdvOpt);
    dispatch(toggleOption());
  };

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
              onClick={() => setShowSidebar(false)}
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
                onClose={() => setShowSidebar(false)}
              />
            </div>
          </>
        )}

        <div className="flex flex-col desktop:flex-row flex-1 h-full w-full">
          {!showAdvOpt && (
            <WarningButton
              currentModel={currentModel}
              userData={userData}
            />
          )}
          <Conversation
            localState={localState}
            setLocalState={setLocalState}
            modelsData={modelsData}
            currentModel={currentModel}
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
            showAdvOpt={showAdvOpt}
            toggleAdvOpt={toggleAdvOpt}
          />
          <SettingsPanel
            localState={localState}
            setLocalState={setLocalState}
            modelsData={modelsData}
            userData={userData}
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
            showAdvOpt={showAdvOpt}
            toggleAdvOpt={toggleAdvOpt}
          />
        </div>
      </div>
      </div>
      </div>
      </div>
    </>
  );
}

export default Chat;
