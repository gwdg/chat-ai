import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import Model from "./Model";
import cross from "../assets/cross.svg";
import { Trans, useTranslation } from "react-i18next";
import { updateConversation } from "../Redux/reducers/conversationsSlice";

function RenameConversationModal({
  showModel,
  conversationId,
  currentTitle,
  onClose,
}) {
  const [title, setTitle] = useState(currentTitle);
  const [error, setError] = useState("");
  const dispatch = useDispatch();
  const { t } = useTranslation();

  useEffect(() => {
    setTitle(currentTitle);
    setError(""); // Clear error when modal reopens
  }, [currentTitle]);

  const handleRename = () => {
    if (!title?.trim()) {
      setError(t("description.error_title"));
      return;
    }

    dispatch(
      updateConversation({
        id: conversationId,
        updates: {
          title: title?.trim(),
          lastModified: new Date().toISOString(),
        },
      })
    );
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    if (error) setError(""); // Clear error when user starts typing
  };

  return (
    <Model showModel={showModel}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black w-full">
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            <Trans i18nKey="description.rename_conversation"></Trans>
          </p>
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={onClose}
          />
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              onKeyDown={handleKeyDown}
              className={`w-full p-2 border ${
                error ? "border-red-500" : "dark:border-border_dark"
              } rounded-lg 
                     bg-white dark:bg-black text-black dark:text-white
                     focus:outline-none focus:ring-2 ${
                       error ? "focus:ring-red-500" : "focus:ring-tertiary"
                     }`}
              placeholder={t("description.input_conversation")}
              autoFocus
            />
            {error && <p className="text-red-500 text-sm pl-1">{error}</p>}
          </div>

          <div className="flex justify-end gap-3 w-full">
            <button
              className="p-3 border dark:border-border_dark rounded-2xl
                       text-black dark:text-white bg-gray-100 dark:bg-gray-800
                       hover:bg-gray-200 dark:hover:bg-gray-700
                       min-w-[100px] select-none"
              onClick={onClose}
            >
              Cancel{" "}
            </button>

            <button
              className="p-3 bg-tertiary text-white rounded-2xl
                       hover:bg-tertiary/90 min-w-[100px]
                       select-none shadow-lg dark:shadow-dark"
              onClick={handleRename}
            >
              <Trans i18nKey="description.input_button"></Trans>
            </button>
          </div>
        </div>
      </div>
    </Model>
  );
}

export default RenameConversationModal;
