import { useCallback, useEffect, useRef, useState } from "react";
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

// Main layout component that manages the overall structure and state of the chat application
function Layout() {
  // UI state management
  const [showFooter, setShowFooter] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCacheModal, setShowCacheModal] = useState(false);
  const [showModalOffline, setShowModalOffline] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [userData, setUserData] = useState(null);

  // Refs and hooks initialization
  const mainDiv = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useToast();

  // Conversation state management
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState(null);
  const conversations = useSelector(selectConversations);
  const currentConversationId = useSelector(selectCurrentConversationId);
  const currentConversation = useSelector(selectCurrentConversation);
  const [conversationIds, setConversationIds] = useState([]);
  const [showModalSession, setShowModalSession] = useState(false);

  // Model configuration state
  const [modelList, setModelList] = useState([]);
  const [modelSettings, setModelSettings] = useState({
    model: currentConversation?.settings?.model || "",
    model_api: currentConversation?.settings?.model_api || "",
  });
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingConversationId, setRenamingConversationId] = useState(null);

  // Fetch user profile data on component mount
  const fetchUserData = async () => {
    try {
      const data = await fetchCurrentUserProfile();
      setUserData(data);
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

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
        notifyError("Error fetching models:", error);
      }
    };

    fetchModels();
    const interval = setInterval(fetchModels, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Sync model settings with current conversation
  useEffect(() => {
    if (currentConversation?.settings) {
      setModelSettings({
        model: currentConversation.settings.model,
        model_api: currentConversation.settings.model_api,
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
      if (!model || !modelApi) return;

      setModelSettings({
        model,
        model_api: modelApi,
      });

      // Update conversation settings when model changes
      if (currentConversationId) {
        dispatch(
          updateConversation({
            id: currentConversationId,
            updates: {
              settings: {
                ...currentConversation.settings,
                model,
                model_api: modelApi,
              },
              lastModified: new Date().toISOString(),
            },
          })
        );
      }
    },
    [dispatch, currentConversationId, currentConversation]
  );

  // Conversation deletion handlers
  const handleDeleteConversation = (id) => {
    setDeletingConversationId(id);
    setShowDeleteConfirm(true);
  };

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
          // Create new conversation before deleting the last one
          const newAction = dispatch(addConversation());
          const newId = newAction.payload?.id;
          if (newId) {
            navigate(`/chat/${newId}`);
            setTimeout(() => {
              dispatch(deleteConversation(id));
            }, 0);
          }
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
  const scrollToBottom = () => {
    if (mainDiv.current) {
      mainDiv.current.scrollTop = mainDiv.current.scrollHeight;
    }
  };

  const scrollToTop = () => {
    if (mainDiv.current) {
      mainDiv.current.scrollTop = 0;
    }
  };

  // Responsive sidebar handling
  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth > 1080);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Clear application cache and reset state
  const clearCache = async () => {
    try {
      await persistor.purge();
      dispatch({ type: "RESET_ALL" });
      notifySuccess("Chats cleared successfully");

      // Navigate to new conversation after cache clear
      const state = store.getState();
      const newId = state.conversations.currentConversationId;

      if (newId) {
        window.history.replaceState(null, "", `/chat/${newId}`);
        navigate(`/chat/${newId}`, { replace: true });
      }

      setShowCacheModal(false);
      setShowSettingsModal(false);
    } catch (error) {
      notifyError("Failed to clear chats: " + error.message);
    }
  };

  // Handle conversation rename
  const handleRenameConversation = (id) => {
    setRenamingConversationId(id);
    setShowRenameModal(true);
  };

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
            />
          </div>
        </div>
      </div>

      {/* Footer section with toggle */}
      <div className="w-full bg-bg_light dark:bg-bg_dark">
        {!showFooter && (
          <div className="flex justify-center items-center h-[22px] py-2">
            <img
              onClick={() => {
                setShowFooter(!showFooter);
                setTimeout(showFooter ? scrollToTop : scrollToBottom, 0);
              }}
              className={`cursor-pointer h-[15px] w-[55px] ${
                !showFooter ? "rotate-180" : ""
              }`}
              src={footer_arrow}
              alt={showFooter ? "Hide footer" : "Show footer"}
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

      {/* Modal components */}
      <div className="">
        {showCacheModal ? (
          <ClearCacheModal
            showModal={setShowCacheModal}
            clearCache={clearCache}
          />
        ) : null}
      </div>
      {showDeleteConfirm && (
        <ConfirmationModal
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
        />
      )}
      {showModalOffline ? (
        <OfflineModelInfoModal
          showModal={setShowModalOffline}
          model={modelSettings.model_api}
        />
      ) : null}
      {showSettingsModal ? (
        <SettingsModal
          showModal={setShowSettingsModal}
          setShowCacheModal={setShowCacheModal}
          userData={userData}
        />
      ) : null}
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
      {showModalSession ? (
        <SessionExpiredModal showModal={setShowModalSession} />
      ) : null}
    </div>
  );
}

export default Layout;
