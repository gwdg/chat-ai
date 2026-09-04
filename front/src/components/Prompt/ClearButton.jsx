import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { abortRequest } from "../../apis/chatCompletions";
import { useToast } from "../../hooks/useToast";
import { Close } from "@carbon/icons-react";

export default function ClearButton({
    localState,
    setLocalState
}) {
    const { t, i18n } = useTranslation();
    const prompt = localState.messages[localState.messages.length - 1].content[0]?.text || "";
    const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;

    // Clear the prompt
    const handleClear = () => {
        setLocalState((prev) => {
        const messages = [...prev.messages]; // shallow copy
        messages[messages.length - 1] = {
            role: "user",
            content: [ { // Replace first content item
                type: "text",
                text: ""
            }, // Keep other content items
            ...prev.messages[messages.length - 1].content.slice(1)
            ]
        };
        return { ...prev, messages };
        });
    };

    // Display clear button if prompt is not empty
    return (prompt?.trim() !== "" ? (
        <Tooltip text={t("common.clear")}>
            <button
                className="cursor-pointer bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 
                         px-1 py-1 rounded-full shadow-sm hover:shadow-md dark:shadow-dark
                         flex items-center justify-center gap-2 transition-all duration-200 
                         hover:scale-105 border border-gray-200 dark:border-gray-600
                         backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95"
                onClick={handleClear}
                disabled={loading}
            >
                <Close className="cursor-pointer text-tertiary h-6 w-6" />
            </button>
        </Tooltip>
    ) : null)
}
