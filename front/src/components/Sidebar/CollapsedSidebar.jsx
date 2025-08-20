import { ChevronRight, Edit, Plus } from "lucide-react";

function CollapsedSidebar({
  onToggleSidebar,
  onNewChat,
  onEditTitle,
  currentTitle,
  lockConversation = false,
}) {
  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-bg_secondary_dark rounded-xl dark:shadow-dark shadow-lg border border-gray-200 dark:border-gray-800 p-2 gap-3">
      {/* Toggle sidebar open */}
      <button
        onClick={onToggleSidebar}
        disabled={lockConversation}
        className={`cursor-pointer p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all duration-200 flex items-center justify-center ${
          lockConversation ? "cursor-not-allowed opacity-50" : ""
        }`}
        title="Open sidebar"
      >
        <ChevronRight className="w-5 h-5 text-tertiary" />
      </button>

      {/* New chat */}
      <button
        onClick={onNewChat}
        disabled={lockConversation}
        className={`cursor-pointer p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 rounded-2xl transition-all duration-200 flex items-center justify-center ${
          lockConversation ? "cursor-not-allowed opacity-50" : ""
        }`}
        title="New chat"
      >
        <Plus className="w-5 h-5 text-tertiary" />
      </button>

      {/* Edit current conversation */}
      <button
        onClick={onEditTitle}
        disabled={lockConversation}
        className={`cursor-pointer p-2.5 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center ${
          lockConversation ? "cursor-not-allowed opacity-50" : ""
        }`}
        title={`Edit: ${currentTitle}`}
      >
        <Edit className="w-5 h-5 text-tertiary" />
      </button>
    </div>
  );
}

export default CollapsedSidebar;
