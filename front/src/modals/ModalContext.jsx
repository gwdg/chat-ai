// ModalContext.jsx
import { createContext, useContext, useState } from "react";

// Import your modal components
import HelpToolsModal from "./Help/HelpToolsModal";
import HelpSystemPromptModal from "./Help/HelpSystemPromptModal";
import HelpModelsModal from "./Help/HelpModelsModal";
import HelpArcanaModal from "./Help/HelpArcanaModal";
import HelpTemperatureModal from "./Help/HelpTemperatureModal";
import HelpTopPModal from "./Help/HelpTopPModal";
import HelpMemoryModal from "./Help/HelpMemoryModal";
import HelpChoiceProposer from "./Help/HelpChoiceProposer";
import UserSettingsModal from "./UserSettings/UserSettingsModal";
import UserMemoryModal from "./UserSettings/UserMemoryModal";
import ShareSettingsModal from "./Chat/ShareSettingsModal";
import ClearCacheModal from "./UserSettings/ClearCacheModal";
import ErrorBadRequestModal from "./Alert/ErrorBadRequestModal";
import ErrorSessionExpiredModal from "./Alert/ErrorSessionExpiredModal";
import DeleteChatModal from "../components/Sidebar/Modals/DeleteChatModal";
import RenameChatModal from "../components/Sidebar/Modals/RenameChatModal";
import ExportChatModal from "../components/Sidebar/Modals/ExportChatModal";
import ImportPersonaModal from "../components/Sidebar/Modals/ImportPersonaModal";
import FolderEditorModal from "../components/Sidebar/Modals/FolderEditorModal";
import DeleteFolderModal from "../components/Sidebar/Modals/DeleteFolderModal";
import MoveChatModal from "../components/Sidebar/Modals/MoveChatModal";
import ClearMemoryModal from "./UserSettings/ClearMemoryModal";
import ClearMessagesModal from "./Alert/ClearMessagesModal";
import RegenerateConfirmModal from "./Alert/RegenerateConfirmModal";
import PreviewModal from "./Chat/PreviewModal";
import UnsentFilesModal from "./Alert/UnsentFilesModal";
import UnprocessedFilesModal from "./Alert/UnprocessedFilesModal";
import ServiceOfflineModal from "./Alert/ServiceOfflineModal";
import MigrateDataModal from "./Alert/MigrateDataModal";
import ConversationConflict from "./Chat/ConversationConflict";
import SummarizeChatModal from "./Chat/SummarizeChatModal";

import { useDispatch, useStore } from "react-redux";
import { useToast } from "../hooks/useToast";
import { useImportConversation } from "../hooks/useImportConversation";
import HelpWebSearchModal from "./Help/HelpWebSearchModal";
import WebSearchDisclaimer from "./Alert/WebSearchDisclaimer";
import WelcomeModal from "./Help/WelcomeModal";
import HelpMCPModal from "./Help/HelpMCPModal";
import ImportSettingsDisclaimerModal from "./Alert/ImportSettingsDisclaimerModal";
import HelpReasoningModal from "./Help/HelpReasoningModal";

const ModalContext = createContext();

export function ModalProvider({ children }) {
  const [modalType, setModalType] = useState(null);
  const [modalProps, setModalProps] = useState({});
  const { notifySuccess, notifyError } = useToast();

  // For migration
  const store = useStore();
  const dispatch = useDispatch();
  const importConversation = useImportConversation();

  const openModal = (type, props = {}) => {
    setModalType(type);
    setModalProps({ ...props, notifySuccess });
  };

  const closeModal = () => {
    setModalType(null);
    setModalProps({});
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {/* Welcome Tour Modal */}
      {modalType === "welcome" && (
        <WelcomeModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {/* Sidebar Modals */}
      {modalType === "deleteChat" && (
        <DeleteChatModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "renameChat" && (
        <RenameChatModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "importPersona" && (
        <ImportPersonaModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "createFolder" && (
        <FolderEditorModal
          mode="create"
          isOpen
          onClose={closeModal}
          {...modalProps}
        />
      )}
      {modalType === "renameFolder" && (
        <FolderEditorModal
          mode="rename"
          isOpen
          onClose={closeModal}
          {...modalProps}
        />
      )}
      {modalType === "deleteFolder" && (
        <DeleteFolderModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {/* Chat Modals */}
      {modalType === "shareSettings" && (
        <ShareSettingsModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {/* Help Modals */}
      {modalType === "helpModels" && (
        <HelpModelsModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "helpArcana" && (
        <HelpArcanaModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "helpMCP" && (
        <HelpMCPModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "helpMemory" && (
        <HelpMemoryModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "helpChoiceProposer" && (
        <HelpChoiceProposer isOpen onClose={closeModal} {...modalProps} />
      )}      
      {modalType === "helpSystemPrompt" && (
        <HelpSystemPromptModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "helpTemperature" && (
        <HelpTemperatureModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "helpTopP" && (
        <HelpTopPModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "helpTools" && (
        <HelpToolsModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "helpReasoning" && (
        <HelpReasoningModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "helpWebSearch" && (
        <HelpWebSearchModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {/* User Settings Modals*/}
      {modalType === "userSettings" && (
        <UserSettingsModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "userMemory" && (
        <UserMemoryModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "clearCache" && (
        <ClearCacheModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "clearMemory" && (
        <ClearMemoryModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {/* Error Modals */}
      {modalType === "errorBadRequest" && (
        <ErrorBadRequestModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "errorSessionExpired" && (
        <ErrorSessionExpiredModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "clearMessages" && (
        <ClearMessagesModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "regenerateConfirm" && (
        <RegenerateConfirmModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {/* General Modals */}
      {modalType === "exportChat" && (
        <ExportChatModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "moveChat" && (
        <MoveChatModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "preview" && (
        <PreviewModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "summarizeChat" && (
        <SummarizeChatModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "unsentFiles" && (
        <UnsentFilesModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "unprocessedFiles" && (
        <UnprocessedFilesModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "serviceOffline" && (
        <ServiceOfflineModal isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "conversationConflict" && (
        <ConversationConflict isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "disclaimerWebSearch" && (
        <WebSearchDisclaimer isOpen onClose={closeModal} {...modalProps} />
      )}
      {modalType === "importSettingsDisclaimer" && (
        <ImportSettingsDisclaimerModal
          isOpen
          onClose={closeModal}
          {...modalProps}
        />
      )}
      {modalType === "migrate" && (
        <MigrateDataModal
          isOpen
          onClose={closeModal}
          store={store}
          importConversation={importConversation}
          dispatch={dispatch}
          {...modalProps}
        />
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
