import { useCallback, useEffect, useRef, useState } from "react";

import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import Chat from "../components/Chat/Chat";
import { useToast } from "../hooks/useToast";
import { getModelsData } from "../apis/getModelsData";
import { getUserData } from "../apis/getUserData";
import { useModal } from "../modals/ModalContext";

// Main layout component that manages the overall structure and state of the chat application
function ChatPage() {
  const { openModal } = useModal();
  // UI state management
  const [showFooter, setShowFooter] = useState(false);
  const [userData, setUserData] = useState(null);

  // Refs and hooks initialization
  const mainDiv = useRef(null);
  const { notifyError } = useToast();

  // Initialize chat state
  const [localState, setLocalState] = useState({
    title: "",
    prompt: "",
    responses: [],
    messages: [],
    settings: {
      model: {id: "", name: ""},
      temperature: null,
      top_p: null,
      systemPrompt: "",
      memory: 2,
    },
    exportOptions: {
      exportSettings: false,
      exportImage: false,
      exportArcana: false,
    },
    dontShow: {
      dontShowAgain: false,
      dontShowAgainShare: false,
      dontShowAgainMemory: false,
    },
    arcana: {
      id: "",
    },
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
