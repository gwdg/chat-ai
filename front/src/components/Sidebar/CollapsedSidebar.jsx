import { ChevronRight, Edit, Plus, Bot } from "lucide-react";
import ImportConversationButton from "./ImportConversationButton";
import { useModal } from "../../modals/ModalContext";
import { useTranslation } from "react-i18next";
import ShortcutTooltip from "./ShortcutTooltip";

function CollapsedSidebar({
  localState,
  onToggleSidebar,
  handleNewConversation,
}) {
  const { openModal } = useModal();
  const { t } = useTranslation();
  const currentTitle = localState?.title || "Untitled Conversation";
  const newConversationLabel = t("sidebar.new_conversation");
  const newConversationShortcut = t("sidebar.shortcut_new_conversation");
  const newConversationAria = `${newConversationLabel} ${newConversationShortcut}`;

  const handleRenameConversation = () => {
    openModal("renameConversation", {
      id: localState.id,
      currentTitle,
    });
  };

  return (
    <div className="flex flex-col justify-between w-full h-full bg-white dark:bg-bg_secondary_dark rounded-xl dark:shadow-dark shadow-lg border border-gray-200 dark:border-gray-800 p-2 gap-3">
      <div className="flex flex-col items-center justify-between gap-3">
        {/* Toggle sidebar open */}
        <ShortcutTooltip label={t("sidebar.open_sidebar") }>
          <button
            onClick={onToggleSidebar}
            className={`cursor-pointer p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all duration-200 flex items-center justify-center`}
            aria-label={t("sidebar.open_sidebar")}
          >
            <ChevronRight className="w-5 h-5 text-tertiary" />
          </button>
        </ShortcutTooltip>

        {/* New chat */}
        <ShortcutTooltip
          label={newConversationLabel}
          shortcut={newConversationShortcut}
        >
          <button
            onClick={() => {
              if (!handleNewConversation) return;
              handleNewConversation().catch((error) => {
                console.error("Failed to start new conversation", error);
              });
            }}
            className={`cursor-pointer p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
            aria-label={newConversationAria}
          >
            <Plus className="w-5 h-5 text-tertiary" />
          </button>
        </ShortcutTooltip>

        {/* Rename current conversation */}
        <ShortcutTooltip
          label={t("sidebar.rename_tooltip", { title: currentTitle })}
        >
          <button
            onClick={handleRenameConversation}
            className={`cursor-pointer p-2.5 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
            aria-label={t("sidebar.rename_tooltip", { title: currentTitle })}
          >
            <Edit className="w-5 h-5 text-tertiary" />
          </button>
        </ShortcutTooltip>
      </div>
      <div className="flex flex-col items-center justify-between gap-3 border-t border-tertiary pt-3">
        {/* Import Conversation button */}
        <ImportConversationButton variant="icon" />

        {/* Import persona from Github */}
        <ShortcutTooltip label={t("sidebar.import_persona") }>
          <button
            onClick={() => {
              openModal("importPersona");
            }}
            className={`cursor-pointer p-1 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
            aria-label={t("sidebar.import_persona")}
          >
            <Bot className="w-6 h-6 text-tertiary" />
          </button>
        </ShortcutTooltip>
      </div>
    </div>
  );
}

export default CollapsedSidebar;
