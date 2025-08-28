import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useAttachments } from "../../hooks/useAttachments";
import Attachment from "./Attachment";

export default function AttachmentsContainer({ localState, setLocalState }) {
  const [processingFiles, setProcessingFiles] = useState(new Set());
  const { removeAttachment, clearAttachments, readFileAsBase64 } =
    useAttachments();
  const attachments =
    localState.messages[localState.messages.length - 1].content.slice(1);

  return (
    attachments.length > 0 && (
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
            onClick={() =>
              clearAttachments({
                localState,
                setLocalState,
              })
            }
          >
            <Trans i18nKey="description.file2" />
          </p>
        </div>

        {/* Vertical scrolling container */}
        <div className="flex flex-wrap gap-2 pr-1 max-h-24 sm:max-h-28 md:max-h-40 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
            {Array.from(attachments).map((attachment, index) => {
              return (
                <div key={index} className="">
                  <Attachment
                    localState={localState}
                    setLocalState={setLocalState}
                    attachment={attachment}
                    index={index}
                  />
                </div>
              );
            })}
        </div>
      </div>
    )
  );
}
