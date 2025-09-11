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
import UserSettingsModal from "./UserSettings/UserSettingsModal";
import UserMemoryModal from "./UserSettings/UserMemoryModal";
import ShareSettingsModal from "./Chat/ShareSettingsModal";
import ClearCacheModal from "./UserSettings/ClearCacheModal";
import ErrorBadRequestModal from "./Alert/ErrorBadRequestModal";
import ErrorSessionExpiredModal from "./Alert/ErrorSessionExpiredModal";
import DeleteConversationModal from "../components/Sidebar/DeleteConversationModal";
import RenameConversationModal from "../components/Sidebar/RenameConversationModal";
import ExportConversationModal from "../components/Sidebar/ExportConversationModal";
import ImportPersonaModal from "../components/Sidebar/ImportPersonaModal";
import ClearMemoryModal from "./UserSettings/ClearMemoryModal";
import ClearMessagesModal from "./Alert/ClearMessagesModal";
import PreviewModal from "./Chat/PreviewModal";
import UnsentFilesModal from "./Alert/UnsentFilesModal";
import UnprocessedFilesModal from "./Alert/UnprocessedFilesModal";
import ServiceOfflineModal from "./Alert/ServiceOfflineModal";
import MigrateDataModal from "./Alert/MigrateDataModal";
import ConversationConflict from "./Chat/ConversationConflict";

import { useDispatch, useStore } from 'react-redux';
import { useToast } from "../hooks/useToast";
import { useImportConversation } from "../hooks/useImportConversation";
import HelpWebSearchModal from "./Help/HelpWebSearchModal";
import WebSearchDisclaimer from "./Alert/WebSearchDisclaimer";

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
    setModalProps( {...props, notifySuccess} );
  };

  const closeModal = () => {
    setModalType(null);
    setModalProps({});
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
        {children}
        {/* Sidebar Modals */}
        {modalType === "deleteConversation" && (
            <DeleteConversationModal isOpen onClose={closeModal} {...modalProps} />
        )}
        {modalType === "renameConversation" && (
            <RenameConversationModal isOpen onClose={closeModal} {...modalProps} />
        )}
        {modalType === "importPersona" && (
            <ImportPersonaModal isOpen onClose={closeModal} {...modalProps} />
        )}
        {/* Setting Panel Modals */}
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
        {modalType === "helpMemory" && (
            <HelpMemoryModal isOpen onClose={closeModal} {...modalProps} />
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
        {/* General Modals */}
        {modalType === "exportConversation" && (
            <ExportConversationModal isOpen onClose={closeModal} {...modalProps} />
        )}
        {modalType === "preview" && (
            <PreviewModal isOpen onClose={closeModal} {...modalProps} />
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
        {modalType === "migrate" && (
            <MigrateDataModal isOpen onClose={closeModal} store={store} importConversation={importConversation} dispatch={dispatch} {...modalProps} />
        )}
      
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}

