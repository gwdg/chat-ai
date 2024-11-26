import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  addConversation,
  setCurrentConversation,
  selectConversations,
  selectCurrentConversationId,
} from "../../Redux/reducers/conversationsSlice";
import { useCallback } from "react";
import cross from "../../assets/cross.svg";
import back_arrow from "../../assets/back_arrow.svg";

function Sidebar({ onClose, onDeleteConversation, conversationIds }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const conversations = useSelector(selectConversations);
  const currentConversationId = useSelector(selectCurrentConversationId);

  const handleNewChat = useCallback(() => {
    const action = dispatch(addConversation());
    const newId = action.payload?.id;
    if (newId) {
      navigate(`/chat/${newId}`);
      onClose?.();
    }
  }, [dispatch, navigate, onClose]);

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
      <div className="md:hidden flex items-center justify-between p-4 border-b dark:border-border_dark">
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

      <div className="flex-shrink-0 p-2 border-b dark:border-border_dark">
        <button
          onClick={handleNewChat}
          className="w-full bg-bg_light dark:bg-bg_dark hover:bg-light_hover dark:hover:bg-dark_hover active:bg-tertiary_pressed text-black dark:text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"
        >
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            {conversationIds.map((id) => {
              const conv = conversations.find((c) => c.id === id);
              if (!conv) return null;

              return (
                <div
                  key={id}
                  onClick={() => handleSelectConversation(id)}
                  className={`group p-3 rounded-lg cursor-pointer transition-all relative ${
                    id === currentConversationId
                      ? "bg-bg_light/80 dark:bg-bg_dark/80 text-black dark:text-white"
                      : "hover:bg-bg_light/50 dark:hover:bg-white/5 text-black dark:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 truncate mr-2" title={conv.title}>
                      {conv.title || "New Chat"}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(id);
                      }}
                      className="md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity"
                    >
                      <img src={cross} alt="delete" className="w-5 h-5" />
                    </button>
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
