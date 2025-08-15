import { useTranslation } from "react-i18next";
import Tooltip from "../Others/Tooltip";
import icon_cross_sm from "../../assets/icons/cross_sm.svg";

export default function ClearHistoryButton (localState, setLocalState) {
  const { t } = useTranslation();
  const loading = false; // TODO handle loading

  // Clear conversation history
  const clearHistory = () => {
    setLocalState((prevState) => ({
      ...prevState,
      responses: [], // Clear all responses
      messages:
        prevState.messages.length > 0
          ? [prevState.messages[0]] // Keep only system message if it exists
          : prevState.messages,
    }));

    notifySuccess("History cleared");
  };

  // Function to handle clearing chat history
  const handleClearHistory = () => {
    if (localState.dontShow.dontShowAgain) {
      clearHistory();
    } else {
      openModal("clearHistory", {clearHistory})
    }
  };

  return (
    <Tooltip text={t("description.clear")}>
      <button
        className="h-[26px] w-[26px] cursor-pointer"
        disabled={loading}
        onClick={handleClearHistory}
      >
        <img
          className="cursor-pointer h-[22px] w-[22px]"
          src={icon_cross_sm}
          alt="clear"
        />
      </button>
    </Tooltip>
  );
};
