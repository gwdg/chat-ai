import { Trans } from "react-i18next";

import { useModal } from "../ModalContext"; 
import BaseModal from "../BaseModal";

import DefaultModelSelector from "./DefaultModelSelector";
import UserInfoContainer from "./UserInfoContainer";
import TimeoutSetter from "./TimeoutSetter";
import UserMemoryContainer from "./UserMemoryContainer";

export default function UserSettingsModal({
  isOpen,
  onClose,
  userData,
  modelsData,
  localState,
}) {
  const { openModal } = useModal();
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="description.settings.userProfileSettings"
      maxWidth="max-w-3xl"
    >
      {/* User Info Container */}
      {userData ? <UserInfoContainer userData={userData} /> : <></>}

      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
        {/* Default Model Selector */}
        {modelsData ? <DefaultModelSelector modelsData={modelsData} /> : <></>}

        {/* Timeout Setter */}
        <TimeoutSetter />

        {/* User Memory Management */}
        <UserMemoryContainer localState={localState} />

        {/* Clear Cache */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium dark:text-white">
              <Trans i18nKey="description.settings.clearAllChats" />
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            <Trans i18nKey="description.settings.clearAllChatsDescription" />
          </p>
          <div className="w-full flex justify-center">
            <button
              className="w-full sm:max-w-[200px] px-5 py-3 
                        bg-red-600 hover:bg-red-700 
                        text-white font-medium rounded-lg 
                        flex items-center justify-center gap-2
                        shadow-md hover:shadow-lg 
                        active:scale-95
                        transition-all duration-200 text-sm cursor-pointer"
              onClick={() => openModal("clearCache")}
            >
              <Trans i18nKey="description.file2" />
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}