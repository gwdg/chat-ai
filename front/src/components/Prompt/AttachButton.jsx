import { Fragment, useRef, useState } from "react";
import {
    Popover,
    PopoverButton,
    PopoverPanel,
    Transition,
    useClose,
} from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { Attachment, FolderOpen } from "@carbon/icons-react";
import { ArrowLeft } from "lucide-react";

import Tooltip from "../Others/Tooltip";
import AttachFromWorkspacePanel from "../Workspace/AttachFromWorkspacePanel";
import { useAttachments } from "../../hooks/useAttachments";
import { useChatWorkspaces } from "../../db/workspaceDb";

// The two choices live inside the panel, so their state resets when it unmounts.
function AttachMenu({ workspaceIds, localState, setLocalState, openFilePicker }) {
    const { t } = useTranslation();
    const close = useClose();
    const [view, setView] = useState("menu");

    if (view === "workspace") {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setView("menu")}
                    className="mb-1 flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/70 hover:bg-base-200"
                >
                    <ArrowLeft size={14} />
                    {t("common.back")}
                </button>
                <AttachFromWorkspacePanel
                    workspaceIds={workspaceIds}
                    localState={localState}
                    setLocalState={setLocalState}
                    onClose={close}
                />
            </>
        );
    }

    return (
        <div className="flex flex-col">
            <button
                type="button"
                onClick={() => {
                    close();
                    openFilePicker();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-base-200"
            >
                <Attachment size={18} className="shrink-0 text-accent" />
                {t("conversation.prompt.attach_device")}
            </button>
            <button
                type="button"
                data-guide="attach-from-workspace"
                onClick={() => setView("workspace")}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-base-200"
            >
                <FolderOpen size={18} className="shrink-0 text-accent" />
                {t("conversation.prompt.attach_workspace")}
            </button>
        </div>
    );
}

export default function AttachButton({
    localState,
    setLocalState,
}) {
    const { t } = useTranslation();
    const hiddenFileInput = useRef(null);
    const { addAttachments } = useAttachments();

    const links = useChatWorkspaces(localState?.id);
    const workspaceIds = [...new Set(links.map((link) => link.workspaceId))];
    const hasWorkspace = workspaceIds.length > 0;

    // Trigger file input click
    const openFilePicker = () => {
        if (!hiddenFileInput.current) return;
        hiddenFileInput.current.value = null;
        hiddenFileInput.current.click();
    };

    // Handle text and CSV file uploads
    const handleFilesChange = async (e) => {
        addAttachments({
            localState,
            setLocalState,
            selectedFiles: e.target.files,
        });
    };

    const fileInput = (
        <input
            type="file"
            ref={hiddenFileInput}
            multiple
            onChange={handleFilesChange}
            className="hidden"
        />
    );

    if (!hasWorkspace) {
        return (
            <>
                {fileInput}
                <Tooltip text={t("conversation.prompt.attach")}>
                    <Attachment
                        size={24}
                        className="cursor-pointer flex text-accent"
                        onClick={openFilePicker}
                        data-guide="attach-file"
                    />
                </Tooltip>
            </>
        );
    }

    return (
        <Popover className="relative flex">
            {fileInput}
            <Tooltip text={t("conversation.prompt.attach")}>
                <PopoverButton
                    className="h-[30px] w-[30px] flex items-center justify-center cursor-pointer focus:outline-none"
                    aria-label={t("conversation.prompt.attach")}
                    data-guide="attach-file"
                >
                    <Attachment size={24} className="text-accent" />
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
                    className="z-[60] mb-2 w-72 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-2 shadow-xl"
                >
                    <AttachMenu
                        workspaceIds={workspaceIds}
                        localState={localState}
                        setLocalState={setLocalState}
                        openFilePicker={openFilePicker}
                    />
                </PopoverPanel>
            </Transition>
        </Popover>
    );
}
