import { useCallback, useEffect, useRef, useState } from "react";

import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import Chat from "../components/Chat/Chat";
import { useToast } from "../hooks/useToast";
import { getModelsData } from "../apis/getModelsData";
import { getUserData } from "../apis/getUserData";
import { useModal } from "../modals/ModalContext";
import { useSelector, useDispatch } from "react-redux";
import { selectCurrentConversation, updateConversation } from "../Redux/reducers/conversationsSlice";
import { setCurrentConversation } from "../Redux/reducers/currentConversationSlice";
import { selectDarkMode } from "../Redux/reducers/interfaceSettingsSlice";
import { toggleSidebar } from "../Redux/reducers/interfaceSettingsSlice";

// Main layout component that manages the overall structure and state of the chat application
function ChatPage() {
  const { openModal } = useModal();
  // UI state management
  const [showFooter, setShowFooter] = useState(false);
  const [userData, setUserData] = useState(null);

  // Refs and hooks initialization
  const mainDiv = useRef(null);
  const { notifyError } = useToast();
  const dispatch = useDispatch();

  // Initialize chat state
  const [localState, setLocalState] = useState({
    title: "",
    prompt: "",
    responses: [],
    messages: [],
    settings: {
      model: {id: "", name: ""},
      temperature: 0.5,
      top_p: 0.5,
      system_prompt: "You are a helpful assistant.",
      memory: 2,
      enable_tools: true,
      arcana: {id: ""},
    }
  });

  // Model configuration state
  const [modelsData, setModelsData] = useState([]);

  // Fetch user profile data on component mount
  const updateUserData = useCallback(async () => {
    try {
      const data = await getUserData();
      setUserData(data);
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
  }, []);

  useEffect(() => {
    updateUserData();
  }, [updateUserData]);

  // Initialize and periodically update available models
  useEffect(() => {
    const updateModelsData = async () => {
      try {
        const data = await getModelsData();
        if (data === '401') {
          openModal("errorSessionExpired");
        }
        // TODO find current model to check offline
        // if (model?.status === "offline") {
        //     openModal("serviceOffline")
        // }
        setModelsData(data);
      } catch (error) {
        notifyError("Error fetching models");
      }
    };
    updateModelsData();
    const interval = setInterval(updateModelsData, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [notifyError]);

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
  const timeoutId = useRef();

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

  const currentConversationId = useSelector((state) => state.current_conversation);
  const currentConversation = useSelector(selectCurrentConversation);
  // Effect 1: Initializes local state when conversation ID or current conversation changes
  useEffect(() => {
    // Only proceed if both conversationId and currentConversation exist
    if (currentConversationId && currentConversation) {
      // Update the current conversation in Redux store
      dispatch(setCurrentConversation(currentConversationId));
      // Initialize local state with all conversation data
      setLocalState({
        title: currentConversation.title, // Current title
        prompt: currentConversation.prompt, // Current prompt text
        responses: currentConversation.responses, // Array of AI responses
        messages: currentConversation.messages, // Full conversation history
        settings: { ...currentConversation.settings }, // Chat settings (temperature, etc.)
      });
    }
  }, [currentConversationId, currentConversation, dispatch]);

  // Listen for tab visibility changes
  const [isActive, setIsActive] = useState(false);
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

  // Effect 2: Debounced auto-save of conversation changes
  const delay = 1000;
  useEffect(() => {
    // Only auto-save when tab is active
    if (!isActive) return;
    // Ignore non-changes TODO figure out why this happens
    const changes = Object.entries(localState.settings).reduce((acc, [key, value]) => {
      if (value !== currentConversation.settings[key]) {
        acc[key] = value;
      }
      return acc;
    }, {});
    // console.log("Found change in ... ", changes);
    if (Object.keys(changes).length === 0) return; // No changes to save

    // Clear any scheduled save
    clearTimeout(timeoutId.current);
    // Schedule a save after `delay` ms
    timeoutId.current = setTimeout(() => {
      dispatch(
        updateConversation({
          id: currentConversationId,
          updates: { ...localState }
        })
      );
    }, delay);
  }, [localState, dispatch]);  

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-black">
      {/* Header */}
      <Header
        localState={localState}
        setLocalState={setLocalState} 
        modelsData={modelsData}
        userData={userData}
      />
      
      {/* Main chat content area */}
      <Chat
        localState={localState}
        setLocalState={setLocalState} 
        modelsData={modelsData}
        userData={userData}
        showFooter={showFooter}
        mainDiv={mainDiv}
      />

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
