import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import Sidebar from "./Sidebar";
import ChatWindow from "../Chat/ChatWindow";
import footer_arrow from "../../assets/footer_arrow.svg";
import Clear_Cache_Model from "../../model/Clear_Cache_Model";
import store, { persistor } from "../../Redux/store/store";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../hooks/useToast";
import ConfirmationPopup from "../../model/ConfirmationPopup";
import {
  addConversation,
  deleteConversation,
  selectConversations,
  selectCurrentConversationId,
  updateConversation,
  selectCurrentConversation,
} from "../../Redux/reducers/conversationsSlice";
import { getModels } from "../../apis/ModelLIst";
import Offline_Model_Model from "../../model/Offline_Model_Model";

function Layout() {
  const [showFooter, setShowFooter] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCacheModel, setShowCacheModel] = useState(false);
  const [showModelOffline, setShowModelOffline] = useState(false);

  const mainDiv = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useToast();

  // Conversation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState(null);
  const conversations = useSelector(selectConversations);
  const currentConversationId = useSelector(selectCurrentConversationId);
  const currentConversation = useSelector(selectCurrentConversation);
  const [conversationIds, setConversationIds] = useState([]);

  // Model states
  const [modelList, setModelList] = useState([]);
  const [modelSettings, setModelSettings] = useState({
    model: currentConversation?.settings?.model || "",
    model_api: currentConversation?.settings?.model_api || "",
  });

  // Initialize conversation IDs
  useEffect(() => {
    setConversationIds(conversations.map((conv) => conv.id));
  }, [conversations]);

  // Fetch models and initialize model settings
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const data = await getModels();
        setModelList(data);
      } catch (error) {
        notifyError("Error fetching models:", error);
      }
    };

    fetchModels();
    const interval = setInterval(fetchModels, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update model settings when conversation changes
  useEffect(() => {
    if (currentConversation?.settings) {
      setModelSettings({
        model: currentConversation.settings.model,
        model_api: currentConversation.settings.model_api,
      });
    }
  }, [currentConversation]);

  useEffect(() => {
    const currentModel = modelList.find(
      (modelX) => modelX.name === modelSettings.model
    );
    if (currentModel?.status === "offline") {
      setShowModelOffline(true);
    }
  }, [modelSettings.model, modelList]);

  // Handle model change
  const handleModelChange = useCallback(
    (model, modelApi) => {
      if (!model || !modelApi) return;

      setModelSettings({
        model,
        model_api: modelApi,
      });

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

  // Conversation management functions
  const handleDeleteConversation = (id) => {
    setDeletingConversationId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = useCallback(() => {
    const id = deletingConversationId;
    const isLastConversation = conversations.length === 1;
    const isDeletingCurrent = id === currentConversationId;

    if (isLastConversation || isDeletingCurrent) {
      const newAction = dispatch(addConversation());
      const newId = newAction.payload?.id;

      if (newId) {
        setConversationIds((prev) => [
          newId,
          ...prev.filter((convId) => convId !== id),
        ]);
        navigate(`/chat/${newId}`);
        setTimeout(() => {
          dispatch(deleteConversation(id));
        }, 0);
      }
    } else {
      setConversationIds((prev) => prev.filter((convId) => convId !== id));
      dispatch(deleteConversation(id));
    }

    setShowDeleteConfirm(false);
    setDeletingConversationId(null);
  }, [
    dispatch,
    navigate,
    conversations.length,
    currentConversationId,
    deletingConversationId,
  ]);

  // Scroll handlers
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

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth >= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Clear cache handler
  const clearCache = async () => {
    try {
      await persistor.purge();
      dispatch({ type: "RESET_ALL" });
      notifySuccess("Chats cleared successfully");
      const state = store.getState();
      const newId = state.conversations.currentConversationId;

      if (newId) {
        window.history.replaceState(null, "", `/chat/${newId}`);
        navigate(`/chat/${newId}`, { replace: true });
      }

      setShowCacheModel(false);
    } catch (error) {
      notifyError("Failed to clear chats: " + error.message);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-black">
      {/* Header - Full width */}
      <Header
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        modelSettings={modelSettings}
        modelList={modelList}
        onModelChange={handleModelChange}
      />

      {/* Content Container */}
      <div className="flex flex-1 overflow-hidden relative bg-bg_light dark:bg-bg_dark">
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`
            ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
            md:translate-x-0 transition-transform duration-200 ease-in-out
            fixed md:relative w-72 md:h-full h-screen z-30 md:z-auto shrink-0 md:p-2 bg-bg_light dark:bg-bg_dark`}
        >
          <Sidebar
            onClose={() => setIsSidebarOpen(false)}
            setShowCacheModel={setShowCacheModel}
            onDeleteConversation={handleDeleteConversation}
            conversationIds={conversationIds}
          />
        </div>

        {/* Mobile Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="md:hidden fixed bottom-4 left-4 z-20 bg-tertiary hover:bg-tertiary_hover active:bg-tertiary_pressed text-white p-3 rounded-full shadow-lg"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>

        {/* Main Content */}
        <div className="flex flex-col flex-1 w-full overflow-hidden">
          {/* Main scrollable area */}
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

      {/* Footer toggle and Footer */}
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
      {/* Pop-up clear cache*/}
      <div className="">
        {showCacheModel ? (
          <Clear_Cache_Model
            showModal={setShowCacheModel}
            clearCache={clearCache}
          />
        ) : null}
      </div>
      {showDeleteConfirm && (
        <ConfirmationPopup
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
        />
      )}
      {showModelOffline ? (
        <Offline_Model_Model
          showModal={setShowModelOffline}
          model={modelSettings.model_api}
        />
      ) : null}
    </div>
  );
}

export default Layout;
