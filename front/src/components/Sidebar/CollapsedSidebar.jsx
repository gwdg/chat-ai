import { ChevronRight, Edit, Plus, Bot } from "lucide-react";
import ImportConversationButton from "../Conversation/ImportConversationButton";
import { useModal } from "../../modals/ModalContext";

function CollapsedSidebar({
  localState,
  onToggleSidebar,
  handleNewConversation,
}) {
  const { openModal } = useModal();

  const handleRenameConversation = () => {
    openModal("renameConversation", {
      id: localState.id,
      currentTitle: localState?.title || "Untitled Conversation",
    });
  };

  return (
    <div className="flex flex-col justify-between w-full h-full bg-white dark:bg-bg_secondary_dark rounded-xl dark:shadow-dark shadow-lg border border-gray-200 dark:border-gray-800 p-2 gap-3">
      <div className="flex flex-col items-center justify-between gap-3">
        {/* Toggle sidebar open */}
        <button
          onClick={onToggleSidebar}
          className={`cursor-pointer p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all duration-200 flex items-center justify-center`}
          title="Open sidebar"
        >
          <ChevronRight className="w-5 h-5 text-tertiary" />
        </button>

        {/* New chat */}
        <button
          onClick={handleNewConversation}
          className={`cursor-pointer p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
          title="New chat"
        >
          <Plus className="w-5 h-5 text-tertiary" />
        </button>

        {/* Rename current conversation */}
        <button
          onClick={handleRenameConversation}
          className={`cursor-pointer p-2.5 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
          title={`Rename: ${localState?.title || "Untitled Conversation"}`}
        >
          <Edit className="w-5 h-5 text-tertiary" />
        </button>
      </div>
      <div className="flex flex-col items-center justify-between gap-3 border-t border-tertiary pt-3">
        {/* Import Conversation button */}
        <ImportConversationButton variant="icon" />

        {/* Import persona from Github */}
        <button
          onClick={() => {
            openModal("importPersona");
          }}
          className={`cursor-pointer p-1 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
          title="Chat with Persona"
        >
          <Bot className="w-6 h-6 text-tertiary" />
        </button>
      </div>
    </div>
  );
}

export default CollapsedSidebar;
