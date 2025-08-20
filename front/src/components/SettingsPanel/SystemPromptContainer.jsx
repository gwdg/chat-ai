import { useState } from "react";
import { Trans } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { useModal } from "../../modals/ModalContext";

export default function SystemPromptContainer({ localState, setLocalState }) {
  const { openModal } = useModal();
  const [systemPromptError, setSystemPromptError] = useState("");

  // Validate the system prompt is not empty
  const validateSystemPrompt = () => {
    if (!localState.messages[0].content[0].data?.trim()) {
      //setSystemPromptError(t("description.custom6"));
      // TODO handle t
      setSystemPromptError("System prompt is empty. Model may not respond.");
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
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: value,
            },
          ],
        },
        ...localState.messages.slice(1),
      ],
    }));
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex-shrink-0 flex items-center gap-2 select-none">
        <p className="text-sm">System prompt</p>
        <HelpCircle
          className="h-[16px] w-[16px] cursor-pointer text-[#009EE0]"
          alt="help"
          onClick={() => openModal("helpSystemPrompt")}
        />
      </div>
      <div className="w-full relative">
        <div className="relative z-10">
          <textarea
            className="dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border border-gray-200 dark:border-gray-800 outline-none rounded-2xl shadow-lg dark:shadow-dark w-full min-h-[120px] text-sm"
            type="text"
            name="systemPrompt"
            placeholder="Enter the system prompt here"
            value={localState.messages[0].content[0].text}
            onChange={handleInstructionsChange}
            onBlur={() => validateSystemPrompt()}
          />
        </div>
        {(systemPromptError || !localState.messages[0].content[0].text) && (
          <p className="text-yellow-600 text-xs">
            <Trans i18nKey="description.custom6" />
          </p>
        )}
      </div>
    </div>
  );
}
