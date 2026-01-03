import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { useImportConversation } from "../../hooks/useImportConversation";
import { Upload } from "lucide-react";
import { useToast } from "../../hooks/useToast";
import ShortcutTooltip from "./ShortcutTooltip";


export default function ImportConversationButton({
  variant = "icon",
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
            <Upload className="w-5 h-5 text-[#009EE0]" />
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
          className={`cursor-pointer w-full bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-black dark:text-white px-4 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-medium touch-manipulation transition-colors ${
            loading ? "cursor-not-allowed opacity-50" : ""
          } `}
          style={{
            WebkitTapHighlightColor: "transparent",
            minHeight: "44px",
          }}
        >
          <Upload className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{t("common.import")}</span>
        </button>
      </>
    );
  }

  // Default fallback
  return null;
}
