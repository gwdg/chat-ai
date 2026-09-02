import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { useImportConversation } from "../../hooks/useImportConversation";
import { Upload } from "@carbon/icons-react";
import { useToast } from "../../hooks/useToast";
import ShortcutTooltip from "./ShortcutTooltip";


export default function ImportChatButton({
  variant = "icon",
  topicId = null,
}) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
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
          await importConversation(parsedData, false, topicId);
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

  // Render icon variant (original behavior)
  if (variant === "icon") {
    return (
      <>
        <input
          type="file"
          ref={hiddenFileInputJSON}
          accept="application/JSON"
          onChange={handleFilesChangeJSON}
          className="hidden"
        />
        <ShortcutTooltip label={t("common.import")}
        >
          <button
            className={`cursor-pointer p-1.5 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center `}
            onClick={handleClickJSON}
            disabled={loading}
            aria-label={t("common.import")}
          >
            <Upload size={22} className="text-tertiary" />
          </button>
        </ShortcutTooltip>
      </>
    );
  }

  // Render button variant (with text)
  if (variant === "button") {
    return (
      <>
        <input
          type="file"
          ref={hiddenFileInputJSON}
          accept="application/JSON"
          onChange={handleFilesChangeJSON}
          className="hidden"
        />
        <button
          onClick={handleClickJSON}
          disabled={loading}
          className={`cursor-pointer w-full hover:bg-gray-50 dark:hover:bg-gray-800/50 text-black dark:text-white px-4 py-3 rounded-2xl flex items-center justify-start gap-2 text-xs font-medium touch-manipulation transition-all duration-100 ${
            loading ? "cursor-not-allowed opacity-50" : ""
          } `}
          style={{
            WebkitTapHighlightColor: "transparent",
            minHeight: "44px",
          }}
        >
          <Upload size={16} className="flex-shrink-0" />
          <span className="truncate">{t("common.import")}</span>
        </button>
      </>
    );
  }

  // Render sidebar button variant (with text)
  if (variant === "sidebar") {
    return (
      <>
      <ShortcutTooltip label={t("common.import")}>
        <input
          type="file"
          ref={hiddenFileInputJSON}
          accept="application/JSON"
          onChange={handleFilesChangeJSON}
          className="hidden"
        />
        <button
          onClick={handleClickJSON}
          disabled={loading}
          className={`cursor-pointer flex-shrink-0 p-2 rounded-2xl transition-all duration-200 flex items-center justify-center
           hover:bg-gray-100 dark:hover:bg-gray-800 text-black dark:text-white transition-all duration-100 ${
            loading ? "cursor-not-allowed opacity-50" : ""
          } `}
          style={{
            WebkitTapHighlightColor: "transparent"
          }}
        >
          <Upload size={24} className="text-tertiary" />
        </button>
        </ShortcutTooltip>
      </>
    );
  }

  // Default fallback
  return null;
}
