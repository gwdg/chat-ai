import { Trans } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import BaseModal from "../BaseModal";
import {
  deleteAllMemories,
  selectAllMemories,
} from "../../Redux/reducers/userSettingsReducer";

export default function ClearMemoryModal({
  isOpen,
  onClose,
  notifySuccess,
  setLocalState,
  dontShowAgainMemory,
}) {
  const dispatch = useDispatch();
  const memories = useSelector(selectAllMemories);

  // Clear all memories
  const handleDeleteAllMemories = () => {
    dispatch(deleteAllMemories());
    if (notifySuccess) notifySuccess("Memories Deleted Successfully");
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="memory.clearAllTitle"
      maxWidth="max-w-lg"
    >
      {/* Warning Message */}
      <div className="flex flex-col gap-4">
        <div className="pt-0 pb-2">
          <p className="dark:text-white text-black text-justify mb-3">
            <Trans
              i18nKey="memory.clearAllWarning"
              defaultValue="Are you sure you want to delete all {{count}} memories? This action cannot be undone."
              values={{ count: memories.length }}
            />
          </p>

          {memories.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 text-lg">
                  ⚠️
                </span>
                <div>
                  <p className="text-yellow-800 dark:text-yellow-200 font-medium text-sm">
                    <Trans
                      i18nKey="memory.warningTitle"
                      defaultValue="Warning"
                    />
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                    <Trans
                      i18nKey="memory.warningText"
                      defaultValue="You will lose all personal memories that help the AI understand your preferences and context. Consider exporting them first."
                    />
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* "Don't show again" checkbox */}

        {/* Buttons */}
        <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm">
          {/* Cancel */}
          <button
            onClick={onClose}
            className="text-gray-700 dark:text-white p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer transition-colors"
          >
            <Trans i18nKey="memory.cancel" defaultValue="Cancel" />
          </button>

          {/* Clear All */}
          <button
            onClick={handleDeleteAllMemories}
            disabled={memories.length === 0}
            className="text-white p-3 bg-red-600 hover:bg-red-700 active:bg-red-800 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trans
              i18nKey="memory.clearAll"
              defaultValue="Clear All Memories ({{count}})"
              values={{ count: memories.length }}
            />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}