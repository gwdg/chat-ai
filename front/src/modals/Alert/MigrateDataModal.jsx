import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";
import { useState } from "react";
import { useToast } from "../../hooks/useToast";

export default function MigrateDataModal({ 
  isOpen, 
  onClose, 
  store, 
  importConversation,
  dispatch
}) {

  const [backupComplete, setBackupComplete] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);   // 0–100
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { notifyError, notifySuccess } = useToast();

  const handleBackup = () => {
    const filename = "chat-ai-backup.json";
    const state = store?.getState()?.migration_data || store?.getState();
    const stateStr  = JSON.stringify(state, null, 2);
    const blob = new Blob([stateStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setBackupComplete(true);
  };

  const handleMigrate = async () => {
    const oldState = store?.getState()?.migration_data;
    if (!oldState) {
      console.error("Failed to migrate data");
      dispatch({ type: 'CLEAR_MIGRATION_DATA' });
      notifyError("Nothing to migrate");
      onClose();
      return;
    }
    if (!Array.isArray(oldState?.conversations?.conversations)) {
      console.error("Conversations not an array");
      dispatch({ type: 'CLEAR_MIGRATION_DATA' });
      notifyError("Nothing to migrate");
      onClose();
      return;
    }

    try {
      // Reverse for ordering
      const conversations = [...oldState.conversations.conversations].reverse();
      setTotalCount(conversations.length);
      setMigrating(true);
      setCurrentIndex(0);
      setProgress(0);

      const lastConversationId = oldState.conversations.currentConversationId;
      let lastConversationIndex = -1;

      for (let i = 0; i < conversations.length; i++) {
        setCurrentIndex(i + 1);
        try {
          if (lastConversationId && conversations[i].id == lastConversationId) {
            lastConversationIndex = i;
            continue;
          }
          const silent = (i != conversations.length - 1) || (lastConversationId != -1);
          await importConversation(conversations[i], i != conversations.length - 1);
        } catch (err) {
          console.warn("Failed to import conversation", err);
        }
        // Update progress bar
        setProgress(Math.round(((i + 1) / conversations.length) * 100));
      }

      if (lastConversationIndex != -1) {
        await importConversation(conversations[lastConversationIndex]);
      }

      console.log("Cleaning up…");
      dispatch({ type: 'CLEAR_MIGRATION_DATA' });

    } catch (err) {
      console.log("Failed to migrate data", err);
      notifyError("Couldn't upgrade: " + err.message);
      onClose();
    }
    // Close the migration popup
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      isForced={true} // disable closing while migrating
      onClose={onClose} 
      titleKey="common.notice"
    >
      <div className="flex flex-col gap-4">
        <div className="pt-0 pb-2">
          <p className="dark:text-white text-black text-justify text-sm">
            <Trans i18nKey="alert.migrate_data" />
          </p>
        </div>

        {/* Migration progress */}
        {migrating && (
          <div className="w-full">
            <p className="text-sm text-center mb-2 dark:text-gray-300">
              Upgrading conversation {currentIndex} of {totalCount}…
            </p>
            <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="bg-green-500 h-4 transition-all duration-300 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!migrating && (
          <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
            {!backupComplete && (
              <>
                <button
                  className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
                  onClick={handleBackup}
                >
                  <Trans i18nKey="common.backup_data" />
                </button>

                <button
                  className="text-tertiary dark:text-primary p-3 justify-center items-center md:w-fit w-full min-w-[150px] select-none cursor-pointer"
                  onClick={() => setBackupComplete(true)}
                >
                  <Trans i18nKey="common.skip_backup" />
                </button>
              </>
            )}
            {backupComplete && (
              <button
                onClick={handleMigrate}
                className="
                  bg-green-500 hover:bg-green-600
                  text-white font-semibold
                  px-6 py-3
                  rounded-xl
                  shadow-lg hover:shadow-xl
                  transition-all duration-200 ease-in-out
                  border border-green-700 dark:border-green-400
                  w-full md:w-auto min-w-[150px]
                  select-none cursor-pointer
                "
              >
                <Trans i18nKey="common.upgrade_chat_ai" />
              </button>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
}