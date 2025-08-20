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

    // processing function
    // const handleDocumentProcess = async (file, index) => {
    //     try {
    //     setProcessingFiles((prev) => new Set(prev).add(index));

    //     // Pass the original File object
    //     const result = await processFile(file.file);

    //     if (result.success && result.content) {
    //         setSelectedFiles((prevFiles) => {
    //         const newFiles = [...prevFiles];
    //         newFiles[index] = {
    //             ...newFiles[index],
    //             processed: true,
    //             processedContent: result.content,
    //         };
    //         return newFiles;
    //         });

    //         const fileTypeLabel = file.fileType.toUpperCase();
    //         notifySuccess(`${fileTypeLabel} processed successfully`);
    //     } else {
    //         throw new Error(
    //         result.error ||
    //             `No content received from ${file.fileType.toUpperCase()} processing`
    //         );
    //     }
    //     } catch (error) {
    //     console.error("Processing error details:", {
    //         error: error.message,
    //         fileName: file.name,
    //         fileType: file.fileType,
    //         fileSize: file.size,
    //     });
    //     setSelectedFiles((prevFiles) => {
    //         const newFiles = [...prevFiles];
    //         newFiles[index] = {
    //         ...newFiles[index],
    //         processed: false,
    //         };
    //         return newFiles;
    //     });
    //     console.error(`${file.fileType.toUpperCase()} processing error:`, error);
    //     notifyError(
    //         `Failed to process ${file.fileType.toUpperCase()}: ${error.message}`
    //     );
    //     } finally {
    //     setProcessingFiles((prev) => {
    //         const newSet = new Set(prev);
    //         newSet.delete(index);
    //         return newSet;
    //     });
    //     }
    // };


    // Convert file size from bytes to human-readable format (e.g., KB, MB, GB)
    function formatFileSize(bytes) {
        if (!bytes) return "NaN";
        const units = ["Bytes", "KB", "MB", "GB", "TB"];
        let size = bytes;
        let unitIndex = 0;

        // Keep dividing by 1024 until we reach the appropriate unit
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        // Return formatted string with 2 decimal places and unit
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
        
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
