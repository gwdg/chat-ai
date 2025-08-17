import { useTranslation } from "react-i18next";
import Tooltip from "../Others/Tooltip";
import icon_undo from "../../assets/icons/undo.svg";

export default function UndoButton ({localState, setLocalState}) {
  const { t } = useTranslation();
  const loading = false; // TODO handle loading

  // Function to handle retry of last message
  const handleUndo = (e) => {
    e.preventDefault();
    // Remove last two messages
    setLocalState((prevState) => ({
      ...prevState,
      messages: localState.messages.slice(0, -2),
    }));
  };

  return (
    <Tooltip text={t("description.undo")}>
      <button
        className="h-[26px] w-[26px] cursor-pointer"
        onClick={handleUndo}
        disabled={loading} // TODO handle loading
      >
        <img
          className="cursor-pointer h-[26px] w-[26px]"
          src={icon_undo}
          alt="undo"
        />
      </button>
    </Tooltip>
  );
};
