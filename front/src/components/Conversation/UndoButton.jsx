import { useTranslation } from "react-i18next";
import Tooltip from "../Others/Tooltip";
import { Undo2 } from "lucide-react";

export default function UndoButton({ localState, setLocalState }) {
  const { t } = useTranslation();
  const loading = false; // TODO handle loading

  // Function to handle retry of last message
  const handleUndo = (e) => {
    e.preventDefault();
    // Remove last two messages
    setLocalState((prevState) => ({
      ...prevState,
      messages: localState.messages.slice(0, Math.max(2, localState.messages.length - 2)),
    }));
  };

  return (
    <Tooltip text={t("description.undo")}>
      <button
        className="h-[26px] w-[26px] cursor-pointer"
        onClick={handleUndo}
        disabled={loading} // TODO handle loading
      >
        <Undo2 className="cursor-pointer h-[26px] w-[26px] text-[#009EE0] hover:text-blue-600 transition-colors" />
      </button>
    </Tooltip>
  );
}
