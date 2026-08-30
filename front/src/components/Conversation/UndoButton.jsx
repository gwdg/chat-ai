import { useTranslation } from "react-i18next";
import Tooltip from "../Others/Tooltip";
import { Undo2 } from "lucide-react";

export default function UndoButton({ localState, setLocalState }) {
  const { t } = useTranslation();
  const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;

  // Function to handle retry of last message
  const handleUndo = (e) => {
    e.preventDefault();
    // Remove last two messages
    // setLocalState((prev) => ({
    //   ...prev,
    //   messages: localState.messages.slice(0, Math.max(2, localState.messages.length - 2)),
    // }));

    setLocalState(prev => {
      if (prev.messages.length <= 3) return prev;
      // Truncated messages after the removal
      const truncated = prev.messages.slice(0, Math.max(2, prev.messages.length - 2))

      // Check if the user prompt has attachments
      const prompt = prev.messages[prev.messages.length - 1];
      const hasAttachments =
        Array.isArray(prompt.content) &&
        prompt.content.length > 1

      // If no attachments, move on
      if (!hasAttachments) {
        return { ...prev, messages: truncated };
      }

      // Append all attachments to the new last message
      const newPrompt = {
        ...truncated[truncated.length - 1],
        content: [
          ...truncated[truncated.length - 1].content,
          ...prompt.content.slice(1),
        ],
      }
      
      const merged = [...truncated]; // Avoid mutating prev
      merged[merged.length - 1] = newPrompt;
      // Return new truncated
      return { ...prev, messages: merged };
    });
  };

  return (
    <Tooltip text={t("common.undo")}>
      <button
        className="cursor-pointer bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 
                         px-2 py-2 rounded-full shadow-lg hover:shadow-xl dark:shadow-dark
                         flex items-center justify-center gap-2 transition-all duration-200 
                         hover:scale-105 border border-gray-200 dark:border-gray-600
                         backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95"
        onClick={handleUndo}
        disabled={loading}
      >
        <Undo2 className="cursor-pointer h-5 w-5 text-[#009EE0] hover:text-blue-600 transition-colors" />
      </button>
    </Tooltip>
  );
}
