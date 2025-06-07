// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import { useSelector, useDispatch } from "react-redux";
import ContainerModal from "./ContainerModal"; // Importing Model component
import cross from "../assets/cross.svg"; // Close icon
import {
  deleteAllMemories,
  selectAllMemories,
} from "../Redux/reducers/userMemorySlice";

function ClearMemoryModal(props) {
  const dispatch = useDispatch();
  const memories = useSelector(selectAllMemories);

  // Handler for checkbox state change
  const handleCheckboxChange = (event) => {
    props.setLocalState((prevState) => ({
      ...prevState,
      dontShow: {
        ...prevState.dontShow,
        dontShowAgainMemory: event.target.checked,
      },
    }));
  };

  // Handler for clearing all memories
  const handleClearAllMemories = () => {
    dispatch(deleteAllMemories());
    props.showModal(false); // Close modal after clearing
  };

  return (
    <ContainerModal showModal={props.showModal} isConfirmationModal={true}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black w-full">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary font-medium">
            <Trans
              i18nKey="description.memory.clearAllTitle"
              defaultValue="Clear All Memories"
            />
          </p>
          {/* Close button */}
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            onClick={() => props.showModal(false)}
          />
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* Warning Content */}
          <div className="pt-0 pb-2">
            <p className="dark:text-white text-black text-justify mb-3">
              <Trans
                i18nKey="description.memory.clearAllWarning"
                defaultValue="Are you sure you want to delete all {{count}} memories? This action cannot be undone and will permanently remove all your saved memories."
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
                        i18nKey="description.memory.warningTitle"
                        defaultValue="Warning"
                      />
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                      <Trans
                        i18nKey="description.memory.warningText"
                        defaultValue="You will lose all personal memories that help the AI understand your preferences and context. Consider exporting them first if needed."
                      />
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Add the checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="dontShowAgainMemory"
              checked={props.dontShowAgainMemory || false}
              onChange={handleCheckboxChange}
              className="h-5 w-5 rounded-md border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer transition duration-200 ease-in-out"
            />
            <label
              htmlFor="dontShowAgainMemory"
              className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
            >
              <Trans
                i18nKey="description.memory.dontShowAgain"
                defaultValue="Don't show this warning again"
              />
            </label>
          </div>

          {/* Buttons */}
          <div className="flex flex-col md:flex-row gap-2 justify-between w-full">
            {/* Cancel button */}
            <button
              className="text-gray-700 dark:text-white p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none transition-colors"
              onClick={() => props.showModal(false)}
            >
              <Trans
                i18nKey="description.memory.cancel"
                defaultValue="Cancel"
              />
            </button>

            {/* Clear all memories button */}
            <button
              className="text-white p-3 bg-red-600 hover:bg-red-700 active:bg-red-800 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none transition-colors"
              onClick={handleClearAllMemories}
              disabled={memories.length === 0}
            >
              <Trans
                i18nKey="description.memory.clearAll"
                defaultValue="Clear All Memories ({{count}})"
                values={{ count: memories.length }}
              />
            </button>
          </div>
        </div>
      </div>
    </ContainerModal>
  );
}

export default ClearMemoryModal;
