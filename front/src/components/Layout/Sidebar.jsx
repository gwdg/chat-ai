/**
 * Sidebar Component
 * Provides conversation management interface including:
 * - Creating new conversations
 * - Listing existing conversations
 * - Selecting conversations
 * - Renaming and deleting conversations
 */

// Redux and routing imports
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  addConversation,
  setCurrentConversation,
  selectConversations,
  selectCurrentConversationId,
} from "../../Redux/reducers/conversationsSlice";
import { useCallback } from "react";

// Asset imports
import cross from "../../assets/cross.svg";
import edit_icon from "../../assets/edit_icon.svg";
import back_arrow from "../../assets/back_arrow.svg";

function Sidebar({
  onClose,
  onDeleteConversation,
  onRenameConversation,
  conversationIds,
}) {
  // Redux and routing hooks
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux selectors for conversation state
  const conversations = useSelector(selectConversations);
  const currentConversationId = useSelector(selectCurrentConversationId);

  /**
   * Creates a new conversation and navigates to it
   * Includes a page refresh to ensure clean state
   */
  const handleNewChat = useCallback(() => {
    const action = dispatch(addConversation());
    const newId = action.payload?.id;
    if (newId) {
      navigate(`/chat/${newId}`);
      onClose?.();
      // Add a slight delay before refreshing to ensure navigation completes
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  }, [dispatch, navigate, onClose]);

  /**
   * Handles selection of an existing conversation
   * Updates current conversation in Redux and navigates to it
   */
  const handleSelectConversation = useCallback(
    (id) => {
      dispatch(setCurrentConversation(id));
      navigate(`/chat/${id}`);
      onClose?.();
    },
    [dispatch, navigate, onClose]
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-bg_secondary_dark border-r dark:border-border_dark rounded-2xl shadow-lg dark:shadow-dark select-none">
      {/* Mobile Header - Only visible on mobile devices */}
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

      {/* New Chat Button Section */}
      <div className="flex-shrink-0 p-2 border-b dark:border-border_dark">
        <button
          onClick={handleNewChat}
          className="w-full bg-bg_light dark:bg-bg_dark hover:bg-light_hover dark:hover:bg-dark_hover active:bg-tertiary_pressed text-black dark:text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"
        >
          <span>Add New Chat</span>
        </button>
      </div>

      {/* Conversations List Container */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            {/* Map through conversation IDs and render each conversation */}
            {conversationIds.map((id) => {
              const conv = conversations?.find((c) => c.id === id);
              if (!conv) return null;

              return (
                <div
                  key={id}
                  onClick={() => handleSelectConversation(id)}
                  className={`group p-3 rounded-lg cursor-pointer transition-all relative ${
                    id === currentConversationId
                      ? "bg-bg_light/80 dark:bg-bg_dark/80 text-black dark:text-white"
                      : "text-black dark:text-white hover:bg-bg_light/50 dark:hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between relative">
                    {/* Conversation Title with Gradient Overflow Effect */}
                    <div
                      className="flex-1 overflow-hidden relative custom:group-hover:mr-2 transition-all duration-200"
                      title={conv.title}
                    >
                      <div
                        ref={(el) => {
                          if (el) {
                            // Check if title has overflow and set data attribute
                            const hasOverflow = el.scrollWidth > el.clientWidth;
                            el.dataset.hasOverflow = hasOverflow.toString();
                          }
                        }}
                        className={`relative whitespace-nowrap ${
                          id === currentConversationId
                            ? 'truncate group-hover:truncate-none group-hover:[&[data-has-overflow="true"]]:before:absolute group-hover:[&[data-has-overflow="true"]]:before:right-0 group-hover:[&[data-has-overflow="true"]]:before:content-[\'\'] group-hover:[&[data-has-overflow="true"]]:before:w-full group-hover:[&[data-has-overflow="true"]]:before:h-full group-hover:[&[data-has-overflow="true"]]:before:bg-gradient-to-r group-hover:[&[data-has-overflow="true"]]:before:from-transparent group-hover:[&[data-has-overflow="true"]]:before:to-bg_light/90 dark:group-hover:[&[data-has-overflow="true"]]:before:to-bg_dark/90'
                            : "truncate group-hover:truncate-none"
                        } transition-all duration-200`}
                      >
                        {conv.title || "Untitled Conversation"}
                      </div>
                    </div>

                    {/* Action Buttons (Edit and Delete) */}
                    <div className="flex-shrink-0 flex items-center gap-2 custom:opacity-0 custom:group-hover:opacity-100 opacity-100 transition-all duration-200 w-0 custom:group-hover:w-auto">
                      {/* Edit Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRenameConversation(id);
                        }}
                      >
                        <img src={edit_icon} alt="edit" className="w-5 h-5" />
                      </button>
                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(id);
                        }}
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
    </div>
  );
}

export default Sidebar;
