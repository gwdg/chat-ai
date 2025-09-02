import { useEffect, useRef, useState } from "react";

import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { useToast } from "../../hooks/useToast";
import icon_image from "../../assets/icons/image.svg";
import { Images } from "lucide-react";

import { useAttachments } from "../../hooks/useAttachments";

export default function AttachMediaButton({
    localState,
    setLocalState,
}) {
    const { t, i18n } = useTranslation();
    const { notifySuccess, notifyError } = useToast();

    const hiddenFileInputImage = useRef(null);

    const { addAttachments } = useAttachments();

    const model = localState.settings.model;
    const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;

    const isAudioSupported = (model?.input?.includes("audio") || false)
    const isVideoSupported = (model?.input?.includes("video") || false)
    const isImageSupported = (model?.input?.includes("image") || false)

    const getAcceptedFileTypes = (
        isImageSupported,
        isVideoSupported,
        isAudioSupported
    ) => {
        const types = [];

        if (isImageSupported) {
        types.push(".jpg", ".jpeg", ".png", ".gif", ".webp");
        }
        if (isVideoSupported) {
        types.push(".mp4", ".avi");
        }
        if (isAudioSupported) {
        types.push(".mp3", ".wav");
        }

        return types.join(",");
    };

    // Handle media file attachments
    const handleFilesChangeMedia = async (e) => {
        addAttachments({
            localState,
            setLocalState,
            selectedFiles: e.target.files
        });
    };

    return (isImageSupported || isVideoSupported || isAudioSupported) && (
            <>
            <input
            type="file"
            ref={hiddenFileInputImage}
            multiple
            accept={getAcceptedFileTypes(
                isImageSupported,
                isVideoSupported,
                isAudioSupported
            )}
            onChange={handleFilesChangeMedia}
            className="hidden"
            />
            <Tooltip text={t("conversation.prompt.attach_media")}>
            <button
                className="h-[25px] w-[25px] cursor-pointer"
                onClick={() => hiddenFileInputImage.current?.click()}
                disabled={loading}
            >
                {/* <img
                className="cursor-pointer h-[25px] w-[25px]"
                src={icon_image}
                alt="attach file"
                /> */}
                <Images
                className="cursor-pointer h-[25px] w-[25px] text-[#009EE0]"
                alt="attach media"
                />
            </button>
            </Tooltip>
        </>
    )
}