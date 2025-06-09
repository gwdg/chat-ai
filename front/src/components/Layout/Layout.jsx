import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import Header from "./Header";
import Footer from "./Footer";
import Sidebar from "./Sidebar";
import ChatWindow from "../Chat/ChatWindow";
import footer_arrow from "../../assets/footer_arrow.svg";
import ClearCacheModal from "../../modals/ClearCacheModal";
import store, { persistor } from "../../Redux/store/store";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../hooks/useToast";
import ConfirmationModal from "../../modals/ConfirmationModal";
import {
  addConversation,
  deleteConversation,
  selectConversations,
  selectCurrentConversationId,
  updateConversation,
  selectCurrentConversation,
} from "../../Redux/reducers/conversationsSlice";
import { fetchAvailableModels } from "../../apis/ModelListApi";
import OfflineModelInfoModal from "../../modals/OfflineModelInfoModal";
import SettingsModal from "../../modals/SettingsModal";
import { fetchCurrentUserProfile } from "../../apis/GetUserDataApi";
import RenameConversationModal from "../../modals/RenameConversationModal";
import SessionExpiredModal from "../../modals/SessionExpiredModal";
import GitHubRepoModal from "../../modals/GitHubRepoModal";
import { selectDefaultModel } from "../../Redux/reducers/defaultModelSlice";

// Hooks
import { importConversation } from "../../hooks/importConversation";

// Main layout component that manages the overall structure and state of the chat application
function Layout() {
  // UI state management
  const [showFooter, setShowFooter] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCacheModal, setShowCacheModal] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [showClearMemoryModal, setShowClearMemoryModal] = useState(false);
  const [showModalOffline, setShowModalOffline] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showModalSession, setShowModalSession] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingConversationId, setRenamingConversationId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState(null);
  const [showRepoModal, setShowRepoModal] = useState(false);

  // Refs and hooks initialization
  const mainDiv = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useToast();

  // Conversation state management
  const conversations = useSelector(selectConversations);
  const currentConversationId = useSelector(selectCurrentConversationId);
  const currentConversation = useSelector(selectCurrentConversation);
  const [conversationIds, setConversationIds] = useState([]);
  const defaultModel = useSelector(selectDefaultModel);

  // Model configuration state
  const [modelList, setModelList] = useState([]);
  const [modelSettings, setModelSettings] = useState({
    ["model-name"]: "",
    model: "",
  });

  const handleImportPersona = async (parsedData) => {
    return importConversation(
      parsedData,
      dispatch,
      currentConversationId,
      defaultModel,
      notifyError,
      notifySuccess,
      navigate
    );
  };

  const handleImportError = (error) => {
    notifyError(error);
  };

  // Fetch user profile data on component mount
  const fetchUserData = useCallback(async () => {
    try {
      const data = await fetchCurrentUserProfile();
      setUserData(data);
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Keep conversation IDs synchronized with the conversations list
  useEffect(() => {
    setConversationIds(conversations.map((conv) => conv.id));
  }, [conversations]);

  // Initialize and periodically update available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const data = await fetchAvailableModels(setShowModalSession);
        setModelList(data);
      } catch (error) {
        notifyError("Error fetching models");
      }
    };

    fetchModels();
    const interval = setInterval(fetchModels, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [notifyError]);

  // Sync model settings with current conversation
  useEffect(() => {
    if (currentConversation?.settings) {
      setModelSettings({
        ["model-name"]: currentConversation.settings["model-name"],
        model: currentConversation.settings.model,
      });
    }
  }, [currentConversation]);

  // Show offline model warning if selected model is offline
  useEffect(() => {
    const currentModel = modelList?.find(
      (modelX) => modelX.name === modelSettings.model
    );
    if (currentModel?.status === "offline") {
      setShowModalOffline(true);
    }
  }, [modelSettings.model, modelList]);

  // Handle model selection changes
  const handleModelChange = useCallback(
    (model, modelApi) => {
      if (!model || !modelApi || !currentConversationId) return;

      setModelSettings({
        ["model-name"]: model,
        model: modelApi,
      });

      // Update conversation settings when model changes
      dispatch(
        updateConversation({
          id: currentConversationId,
          updates: {
            settings: {
              ...currentConversation.settings,
              ["model-name"]: model,
              model: modelApi,
            },
          },
        })
      );
    },
    [dispatch, currentConversationId, currentConversation]
  );

  // Conversation deletion handlers
  const handleDeleteConversation = useCallback((id) => {
    setDeletingConversationId(id);
    setShowDeleteConfirm(true);
  }, []);

  // Updated confirmDelete function
  const confirmDelete = useCallback(() => {
    const id = deletingConversationId;
    const currentIndex = conversations.findIndex((conv) => conv.id === id);

    if (currentIndex !== -1) {
      if (id === currentConversationId) {
        const isFirstConversation = currentIndex === 0;
        const nextConversationIndex = isFirstConversation
          ? 1
          : currentIndex - 1;

        if (conversations.length === 1) {
          // Create new conversation with a known ID before deleting the last one
          const newConversationId = uuidv4();

          // First create the new conversation to ensure it exists
          dispatch(addConversation(newConversationId));

          // Then navigate to it
          navigate(`/chat/${newConversationId}`);

          // Force persistence to ensure other tabs pick up the change
          persistor.flush().then(() => {
            // Then delete the old conversation
            setTimeout(() => {
              dispatch(deleteConversation(id));
            }, 100);
          });
        } else {
          // Navigate to adjacent conversation before deleting
          const nextConversationId = conversations[nextConversationIndex].id;
          navigate(`/chat/${nextConversationId}`);
          dispatch(deleteConversation(id));
        }
      } else {
        dispatch(deleteConversation(id));
      }
    }

    setShowDeleteConfirm(false);
    setDeletingConversationId(null);
  }, [
    dispatch,
    navigate,
    conversations,
    currentConversationId,
    deletingConversationId,
  ]);

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

  // Responsive sidebar handling
  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth > 1080);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Clear cache and reset the application state
  const clearCache = useCallback(async () => {
    try {
      // Generate a new ID that will be used across all tabs
      const newConversationId = uuidv4();

      // Save the current state BEFORE purging (this is crucial)
      const currentState = store.getState();
      const currentTheme = currentState.theme;
      const currentAdvOption = currentState.advOption;
      const currentDefaultModel = currentState.defaultModel; // Get BEFORE purge

      await persistor.purge();

      // Dispatch RESET_ALL with all preserved states
      dispatch({
        type: "RESET_ALL",
        payload: {
          newConversationId,
          theme: currentTheme,
          advOption: currentAdvOption,
          defaultModel: currentDefaultModel, // Pass the saved default model
        },
        meta: {
          sync: true,
        },
      });

      // Create the new conversation with the correct default model settings
      dispatch({
        type: "conversations/resetStore",
        payload: {
          id: newConversationId,
          title: "Untitled Conversation",
          conversation: [
            {
              role: "system",
              content: "You are a helpful assistant",
            },
          ],
          responses: [],
          prompt: "",
          settings: {
            ["model-name"]:
              currentDefaultModel?.name ||
              import.meta.env.VITE_DEFAULT_MODEL_NAME ||
              "Meta Llama 3.1 8B Instruct",
            model:
              currentDefaultModel?.id ||
              import.meta.env.VITE_DEFAULT_MODEL ||
              "meta-llama-3.1-8b-instruct",
            systemPrompt: "You are a helpful assistant",
            temperature: 0.5,
            top_p: 0.5,
            memory: 0,
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
            // key: "",
          },
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        meta: { id: newConversationId, sync: true },
      });

      notifySuccess("Chats cleared successfully");

      // Navigate to new conversation after cache clear
      if (newConversationId) {
        window.history.replaceState(null, "", `/chat/${newConversationId}`);
        navigate(`/chat/${newConversationId}`, { replace: true });
      }

      setShowCacheModal(false);
      setShowSettingsModal(false);
    } catch (error) {
      notifyError("Failed to clear chats: " + error.message);
    }
  }, [dispatch, navigate, notifySuccess, notifyError]);

  // Handle conversation rename
  const handleRenameConversation = useCallback((id) => {
    setRenamingConversationId(id);
    setShowRenameModal(true);
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
    <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-black">
      <Header
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        modelSettings={modelSettings}
        modelList={modelList}
        onModelChange={handleModelChange}
        setShowSettingsModal={setShowSettingsModal}
        userData={userData}
      />
      <div className="flex flex-1 overflow-hidden relative bg-bg_light dark:bg-bg_dark">
        {/* Mobile overlay backdrop */}
        {isSidebarOpen && (
          <div
            className="custom:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Collapsible sidebar with conversation list */}
        <div
          className={`
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          custom:translate-x-0 transition-transform duration-200 ease-in-out
          fixed custom:relative w-72 custom:h-full h-screen z-30 custom:z-auto shrink-0 custom:p-2 bg-bg_light dark:bg-bg_dark`}
        >
          <Sidebar
            onClose={() => setIsSidebarOpen(false)}
            onDeleteConversation={handleDeleteConversation}
            onRenameConversation={handleRenameConversation}
            conversationIds={conversationIds}
            setShowRepoModal={setShowRepoModal}
          />
        </div>

        {/* Main chat content area */}
        <div className="flex flex-col flex-1 w-full overflow-hidden">
          <div
            ref={mainDiv}
            className={`flex-1 overflow-y-auto bg-bg_light dark:bg-bg_dark ${
              showFooter ? "h-[calc(89vh-120px)]" : "h-[calc(100vh-142px)]"
            }`}
          >
            <ChatWindow
              modelSettings={modelSettings}
              modelList={modelList}
              onModelChange={handleModelChange}
              setShowClearMemoryModal={setShowClearMemoryModal}
              showClearMemoryModal={showClearMemoryModal}
              showMemoryModal={showMemoryModal}
              setShowMemoryModal={setShowMemoryModal}
            />
          </div>
        </div>
      </div>

      {/* Footer section with toggle */}
      <div className="w-full bg-bg_light dark:bg-bg_dark">
        {!showFooter && (
          <div className="flex justify-center items-center h-[22px] py-2">
            <img
              onClick={toggleFooter}
              className="cursor-pointer h-[15px] w-[55px] rotate-180"
              src={footer_arrow}
              alt="Show footer"
            />
          </div>
        )}

        {showFooter && (
          <Footer
            showFooter={showFooter}
            setShowFooter={setShowFooter}
            scrollToTop={scrollToTop}
          />
        )}
      </div>

      {/* Modal components - render only when needed */}
      {showCacheModal && (
        <ClearCacheModal
          showModal={setShowCacheModal}
          clearCache={clearCache}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmationModal
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
        />
      )}

      {showModalOffline && (
        <OfflineModelInfoModal
          showModal={setShowModalOffline}
          model={modelSettings["model-name"]}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          showModal={setShowSettingsModal}
          setShowCacheModal={setShowCacheModal}
          userData={userData}
          modelList={modelList}
          setShowMemoryModal={setShowMemoryModal}
        />
      )}

      {showRenameModal && (
        <RenameConversationModal
          showModal={setShowRenameModal}
          conversationId={renamingConversationId}
          currentTitle={
            conversations?.find((conv) => conv.id === renamingConversationId)
              ?.title || ""
          }
          onClose={() => {
            setShowRenameModal(false);
            setRenamingConversationId(null);
          }}
        />
      )}

      {showModalSession && (
        <SessionExpiredModal showModal={setShowModalSession} />
      )}

      {showRepoModal && (
        <GitHubRepoModal
          showModal={setShowRepoModal}
          repoOwner="gwdg"
          repoName="chat-ai-personas"
          branch="main"
          onPersonaImport={handleImportPersona} // New prop for handling persona import
          onError={handleImportError} // New prop for handling errors
        />
      )}
    </div>
  );
}

export default Layout;
