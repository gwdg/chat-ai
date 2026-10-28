import { useEffect } from "react";
import Tooltip from "../Others/Tooltip";
import { useTranslation } from "react-i18next";
import { useToast } from "../../hooks/useToast";
import { FolderAdd } from "@carbon/icons-react";
import { isAgentEnabled } from "../../apis/agentEndpoints";
import { useModal } from "../../modals/ModalContext";
import { canMountLocalDirectory, mountLocalDirectory, setAccessPrompt } from "../../agent/workspace";

// Gives the agent read-write access to a local folder. After a reload the browser forgets the
// permission; the agent then asks for it again through a dialog when it next uses the folder.
export default function MountFolderButton({ localState }) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const { openModal } = useModal();
  const enabled = isAgentEnabled() && canMountLocalDirectory();

  useEffect(() => {
    if (!enabled) return;
    setAccessPrompt(
      (handle) =>
        new Promise((resolve) =>
          openModal("folderAccess", {
            name: handle.name,
            onAllow: async () => {
              try {
                resolve((await handle.requestPermission({ mode: "readwrite" })) === "granted");
              } catch {
                resolve(false);
              }
            },
            onDeny: () => resolve(false),
          })
        )
    );
    return () => setAccessPrompt(null);
  }, [enabled, openModal]);

  if (!enabled) return null;

  const handleClick = async () => {
    try {
      const at = await mountLocalDirectory(localState.id);
      if (at) notifySuccess(t("conversation.folder_mounted", { path: at }));
    } catch (error) {
      notifyError(error.message);
    }
  };

  return (
    <Tooltip text={t("conversation.mount_folder")}>
      <button
        onClick={handleClick}
        className="h-[30px] w-[30px] flex items-center justify-center cursor-pointer"
      >
        <FolderAdd size={22} className="text-tertiary" />
      </button>
    </Tooltip>
  );
}
