import { Fragment } from "react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { FolderOpen } from "@carbon/icons-react";

import Tooltip from "../Others/Tooltip";
import AttachFromWorkspacePanel from "../Workspace/AttachFromWorkspacePanel";
import { useChatWorkspaces } from "../../db/workspaceDb";

export default function AttachFromWorkspaceButton({
  localState,
  setLocalState,
}) {
  const { t } = useTranslation();
  const conversationId = localState?.id;
  const links = useChatWorkspaces(conversationId);

  if (!conversationId || links.length === 0) return null;

  const workspaceIds = [
    ...new Set(links.map((link) => link.workspaceId)),
  ];

  return (
    <Popover className="relative flex">
      <Tooltip text={t("workspace.attach_from_workspace")}>
        <PopoverButton
          data-guide="attach-from-workspace"
          className="h-[30px] w-[30px] flex items-center justify-center cursor-pointer focus:outline-none"
          aria-label={t("workspace.attach_from_workspace")}
        >
          <FolderOpen size={24} className="text-accent" />
        </PopoverButton>
      </Tooltip>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel
          anchor="top"
          className="z-[60] mb-2 w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-3 shadow-xl"
        >
          {({ close }) => (
            <AttachFromWorkspacePanel
              workspaceIds={workspaceIds}
              localState={localState}
              setLocalState={setLocalState}
              onClose={close}
            />
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
