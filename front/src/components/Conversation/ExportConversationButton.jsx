import { useTranslation } from "react-i18next";
import { useModal } from "../../modals/ModalContext";
import Tooltip from "../Others/Tooltip";

import { Download } from "lucide-react";

export default function ExportConversationButton({
  localState,
  setLocalState,
}) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const loading = false; // TODO handle loading

  return (
    <div className="w-full bottom-0 sticky select-none h-fit px-3 py-1.5 flex justify-end items-center bg-white dark:bg-bg_secondary_dark rounded-b-xl">
      <Tooltip text={t("description.export")}>
        <button
          className="text-tertiary flex gap-1.5 items-center cursor-pointer"
          onClick={() => {
            openModal("exportConversation", { localState, setLocalState });
          }}
          disabled={loading}
        >
          <Download className="h-[26px] w-[26px] text-[#009EE0] hover:text-blue-600 transition-colors" />
        </button>
      </Tooltip>
    </div>
  );
}
