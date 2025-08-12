import { useState } from "react";
import { Trans } from "react-i18next";
import icon_help from "../../../assets/icons/help.svg";
import { useModal } from "../../../modals/ModalContext";

export default function SystemPromptContainer({ localState, setLocalState}) {
    const { openModal } = useModal();
    const [systemPromptError, setSystemPromptError] = useState("");

    // Validate the system prompt is not empty
    const validateSystemPrompt = () => {
        if (!localState.settings.systemPrompt?.trim()) {
        //setSystemPromptError(t("description.custom6"));
        // TODO handle t
        setSystemPromptError("System prompt is empty. Model may not respond.")
        return false;
        }
        return true;
    };

    // Handle changes to the system instructions/prompt
    const handleInstructionsChange = (event) => {
        const { value } = event.target;

        // Clear any existing error when user starts typing
        if (systemPromptError) {
            setSystemPromptError("");
        }

        // Update system prompt in local state
        setLocalState((prevState) => ({
            ...prevState,
            settings: {
            ...prevState.settings,
            systemPrompt: value,
            },
        }));
    };

    return (
        <div className="w-full flex flex-col gap-4">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
            <p className="text-sm">System prompt</p>
            <img
            src={icon_help}
            alt="help"
            className="h-[16px] w-[16px] cursor-pointer"
            onClick={() => openModal("helpSystemPrompt")}
            />
        </div>
        <div className="w-full relative">
            <div className="relative z-10">
            <textarea
                className={`dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark w-full min-h-[120px] text-sm`}
                type="text"
                name="systemPrompt"
                //placeholder={t("description.custom4")}
                // TODO use translation for placeholder
                placeholder={"Enter the system prompt here"}
                value={localState.settings.systemPrompt}
                onChange={handleInstructionsChange}
                onBlur={() => validateSystemPrompt()}
            />
            </div>
            {(systemPromptError ||
            !localState.settings.systemPrompt) && (
            <p className="text-yellow-600 text-xs">
                <Trans i18nKey="description.custom6" />
            </p>
            )}
        </div>
        </div>
    )
}