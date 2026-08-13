import { GitFork } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useForkConversation } from "../../../hooks/useForkConversation";
import { useModal } from "../../../modals/ModalContext";
import Tooltip from "../../Others/Tooltip";

export default function ForkButton({ localState, message_index }) {
  const { t } = useTranslation();
  const { forkConversation, forking } = useForkConversation(localState);
  const { confirmAction } = useModal();

  // Forking keeps this conversation untouched, but it is not obvious what it
  // does, so explain it once.
  const handleFork = () =>
    confirmAction(
      {
        warningKey: "warn_fork",
        messageKey: "alert.fork_confirm",
        confirmKey: "alert.fork_yes",
      },
      () => forkConversation(message_index)
    );

  return (
    <Tooltip text={t("common.fork")}>
      <button onClick={handleFork} disabled={forking} className="flex">
        <GitFork
          className="h-[22px] w-[22px] cursor-pointer text-[#009EE0]"
          alt="icon_fork"
        />
      </button>
    </Tooltip>
  );
}
