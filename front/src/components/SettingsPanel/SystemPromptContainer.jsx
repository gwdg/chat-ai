import { useMemo, useState, useEffect } from "react";
import { Trans } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { useModal } from "../../modals/ModalContext";
import { useDebounce } from "../../hooks/useDebounce";

export default function SystemPromptContainer({ localState, setLocalState }) {
  const { openModal } = useModal();
  const [systemPromptError, setSystemPromptError] = useState("");
  const [value, setValue] = useState(localState.messages[0]?.content[0]?.text || "");

  // Validate the system prompt is not empty
  const validateSystemPrompt = () => {
    if (!value.trim()) {
      //setSystemPromptError(t("description.custom6"));
      // TODO handle t
      setSystemPromptError("System prompt is empty. Model may not respond.");
      return false;
    }
    return true;
  };

  // UseEffect to listen to indirect changes to system prompt
  useEffect(() => {
    setValue(localState.messages[0]?.content[0]?.text || "");
  }, [localState.messages[0]?.content[0]]);

  // Handle changes to the system instructions/prompt
  const saveSystemPrompt = () => {
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

  const debouncedSave = useDebounce(saveSystemPrompt, 300);

  const onChange = (e) => {
    if (systemPromptError) {
      setSystemPromptError("");
    }
    setValue(e.target.value);
    debouncedSave();
  };

  return (
    <div className="w-full flex flex-col flex-grow gap-4">
      <div className="flex-shrink-0 flex items-center gap-2 select-none">
        <p className="text-sm">System prompt</p>
        <HelpCircle
          className="h-[16px] w-[16px] cursor-pointer text-[#009EE0]"
          alt="help"
          onClick={() => openModal("helpSystemPrompt")}
        />
      </div>
      <div className="w-full relative z-10 flex-grow">
          <textarea
            className="h-full resize-none bg-white text-black dark:text-white dark:bg-bg_secondary_dark p-3 border border-gray-200 dark:border-black/20 outline-none rounded-lg shadow-lg dark:shadow-dark w-full min-h-[24vh] text-sm overflow-y-auto"
            type="text"
            name="systemPrompt"
            placeholder="Enter the system prompt here"
            value={value || ""}
            onChange={onChange}
            onBlur={() => validateSystemPrompt()}
          />
      </div>
      {(systemPromptError || !value) && (
          <p className="text-yellow-600 text-xs">
            <Trans i18nKey="description.custom6" />
          </p>
        )}
    </div>
  );
}
