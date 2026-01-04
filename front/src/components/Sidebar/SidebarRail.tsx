import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faChevronLeft, faPlus, faSearch, faEdit, faFileImport } from "@fortawesome/free-solid-svg-icons";
import { faChevronUp, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import {
  selectDarkMode,
  selectShowSettings,
  selectShowSidebar,
  toggleSidebar,
} from "../../Redux/reducers/interfaceSettingsSlice";

import { useTranslation } from "react-i18next";

import ChatAiLogo from "../../assets/logos/chat_ai.svg";
import ChatAiLogoMini from "../../assets/logos/chat_ai_small.ico";
import { useDispatch, useSelector } from "react-redux";
import { createConversation } from "../../db";
import { useNavigate } from "react-router";
import {
  getDefaultConversation,
  getDefaultSettings,
} from "../../utils/conversationUtils";

import { Bot, ChevronRight, Download, Edit, Plus, Sidebar, SquarePen } from "lucide-react";
import { useWindowSize } from "../../hooks/useWindowSize";
import ImportConversationButton from "./ImportConversationButton";
import { useModal } from "../../modals/ModalContext";
import ShortcutTooltip from "./ShortcutTooltip";

export default function SidebarRail({ localState, onOpen, handleNewConversation }: { localState: any, onOpen: () => void, handleNewConversation: (folderId?: string | null) => Promise<void> }) {

  const { openModal } = useModal();
  const { t } = useTranslation();
  const newConversationLabel = t("sidebar.new_conversation");
  const newConversationShortcut = t("sidebar.shortcut_new_conversation");
  const newConversationAria = `${newConversationLabel} ${newConversationShortcut}`;

  const handleRenameConversation = () => {
    openModal("renameConversation", {
      id: localState.id,
      currentTitle: localState?.title || "Untitled Conversation",
    });
  };

  const [currentConversationTitle, setCurrentConversationTitle] = useState(localState?.title || "Untitled Conversation");

  useEffect(() => {
    setCurrentConversationTitle(localState?.title || "Untitled Conversation");
  }, [localState]);


  const { isTouch } = useWindowSize();
  return (
    <div
      className="bg-white dark:bg-bg_secondary_dark
              rounded-xl shadow-md
              overflow-hidden
              h-full"
    >
      <div className="h-full flex flex-col items-center gap-2">

        {/* Logo with chevron on hover */}
        <div className="mt-2 relative h-10 w-10 group">
          {/* Logo */}
          <img
            className="absolute inset-0 object-contain transition-opacity duration-200 group-hover:opacity-0"
            src={ChatAiLogoMini}
            alt="Chat AI Logo"
          />

          {/* Chevron Button */}
          <ShortcutTooltip label={t("sidebar.expand") }>
            <button
              onClick={() => onOpen?.()}
              className="absolute h-10 w-10 inset-0 grid place-items-center rounded-xl transition duration-200 opacity-0 group-hover:opacity-100 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer"
              aria-label={t("sidebar.expand")}
            >
              <ChevronRight className="w-10 h-10 text-tertiary" />
            </button>
          </ShortcutTooltip>
        </div>

        {/** Actions */}
        <div className="mt-4 flex flex-col gap-3 items-center">

          {/* New chat */}
          <ShortcutTooltip
            label={newConversationLabel}
            shortcut={newConversationShortcut}
          >
            <button
              onClick={() => {
                handleNewConversation().catch((error) => {
                  console.error("Failed to start new conversation", error);
                });
              }}
              className={`cursor-pointer p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 rounded-2xl flex items-center justify-center`}
              aria-label={newConversationAria}
            >
              <Plus className="w-5 h-5 text-tertiary" />
            </button>
          </ShortcutTooltip>

          {/* Rename current conversation */}
          <ShortcutTooltip
            label={t("sidebar.rename_tooltip", { title: currentConversationTitle })}
          >
            <button
              onClick={handleRenameConversation}
              className={`cursor-pointer p-2.5 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
              aria-label={t("sidebar.rename_tooltip", { title: currentConversationTitle })}
            >
              <Edit className="w-5 h-5 text-tertiary" />
            </button>
          </ShortcutTooltip>


        </div>
        <div id="placeholder" className="group flex-1 w-full hover:bg-gray-100/50 dark:hover:bg-dark_hover cursor-pointer grid place-items-center"
          onClick={() => onOpen?.()}
        >
          <ShortcutTooltip label={t("sidebar.expand") }>
            <button
              className={`
                translate-y-[-10vh]
                h-10 w-10 inset-0 grid place-items-center rounded-xl
                transition duration-200 opacity-0 
                group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-dark_hover cursor-pointer
                ${true || isTouch ? "opacity-100" : "opacity-0"}`}
              aria-label={t("sidebar.expand")}
            >
              <FontAwesomeIcon size="xl" className=" text-tertiary" icon={faChevronRight} />
            </button>
          </ShortcutTooltip>
        </div>
        <div className="mb-2 flex flex-col items-center justify-between gap-3 border-t border-tertiary pt-3">
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

    </div>
  );
}
