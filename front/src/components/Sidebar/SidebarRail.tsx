import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

import { Bot, ChevronRight, Edit, Add, AddFilled, BrainstormFilled, Download, HorizontalLineSolid } from "@carbon/icons-react";
import { useWindowSize } from "../../hooks/useWindowSize";
import ImportConversationButton from "./ImportChatButton";
import { useModal } from "../../modals/ModalContext";
import ShortcutTooltip from "./ShortcutTooltip";
import UserContainer from "../Header/UserContainer";

export default function SidebarRail({ 
  localState,
  setLocalState,
  userData,
  modelsData,
  onOpen, 
  handleNewConversation 
}: { 
  localState: any,
  setLocalState: any,
  userData: any,
  modelsData: any,
  onOpen: () => void, 
  handleNewConversation: (folderId?: string | null) => Promise<void> 
}) {

  const { openModal } = useModal();
  const { t } = useTranslation();
  const newConversationLabel = t("sidebar.new_conversation");
  const newConversationShortcut = t("sidebar.shortcut_new_conversation");
  const newConversationAria = `${newConversationLabel} ${newConversationShortcut}`;

  const handleRenameChat = () => {
    openModal("renameChat", {
      id: localState.id,
      currentTitle: localState?.title || "Untitled Chat",
    });
  };

  const handleSummarizeChat = () => {
    openModal("summarizeChat", {
      localState: localState,
      setLocalState: setLocalState,
    });
  };

  const handleExportChat = () => {
    openModal("exportChat", {
      localState: localState,
      conversationId: localState.id,
    });
  };

  const [currentConversationTitle, setCurrentConversationTitle] = useState(localState?.title || "Untitled Chat");

  useEffect(() => {
    setCurrentConversationTitle(localState?.title || "Untitled Chat");
  }, [localState]);


  const { isTouch } = useWindowSize();
  return (
    <div className="bg-white dark:bg-bg_secondary_dark rounded-xl shadow-md
          overflow-hidden h-full flex flex-col items-center justify-between gap-2"
    >
        {/* Top - Logo and new chat */}
        <div className="mt-2 flex flex-col gap-4 items-center">
          {/* Logo with chevron on hover */}
          <div className="relative h-10 w-10 group">
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
                <ChevronRight size={40} className="text-tertiary" />
              </button>
            </ShortcutTooltip>
          </div>

          {/* New chat button */}
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
              <AddFilled size={22} className="text-tertiary" />
            </button>
          </ShortcutTooltip>

          {/* Import persona from Github button */}
          <ShortcutTooltip label={t("sidebar.import_persona") }>
            <button
              onClick={() => {
                openModal("importPersona");
              }}
              className={`cursor-pointer p-1 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
              aria-label={t("sidebar.import_persona")}
            >
              <Bot size={22} className="text-tertiary" />
            </button>
          </ShortcutTooltip>

          {/* Import Chat button */}
          <ImportConversationButton variant="icon" />
        </div>

        {/* Center - Expand sidebar button */}
        <div id="placeholder" className="group flex-1 w-full hover:bg-gray-100/50 dark:hover:bg-dark_hover cursor-pointer grid place-items-center"
          onClick={() => onOpen?.()}
        >
          <ShortcutTooltip label={t("sidebar.expand") }>
            <button
              className={`
                h-10 w-10 inset-0 grid place-items-center rounded-xl
                transition duration-200 opacity-0 
                group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-dark_hover cursor-pointer
                ${true || isTouch ? "opacity-100" : "opacity-0"}`}
              aria-label={t("sidebar.expand")}
            >
              <ChevronRight size={20} className="text-tertiary" />
            </button>
          </ShortcutTooltip>
        </div>

        {/* Bottom - Current chat actions and user card */}
        <div className="flex flex-col gap-1 items-center">

          {/* Rename current chat */}
          <ShortcutTooltip
            label={t("sidebar.rename_tooltip", { title: currentConversationTitle })}
          >
            <button
              onClick={handleRenameChat}
              className={`cursor-pointer p-2.5 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
              aria-label={t("sidebar.rename_tooltip", { title: currentConversationTitle })}
            >
              <Edit size={22} className="text-tertiary" />
            </button>
          </ShortcutTooltip>
          {/* Summarize current chat */}
          <ShortcutTooltip
            label={t("common.summarize")}
          >
            <button
              onClick={handleSummarizeChat}
              className={`cursor-pointer p-2.5 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
              aria-label={t("common.summarize")}
            >
              <BrainstormFilled size={22} className="text-tertiary" />
            </button>
          </ShortcutTooltip>
          {/* Export current chat */}
          <ShortcutTooltip
            label={t("common.export")}
          >
            <button
              onClick={handleExportChat}
              className={`cursor-pointer p-2.5 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
              aria-label={t("common.export")}
            >
              <Download size={22} className="text-tertiary" />
            </button>
          </ShortcutTooltip>
          <HorizontalLineSolid size={30} className="text-gray-200 dark:text-gray-600" />
          {/* User card */}
          <div
              role="button"
              tabIndex={0}
              onClick={() => {openModal("userSettings", { localState, userData, modelsData })}}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openModal("userSettings", { localState, userData, modelsData });
                }
              }}
              aria-label={t("user_settings.title")}
              className="flex items-center px-1 pt-1 pb-4 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
            <UserContainer
              localState={localState}
              userData={userData}
              modelsData={modelsData}
              interactive={false}
            />
          </div>
        </div>

    </div>
  );
}
