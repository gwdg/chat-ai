import { useAttachments } from "../../hooks/useAttachments";
import icon_file_uploaded from "../../assets/icons/file_uploaded.svg";
import icon_cross from "../../assets/icons/cross.svg";
import icon_mic from "../../assets/icons/mic.svg";
import icon_support_video from "../../assets/icons/support_video.svg";
import { useEffect, useRef, useState } from "react";
import { useModal } from "../../modals/ModalContext";
import { useFiles, useFileMeta, useFileBase64, loadFile, saveFile } from "../../db";
import { FileWarning } from "lucide-react";
import { processFile } from "../../apis/processFile";
import { getFileType } from "../../utils/attachments";

export default function Attachment({
    localState,
    setLocalState,
    attachment,
    index,
    inHistory = false,
}) {
    const { openModal } = useModal();
    const [isProcessing, setIsProcessing] = useState(false);
    
    const { removeAttachment, clearAttachments, readFileAsBase64 } = useAttachments();
    const file = useFileMeta(attachment.fileId);
    const isImage = file?.type?.startsWith('image/');
    const base64 = useFileBase64(isImage ? attachment.fileId : null);
    if (!file) return "" // TODO placeholder file
    const fileType = getFileType(file); // Get readable file type, e.g., "image"
    const model = localState.settings.model;
    const isAudioSupported = (model?.input?.includes("audio") || false)
    const isVideoSupported = (model?.input?.includes("video") || false)
    const isImageSupported = (model?.input?.includes("image") || false)
    const isFileSupported = !fileType ? false 
        : fileType === "image" ? isImageSupported
        : fileType === "audio" ? isAudioSupported
        : fileType === "video" ? isVideoSupported
        : true

    const handleRemove = () => {
        removeAttachment({
            localState,
            setLocalState,
            index
        });
    }
    // Handle Process File
    const handleProcessFile = async () => {
        setIsProcessing(true);
        const rawFile = await loadFile(attachment.fileId);
        const response = await processFile(rawFile);
        setIsProcessing(false);
        if (!response?.content) return; // TODO error toast
        // Save as markdown file and add to attachments
        const processedFile = new File([response.content], file.name + '.md', { type: "text/markdown" })
        const processedFileId = saveFile(localState.messages[localState.messages.length-1].id, processedFile)
        // Replace current file with processed file
        // TODO success toast, TODO handle when attachments are added/removed during process
        setLocalState((prev) => {
            const messages = [...prev.messages]; // shallow copy
            messages[messages.length - 1].content[index + 1] = 
            {"type": "file", "fileId": processedFileId};
            return { ...prev, messages };
        });
    }

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

    const getFileBadge = (file) => {
        const fileType = getFileType(file);
        if (fileType === "markdown") return "MD";
        if (fileType === "unknown") return "DOC";
        return fileType.toUpperCase();
    };

    const badge = getFileBadge(file);
    const canProcess = !inHistory && (fileType === "pdf"); // TODO add excel and other supported types
    
    const getFileDisplayInfo = (file) => {
        if (canProcess) {
            return {
                bgColor:
                    "relative bg-gradient-to-br from-yellow-100 to-yellow-300 dark:from-yellow-900/30 dark:to-yellow-800/30",
                borderColor: "border-yellow-300 dark:border-yellow-500",
                hoverColor:
                    "hover:from-yellow-100 hover:to-yellow-200 dark:hover:from-yellow-800/40 dark:hover:to-yellow-700/40",
                iconBg: "bg-yellow-500 dark:bg-yellow-600",
                icon: (
                    <FileWarning
                        className="text-yellow-700 dark:text-yellow-300 w-5 h-5"
                        alt={file.name}
                    />
                ),
            };
        }
        if (file.type?.startsWith("audio/")) {
            return {
                bgColor:
                    "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20",
                borderColor: "border-blue-200 dark:border-blue-700/50",
                hoverColor:
                    "hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-800/30 dark:hover:to-blue-700/30",
                iconBg: "bg-blue-500 dark:bg-blue-600",
                icon: (
                    <img
                    className="h-4 w-4 brightness-0 invert"
                    src={icon_mic}
                    alt={file.name}
                    />
                ),
            };
        } else if (file.type?.startsWith("image/")) {
            return {
            bgColor:
                "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20",
            borderColor:
                "border-green-200 dark:border-green-700/50",
            hoverColor:
                "hover:from-green-100 hover:to-green-200 dark:hover:from-green-800/30 dark:hover:to-green-700/30",
            iconBg: "bg-green-500 dark:bg-green-600",
            icon: (
                <img
                className="h-full w-full object-cover rounded"
                // I need to await this, is that possible?
                src={base64}
                alt={file.name}
                />
            ),
            };
        } else if (file.type?.startsWith("video/")) {
            return {
            bgColor:
                "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20",
            borderColor:
                "border-purple-200 dark:border-purple-700/50",
            hoverColor:
                "hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-800/30 dark:hover:to-purple-700/30",
            iconBg: "bg-purple-500 dark:bg-purple-600",
            icon: (
                <img
                className="h-4 w-4 brightness-0 invert"
                src={icon_support_video}
                alt="video"
                />
            ),
            };
        } else {
            // Other files
            return {
            bgColor:
                "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50",
            borderColor: "border-gray-200 dark:border-gray-600/50",
            hoverColor:
                "hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700/60 dark:hover:to-gray-600/60",
            iconBg: "bg-gray-500 dark:bg-gray-600",
            icon: (
                <img
                className="h-4 w-4 brightness-0 invert"
                src={icon_file_uploaded}
                alt="uploaded"
                />
            ),
            };
        }
    };
  
    const displayInfo = getFileDisplayInfo(file);

  return (
    <div
      key={`${file.name}-${index}`}
      className={`cursor-pointer flex-shrink-0 w-[200px] h-[80px] ${displayInfo.bgColor} ${displayInfo.hoverColor} ${displayInfo.borderColor} border rounded-lg transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md`}
      onClick={() => {openModal("preview", {previewFile: file, fileId: attachment.fileId} );}}
  >
      
    {canProcess
    ? ( // Container for files that need processing
    <div className="flex flex-col w-full p-2 w-full h-full relative">
        <div>
            {/* Top row */}
            <p
            className="font-medium text-xs text-gray-900 dark:text-white mb-1 truncate"
            title={file.name}
            >
            {file.name}
            </p>

            {/* Middle row */}
            <div className="flex items-center gap-2">
            {isProcessing
            ? ( 
            <div className="flex py-2 bg-gradient-to-r rounded-sm items-center justify-center gap-1 text-xs w-full
                from-amber-700 to-orange-700 text-white
                dark:from-amber-700 to-orange-700 dark:text-gray-400">
                <svg
                    className="animate-spin h-3 w-3"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    />
                    <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
                {/* <span>Processing...</span> */}
            </div> ) 
            : ( 
            <button
                onClick={(e) => {
                e.stopPropagation();
                handleProcessFile();
                }}
                className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-orange-600
                hover:from-amber-600 hover:to-orange-700 text-white 
                rounded-sm text-xs font-semibold shadow-md shadow-yellow-500/30 
                animate-pulse hover:animate-none
                transition duration-200 ease-in-out text-center"
                >
                Process
            </button>
            )}

            {/* File size */}
            <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {formatFileSize(file.size)}
            </span>

            {/* Badge */}
            <span
                className={`px-1.5 py-0.5 text-xs font-medium rounded-full
                bg-red-500/30 dark:bg-red-800/30 text-red-800 dark:text-red-200
                `}
            >
                {badge}
            </span>
            {/* Remove button - positioned at card corner */}
            {!inHistory &&
            <button
                className="absolute top-1 right-1 p-1 bg-white/30 hover:bg-white/90 dark:hover:bg-black/70 rounded-full flex-shrink-0 focus:outline-none transition-colors"
                onClick={(e) => {
                e.stopPropagation();
                handleRemove();
                }}
                aria-label="Remove file"
            >
                <img
                src={icon_cross}
                alt="remove"
                className="h-4 w-4 opacity-70 hover:opacity-100 transition-opacity"
                />
            </button>
            }
            </div>
        </div>
        {/* Process Needed Warning*/}
        <span className="text-[11px] text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
            <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3 h-3 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            >
            <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.721-1.36 
                3.486 0l6.857 12.177c.75 1.332-.213 2.974-1.742 
                2.974H3.142c-1.53 0-2.492-1.642-1.743-2.974L8.257 3.1zM11 
                14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 
                0 01-1-1V8a1 1 0 112 0v3a1 1 0 01-1 1z"
                clipRule="evenodd"
            />
            </svg>
            File must be processed
        </span>
    </div> )
    : ( // Version for files that are already processed or don't need it
    <div className="p-2 w-full h-full flex flex-col relative">
    <div className="flex items-center gap-2 flex-1 ">
    <div
    className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded ${displayInfo.iconBg} overflow-hidden`}
    >
    {displayInfo.icon}
    </div>
    <div className="min-w-0 flex-grow pr-6">
        <p
            className="font-medium text-xs text-gray-900 dark:text-white leading-tight mb-1 truncate"
            title={file.name}
        >
            {file.name}
        </p>
        <div className="flex items-center gap-2">
            {/* File size */}
            <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
            {formatFileSize(file.size)}
            </span>
            {/* Badge */}
            <span
            className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${
                file.type === "audio"
                ? "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200"
                : file.type === "image"
                ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                : file.type === "video"
                ? "bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200"
                : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            }`}
            >
            {badge}
            </span>
            {/* Remove button - positioned at card corner */}
        {!inHistory &&
        <button
            className="absolute top-1 right-1 p-1 bg-white/30 hover:bg-white/90 dark:hover:bg-black/70 rounded-full flex-shrink-0 focus:outline-none transition-colors"
            onClick={(e) => {
            e.stopPropagation();
            removeAttachment({
                localState,
                setLocalState,
                index
            });
            }}
            aria-label="Remove file"
        >
            <img
            src={icon_cross}
            alt="remove"
            className="h-4 w-4 opacity-70 hover:opacity-100 transition-opacity"
            />
        </button>
        }

        </div>
        </div>
        </div>
        {/* Process Needed Warning*/}
        {(!isFileSupported || fileType === "pdf") && (
        <span className="text-[11px] text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
            <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3 h-3 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            >
            <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.721-1.36 
                3.486 0l6.857 12.177c.75 1.332-.213 2.974-1.742 
                2.974H3.142c-1.53 0-2.492-1.642-1.743-2.974L8.257 3.1zM11 
                14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 
                0 01-1-1V8a1 1 0 112 0v3a1 1 0 01-1 1z"
                clipRule="evenodd"
            />
            </svg>
            {!isFileSupported ? `Switch model to support ${fileType}` : "Unprocessed file" }
        </span>
        )}
    </div>
    )}
      </div>
  
    );
}