import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useAttachments } from "../../hooks/useAttachments";
import Attachment from "./Attachment";

export default function AttachmentsContainer({
    localState,
    setLocalState,
}) {
    const [processingFiles, setProcessingFiles] = useState(new Set());
    const { removeAttachment, clearAttachments, readFileAsBase64 } = useAttachments();
    const attachments = localState.messages[localState.messages.length - 1].content.slice(1);
        
  return attachments.length > 0 && (
    <div className="select-none p-2">
    {/* Header for attachments */}
    <div className="flex items-center justify-between mb-2">
    {/* Attachments title text */}
    <p className="text-sm font-medium text-tertiary">
        <Trans i18nKey="description.file1" />
    </p>
    {/* Clear attachments button */}
    <p
        className="text-red-400 hover:text-red-300 cursor-pointer text-xs font-medium"
        onClick={() => clearAttachments({
            localState,
            setLocalState
        })}
    >
        <Trans i18nKey="description.file2" />
    </p>
    </div>
    <div className="flex flex-nowrap gap-2 overflow-x-auto w-full pb-2 hide-scrollbar">
    {Array.from(attachments).map((attachment, index) => {
        return (
            <Attachment
                localState={localState}
                setLocalState={setLocalState}
                attachment={attachment}
                index={index}
            />
        );
    })}
    </div>
    </div>
  );
}
