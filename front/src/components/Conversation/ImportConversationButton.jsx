import { useTranslation } from "react-i18next";
import { useRef } from "react";
import Tooltip from "../Others/Tooltip";
import { useImportConversation } from "../../hooks/useImportConversation";

import icon_import from "../../assets/icons/import.svg";

export default function ImportConversationButton ({localState, setLocalState}) {
  const { t } = useTranslation();
  const loading = false; // TODO handle loading
  const importConversation = useImportConversation();
  const hiddenFileInputJSON = useRef(null);

  // Function to handle JSON file import
  const handleFilesChangeJSON = async (e) => {
    try {
      const selectedFile = e.target.files[0];
      // Validate file selection and type
      if (!selectedFile) {
        notifyError("No file selected.");
        return;
      }
      if (selectedFile.type !== "application/json") {
        notifyError("Please select a valid JSON file.");
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => {
        notifyError("Error reading file.");
      };
      // Handle file content after loading
      reader.onload = async () => {
        // Parse and process JSON data
        try {
          let data = reader.result;
          // Fix common JSON issues like trailing commas
          data = data.replace(/,(\s*[}\]])/g, "$1"); // Remove trailing commas
          const parsedData = JSON.parse(data);
          // Import
          await importConversation(parsedData);
        } catch (jsonError) {
          console.error("JSON Parse Error:", jsonError);
          notifyError("Invalid JSON file format: " + jsonError.message);
        }
      };

      reader.readAsText(selectedFile);
    } catch (error) {
      notifyError("An error occurred: " + error.toString());
    }
  };

  // Function to trigger JSON file input click
  const handleClickJSON = () => {
    hiddenFileInputJSON.current.value = null;
    hiddenFileInputJSON.current.click();
  };

  return (
    <div className="w-full bottom-0 sticky select-none h-fit px-3 py-1.5 flex justify-end items-center bg-white dark:bg-bg_secondary_dark rounded-b-xl">
      <input
        type="file"
        ref={hiddenFileInputJSON}
        accept="application/JSON"
        onChange={handleFilesChangeJSON}
        className="hidden"
      />
      <Tooltip text={t("description.import")}>
        <button
          className="h-[26px] w-[26px] cursor-pointer"
          onClick={handleClickJSON}
          disabled={loading}
        >
          <img
            className="h-[26px] w-[26px]"
            src={icon_import}
            alt="import"
          />
        </button>
      </Tooltip>
    </div>
  );
};
