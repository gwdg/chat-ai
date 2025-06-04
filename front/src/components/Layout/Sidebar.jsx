import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import {
  addConversation,
  setCurrentConversation,
  selectConversations,
  selectCurrentConversationId,
  selectIsResponding,
} from "../../Redux/reducers/conversationsSlice";
import { selectDefaultModel } from "../../Redux/reducers/defaultModelSlice";
import { useCallback, useEffect } from "react";

// Asset imports
import cross from "../../assets/cross.svg";
import edit_icon from "../../assets/edit_icon.svg";
import back_arrow from "../../assets/back_arrow.svg";
import { persistor } from "../../Redux/store/store";

function Sidebar({
  onClose,
  onDeleteConversation,
  onRenameConversation,
  conversationIds,
  setShowRepoModal,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const conversations = useSelector(selectConversations);
  const currentConversationId = useSelector(selectCurrentConversationId);
  const isResponding = useSelector(selectIsResponding);
  const defaultModel = useSelector(selectDefaultModel);

  // Ensure the current conversation ID is synced with the URL
  useEffect(() => {
    const urlPath = window.location.pathname;
    const pathMatch = urlPath.match(/\/chat\/([^/]+)/);

    if (pathMatch && pathMatch[1] && pathMatch[1] !== currentConversationId) {
      // If URL contains a conversation ID that doesn't match current selection
      const urlConversationId = pathMatch[1];
      if (conversations.some((conv) => conv.id === urlConversationId)) {
        dispatch(setCurrentConversation(urlConversationId));
      }
    }
  }, [currentConversationId, conversations, dispatch]);

  const handleNewChat = useCallback(() => {
    if (isResponding) return; // Prevent new chat while responding

    // Temporarily disable interaction
    dispatch({ type: "conversations/setIsResponding", payload: true });

    // Add the conversation with the current default model
    const action = dispatch(addConversation());
    const newId = action.meta?.id;

    if (newId) {
      // Update the conversation with the current default model
      dispatch({
        type: "conversations/updateConversation",
        payload: {
          id: newId,
          updates: {
            settings: {
              ["model-name"]: defaultModel.name,
              model: defaultModel.id,
              temperature: 0.5,
              top_p: 0.5,
              systemPrompt: "You are a helpful assistant",
            },
          },
        },
      });

      // Force persistence to localStorage BEFORE navigation
      persistor.flush().then(() => {
        // Navigate to the new conversation
        navigate(`/chat/${newId}`);
        onClose?.();

        // Re-enable interaction after navigation
        setTimeout(() => {
          dispatch({ type: "conversations/setIsResponding", payload: false });
        }, 300);
      });
    } else {
      // If no ID was created (unlikely), still re-enable interaction
      dispatch({ type: "conversations/setIsResponding", payload: false });
    }
  }, [dispatch, navigate, onClose, isResponding, defaultModel]);

  const handleSelectConversation = useCallback(
    (id) => {
      if (isResponding || id === currentConversationId) return;

      dispatch(setCurrentConversation(id));
      navigate(`/chat/${id}`);
      onClose?.();
    },
    [dispatch, navigate, onClose, isResponding, currentConversationId]
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-bg_secondary_dark border-r dark:border-border_dark rounded-2xl shadow-lg dark:shadow-dark select-none">
      {/* Mobile Header */}
      <div className="custom:hidden flex items-center justify-between p-4 border-b dark:border-border_dark">
        <p className="text-lg font-medium text-black dark:text-white">
          Conversations
        </p>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        >
          <img src={back_arrow} alt="close" className="h-5 w-5" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="flex-shrink-0 p-2 border-b dark:border-border_dark">
        <button
          onClick={handleNewChat}
          disabled={isResponding}
          className={`w-full bg-bg_light dark:bg-bg_dark hover:bg-light_hover dark:hover:bg-dark_hover active:bg-tertiary_pressed text-black dark:text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 ${
            isResponding ? "cursor-not-allowed opacity-50" : ""
          }`}
        >
          <span><Trans i18nKey="description.newConversation" /></span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            {conversationIds.map((id) => {
              const conv = conversations?.find((c) => c.id === id);
              if (!conv) return null;

              // Determine if this is the current conversation
              const isCurrentConversation = id === currentConversationId;

              return (
                <div
                  key={id}
                  onClick={() => handleSelectConversation(id)}
                  className={`group p-3 rounded-lg transition-all relative ${
                    isResponding ? "cursor-not-allowed" : "cursor-pointer"
                  } ${
                    isCurrentConversation
                      ? "bg-bg_light/80 dark:bg-bg_dark/80 text-black dark:text-white"
                      : "text-black dark:text-white hover:bg-bg_light/50 dark:hover:bg-white/5"
                  }`}
                  data-current={isCurrentConversation ? "true" : "false"}
                >
                  <div className="flex items-center justify-between relative">
                    {/* Title with gradient overflow */}
                    <div
                      className="flex-1 overflow-hidden relative custom:group-hover:mr-2 transition-all duration-200"
                      title={conv.title}
                    >
                      <div
                        ref={(el) => {
                          if (el) {
                            const hasOverflow = el.scrollWidth > el.clientWidth;
                            el.dataset.hasOverflow = hasOverflow.toString();
                          }
                        }}
                        className={`relative whitespace-nowrap ${
                          isCurrentConversation
                            ? 'truncate group-hover:truncate-none group-hover:[&[data-has-overflow="true"]]:before:absolute group-hover:[&[data-has-overflow="true"]]:before:right-0 group-hover:[&[data-has-overflow="true"]]:before:content-[\'\'] group-hover:[&[data-has-overflow="true"]]:before:w-full group-hover:[&[data-has-overflow="true"]]:before:h-full group-hover:[&[data-has-overflow="true"]]:before:bg-gradient-to-r group-hover:[&[data-has-overflow="true"]]:before:from-transparent group-hover:[&[data-has-overflow="true"]]:before:to-bg_light/90 dark:group-hover:[&[data-has-overflow="true"]]:before:to-bg_dark/90'
                            : "truncate group-hover:truncate-none"
                        } transition-all duration-200`}
                      >
                        {conv.title || "Untitled Conversation"}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex-shrink-0 flex items-center gap-2 custom:opacity-0 custom:group-hover:opacity-100 opacity-100 transition-all duration-200 w-0 custom:group-hover:w-auto">
                      <button
                        onClick={(e) => {
                          if (isResponding) return;
                          e.stopPropagation();
                          onRenameConversation(id);
                        }}
                        disabled={isResponding}
                        className={isResponding ? "cursor-not-allowed" : ""}
                      >
                        <img src={edit_icon} alt="edit" className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          if (isResponding) return;
                          e.stopPropagation();
                          onDeleteConversation(id);
                        }}
                        disabled={isResponding}
                        className={isResponding ? "cursor-not-allowed" : ""}
                      >
                        <img src={cross} alt="delete" className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Persona button */}
      <div className="flex-shrink-0 p-2 border-b dark:border-border_dark">
        <button
          onClick={() => {
            setShowRepoModal(true);
          }}
          disabled={isResponding}
          className={`w-full bg-bg_light dark:bg-bg_dark hover:bg-light_hover dark:hover:bg-dark_hover active:bg-tertiary_pressed text-black dark:text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 ${
            isResponding ? "cursor-not-allowed opacity-50" : ""
          }`}
        >
          <span><Trans i18nKey="description.importPersona" /></span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
