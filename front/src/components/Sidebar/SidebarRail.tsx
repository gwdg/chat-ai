import {
  useEffect,
  useState,
} from "react";

import { useTranslation } from "react-i18next";
import ChatAiLogoMini from "../../assets/logos/chat_ai_small.ico";

import { ChevronRight, HorizontalLineSolid } from "@carbon/icons-react";
import { useWindowSize } from "../../hooks/useWindowSize";
import ImportConversationButton from "./Buttons/ImportChatButton";
import { useModal } from "../../modals/ModalContext";
import ShortcutTooltip from "./ShortcutTooltip";
import UserContainer from "../Header/UserContainer";
import ImportPersonaButton from "./Buttons/ImportPersonaButton";
import NewChatButton from "./Buttons/NewChatButton";
import SummarizeChatButton from "./Buttons/SummarizeChatButton";
import ExportChatButton from "./Buttons/ExportChatButton";
import RenameChatButton from "./Buttons/RenameChatButton";

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
          <NewChatButton variant="rail" topicId={localState?.folderId} onNewConversation={handleNewConversation} />

          {/* Import persona from Github button */}
          <ImportPersonaButton variant="rail" topicId={localState?.folderId} />

          {/* Import Chat button */}
          <ImportConversationButton variant="rail" topicId={localState?.folderId} />
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
          <RenameChatButton
            localState={localState}
            setLocalState={setLocalState}
            variant={"rail"}
          />

          {/* Summarize current chat */}
          <SummarizeChatButton
            localState={localState}
            setLocalState={setLocalState}
            variant={"rail"}
          />

          {/* Export current chat */}
          <ExportChatButton
            localState={localState}
            setLocalState={setLocalState}
            variant={"rail"}
          />
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
