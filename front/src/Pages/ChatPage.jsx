import { Transition } from "@headlessui/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Conversation from "../components/Conversation/Conversation";
import Footer from "../components/Footer/Footer";
import Header from "../components/Header/Header";
import HallucinationWarning from "../components/Others/HallucinationWarning";
import WarningButton from "../components/Others/WarningButton";
import Prompt from "../components/Prompt/Prompt";
import SettingsPanel from "../components/SettingsPanel/SettingsPanel";
import CollapsedSidebar from "../components/Sidebar/CollapsedSidebar";
import Sidebar from "../components/Sidebar/Sidebar";
import { createConversation } from "../db";
import { useModal } from "../modals/ModalContext";
import {
  selectCurrentConversationId,
  selectLockConversation,
} from "../Redux/reducers/conversationsSlice";
import {
  selectDarkMode,
  selectShowSettings,
  selectShowSidebar,
  toggleSidebar,
} from "../Redux/reducers/interfaceSettingsSlice";
import { persistor } from "../Redux/store/store";
import {
  getDefaultConversation,
  getDefaultSettings,
} from "../utils/conversationUtils";

import { useSyncConversation } from "../hooks/useSyncConversation";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";

function ChatPage({ conversationId }) {
  const [showFooter, setShowFooter] = useState(false);
  const showSettings = useSelector(selectShowSettings);
  const showSidebar = useSelector(selectShowSidebar);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const { openModal } = useModal();
  const mainDiv = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const defaultSettings = useMemo(() => getDefaultSettings(), []);

  const currentConversationId = useSelector(selectCurrentConversationId);
  const lockConversation = useSelector(selectLockConversation);

  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();

  const [localState, setLocalState] = useState(() => getDefaultConversation());

  useSyncConversation({
    localState,
    setLocalState,
    conversationId,
  });

  // Responsive breakpoints - aligned with Tailwind config
  const isMobile = windowWidth < 801;
  const isTablet = windowWidth >= 801 && windowWidth < 1281;
  const isDesktop = windowWidth >= 1281;

  // Determine if sidebar should be shown based on screen size
  const shouldShowSidebar = isDesktop && showSidebar;
  const shouldShowMobileSidebar = !isDesktop && showSidebar;

  const handleNewChat = useCallback(async () => {
    dispatch({ type: "conversations/setLockConversation", payload: true });
    const newId = await createConversation(getDefaultConversation());
    if (newId) {
      persistor.flush().then(() => {
        navigate(`/chat/${newId}`);
        if (!isDesktop) {
          dispatch(toggleSidebar());
        }
      });
    }
  }, [dispatch, navigate, isDesktop]);

  const isIntentionalRefresh = useRef(false);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F5" || (e.ctrlKey && e.key === "r")) {
        if (selectedFiles.length > 0) {
          e.preventDefault();
          openModal("unsentFiles");
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

  const toggleFooter = useCallback(() => {
    setShowFooter((prev) => {
      const newState = !prev;
      setTimeout(newState ? scrollToTop : scrollToBottom, 0);
      return newState;
    });
  }, [scrollToTop, scrollToBottom]);

  // Handle resize with proper responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      setWindowWidth(newWidth);
    };

    handleResize(); // Call on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [dispatch]); // Removed showSettings, showSidebar dependencies

  const isDarkMode = useSelector(selectDarkMode);
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Calculate sidebar width for smoother animations
  const sidebarWidth = shouldShowSidebar ? "280px" : "56px";

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-black">
      <Header
        localState={localState}
        setLocalState={setLocalState}
        modelsData={modelsData}
        userData={userData}
      />

      <div className="flex flex-1  overflow-hidden relative bg-bg_light dark:bg-bg_dark ">
        {/* Desktop Sidebar Container with smooth width transitions */}
        {isDesktop && (
        <div
        className={`relative flex-shrink-0 h-full transition-all duration-300 ease-in-out overflow-hidden
          ${shouldShowSidebar ? "w-62" : "w-14"}`}
        >
        {/* Full Sidebar */}
        <div
          className={`absolute inset-0 transition-all duration-300 ease-in-out pb-1 pt-1
            ${shouldShowSidebar ? "opacity-100" : "opacity-0 pointer-events-none"}
            ${shouldShowSidebar ? "w-65" : "w-14"}`}
        >
          <Sidebar
            localState={localState}
            setLocalState={setLocalState}
            onClose={() => dispatch(toggleSidebar())}
            handleNewChat={handleNewChat}
          />
        </div>

        {/* Collapsed Sidebar */}
        <div
          className={`absolute inset-0 transition-all duration-300 ease-in-out pb-1 pt-1
            ${shouldShowSidebar ? "opacity-0 pointer-events-none" : "opacity-100"}
            ${shouldShowSidebar ? "w-65" : "w-14"}`}
        >
          <CollapsedSidebar
            onToggleSidebar={() => dispatch(toggleSidebar())}
            onNewChat={handleNewChat}
            onEditTitle={() => {
              openModal("renameConversation", {
                id: currentConversationId,
                currentTitle: localState?.title || "Untitled Conversation",
              });
            }}
            currentTitle={localState?.title || "Untitled Conversation"}
            lockConversation={lockConversation}
          />
        </div>
      </div>)}

        {/* Mobile/Tablet Sidebar Overlay */}
        <Transition show={shouldShowMobileSidebar} as={Fragment}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity duration-300 ease-out"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-200 ease-in"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div
              className="desktop:hidden fixed inset-0 bg-white/30 dark:bg-black/20 backdrop-blur-sm z-20"
              onClick={() => dispatch(toggleSidebar())}
            />
          </Transition.Child>

          <Transition.Child
            as={Fragment}
            enter="transition-transform duration-300 ease-out"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition-transform duration-200 ease-in"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <div className="desktop:hidden absolute h-full z-[992]">
              <div className="h-full w-64 shadow-2xl">
                <Sidebar
                  localState={localState}
                  setLocalState={setLocalState}
                  onClose={() => dispatch(toggleSidebar())}
                  handleNewChat={handleNewChat}
                />
              </div>
            </div>
          </Transition.Child>
        </Transition>

        {/* Main Content Area with smooth transitions */}
        <div
          className="flex flex-1 min-w-0 transition-all duration-300 ease-in-out"
          style={{
            marginRight: isDesktop && showSettings ? "30%" : "0",
          }}
        >
          {/* Chat Area */}
          <div className="flex flex-col flex-1 min-w-0">
            <div
              ref={mainDiv}
              className={`flex-1 overflow-y-auto bg-bg_light dark:bg-bg_dark desktop:rounded-2xl overscroll-behavior-contain ${
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
              {!showSettings && (
                <WarningButton localState={localState} userData={userData} />
              )}

              {/* Chat Container with responsive width calculations */}
              <div
                className={`mx-auto h-full flex flex-col gap-2 sm:justify-between relative p-1 ${(() => {
                  if (isMobile || isTablet) {
                    return "w-full";
                  } else if (showSettings) {
                    return "w-full";
                  } else {
                    return "w-full max-w-[80%]";
                  }
                })()}`}
              >
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col relative w-full border border-gray-200 dark:border-gray-800 rounded-2xl shadow-md dark:shadow-dark bg-white dark:bg-bg_secondary_dark">
                  <HallucinationWarning />
                  <Conversation
                    localState={localState}
                    setLocalState={setLocalState}
                  />
                </div>

                <Prompt
                  localState={localState}
                  setLocalState={setLocalState}
                  userData={userData}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Settings Panel with improved animations */}
        <Transition
          show={isDesktop && showSettings}
          as={Fragment}
          enter="transition-all duration-300 ease-in-out"
          enterFrom="w-0 opacity-0 translate-x-full"
          enterTo="w-[30%] opacity-100 translate-x-0"
          leave="transition-all duration-300 ease-in-out"
          leaveFrom="w-[30%] opacity-100 translate-x-0"
          leaveTo="w-0 opacity-0 translate-x-full"
        >
          <div
            className="hidden desktop:block flex-shrink-0 overflow-hidden p-1 absolute right-0 top-0 bottom-0 z-10"
            style={{ width: "30%" }}
          >
            <SettingsPanel
              localState={localState}
              setLocalState={setLocalState}
              modelsData={modelsData}
              userData={userData}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
            />
          </div>
        </Transition>

        {/* Mobile/Tablet Settings Panel - Bottom overlay */}
        <Transition
          show={!isDesktop && showSettings}
          as={Fragment}
          enter="transition-transform duration-300 ease-in-out"
          enterFrom="translate-y-full"
          enterTo="translate-y-0"
          leave="transition-transform duration-300 ease-in-out"
          leaveFrom="translate-y-0"
          leaveTo="translate-y-full"
        >
          <div className="desktop:hidden fixed bottom-0 left-0 right-0 z-40">
            <div className="bg-white dark:bg-bg_secondary_dark rounded-t-2xl shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[70vh] overflow-y-auto">
              <SettingsPanel
                localState={localState}
                setLocalState={setLocalState}
                modelsData={modelsData}
                userData={userData}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
              />
            </div>
          </div>
        </Transition>
      </div>

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
