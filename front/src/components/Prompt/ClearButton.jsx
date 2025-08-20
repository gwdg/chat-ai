import icon_cross_sm from "../../assets/icons/cross_sm.svg";

import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { abortRequest } from "../../apis/chatCompletions";
import { useToast } from "../../hooks/useToast";

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
        <Tooltip text={t("description.clear")}>
            <button
                className="h-[30px] w-[30px] cursor-pointer"
                onClick={handleClear}
                disabled={loading}
            >
                <img
                className="cursor-pointer h-[25px] w-[25px]"
                src={icon_cross_sm}
                alt="clear"
                />
            </button>
        </Tooltip>
    ) : null)
}