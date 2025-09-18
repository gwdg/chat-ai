import { Trans } from "react-i18next";
import { useSelector } from "react-redux";

import { useModal } from "../ModalContext"; 
import BaseModal from "../BaseModal";
import DefaultModelSelector from "./DefaultModelSelector";
import UserInfoContainer from "./UserInfoContainer";
import TimeoutSetter from "./TimeoutSetter";
import UserMemoryContainer from "./UserMemoryContainer";
import { getExportData } from "../../utils/conversationUtils";
import { listConversationMetas } from "../../db";
import { useToast } from "../../hooks/useToast";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";

// Function to generate timestamped filename for data export
const generateFileName = (extension, username = "user") => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${username}-chat-ai-${year}${month}${day}-${hour}${minute}${second}.${extension}`;
};

export default function UserSettingsModal({
  isOpen,
  onClose,
  userData,
  modelsData,
  localState,
}) {
  const { openModal } = useModal();
  const { notifySuccess, notifyError } = useToast();
  const userSettings = useSelector(selectUserSettings);
  
  const handleExportData = async () => {
    try {
      const exportData = await getExportData();
      exportData.user_settings = userSettings;
      const content = JSON.stringify(exportData, null, 2);
      let file = new Blob([content], { type: "application/json" });
      let a = document.createElement("a");
      a.download = generateFileName("json", userData?.username);
      a.href = URL.createObjectURL(file);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notifySuccess("Data exported successfully");
    } catch (error) {
    console.log(error)
      notifyError("Failed to export all data");
    }
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="user_settings.title"
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
              <Trans i18nKey="user_settings.data.title" />
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            <Trans i18nKey="user_settings.data.description" />
          </p>
          <div className="w-full flex justify-center gap-4">
            <button
              className="w-full sm:max-w-[200px] px-4 py-3 
                        bg-red-600 hover:bg-red-700 
                        text-white font-medium rounded-lg 
                        flex items-center justify-center gap-2
                        shadow-md hover:shadow-lg 
                        active:scale-95
                        transition-all duration-200 text-sm cursor-pointer"
              onClick={() => openModal("clearCache")}
            >
              <Trans i18nKey="user_settings.clear_data_button" />
            </button>
            <button
              className="w-full sm:max-w-[200px] px-4 py-3 
                        bg-purple-600 hover:bg-purple-700 
                        text-white font-medium rounded-lg 
                        flex items-center justify-center gap-2
                        shadow-md hover:shadow-lg 
                        active:scale-95
                        transition-all duration-200 text-sm cursor-pointer"
              onClick={handleExportData}
            >
              <Trans i18nKey="user_settings.export_data_button" />
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}