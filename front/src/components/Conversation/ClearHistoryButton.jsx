import { useTranslation } from "react-i18next";
import Tooltip from "../Others/Tooltip";
import { X } from "lucide-react"
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";

export default function ClearHistoryButton({localState, setLocalState}) {
  const { t } = useTranslation();
  const loading = false; // TODO handle loading
  const { openModal } = useModal();
  const {notifySuccess, notifyError } = useToast();

  // Clear conversation history
  const clearHistory = () => {
    setLocalState((prevState) => ({
      ...prevState,
      messages:
        prevState.messages.length > 1
          ? [prevState.messages[0], prevState.messages[prevState.messages.length-1]] // Keep only system message if it exists
          : prevState.messages,
    }));

    notifySuccess("History cleared");
  };

  // Function to handle clearing chat history
  const handleClearHistory = () => {
    if (localState?.dontShow?.dontShowAgain) {
      clearHistory();
    } else {
      openModal("clearHistory", { clearHistory })
    }
  };

  return (
    <Tooltip text={t("description.clear")}>
      <button
        className="h-[26px] w-[26px] cursor-pointer"
        disabled={loading}
        onClick={handleClearHistory}
      >
        <X
          className="cursor-pointer h-[22px] w-[22px] text-[#009EE0] hover:text-red-500 transition-colors"
        />
      </button>
    </Tooltip>
  );
};
