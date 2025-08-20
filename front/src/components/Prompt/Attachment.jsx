import { useAttachments } from "../../hooks/useAttachments";
import icon_file_uploaded from "../../assets/icons/file_uploaded.svg";
import icon_cross from "../../assets/icons/cross.svg";
import icon_mic from "../../assets/icons/mic.svg";
import { useEffect, useRef, useState } from "react";
import { useModal } from "../../modals/ModalContext";
import { useFiles, useFileMeta, useFileBase64 } from "../../db";

export default function Attachment({
    localState,
    setLocalState,
    attachment,
    index,
    inHistory = false,
}) {
    const { openModal } = useModal();
    
    const { removeAttachment, clearAttachments, readFileAsBase64 } = useAttachments();
    const file = useFileMeta(attachment.fileId);
    const isImage = file?.type?.startsWith('image/');
    const base64 = useFileBase64(isImage ? attachment.fileId : null);
    if (!file) return "" // TODO placeholder file

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

  const getFileDisplayInfo = (file) => {
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
              badge: file.format?.toUpperCase() || "AUDIO",
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
              badge: "IMAGE",
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
              badge: "VIDEO",
              };
          } else {
              // Text/Document files
              const getDocumentBadge = (file) => {
              //if (file.fileType === "pdf") return "PDF";
              if (file.type?.startsWith("application/pdf")) return "PDF";
              if (file.type?.startsWith("text/csv")) return "CSV";
              if (file.type?.startsWith("text/markdown")) return "MD";
              if (file.type?.startsWith("text/x-code")) return "CODE";
              if (file.type?.startsWith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) return "EXCEL";
              if (file.type?.startsWith("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) return "DOCX";
              return "DOC";
              };
  
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
              badge: getDocumentBadge(file),
              };
          }
          };
  
          const displayInfo = getFileDisplayInfo(file);

  return (
    <div
      key={`${file.name}-${index}`}
      className={`cursor-pointer flex-shrink-0 w-[200px] h-[80px] ${displayInfo.bgColor} ${displayInfo.hoverColor} ${displayInfo.borderColor} border rounded-lg transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md`}
      onClick={() => {
      // Updated preview preparation logic
    //   let previewFile;

    //   if (file.type === "audio") {
    //       // For audio files, ensure we pass the correct format for PreviewModal
    //       previewFile = {
    //       name: file.name,
    //       type: "audio",
    //       text: file.data, // Use 'text' field which contains base64 data
    //       format: file.format,
    //       size: file.size,
    //       };
    //   } else if (file.type === "image") {
    //       // For images, pass as simple string or keep object format
    //       previewFile = file;
    //   } else if (file.type === "video") {
    //       // For videos, pass the data URL
    //       previewFile = file.data || file;
    //   } else {
    //       // For text/document files, preserve original structure
    //       previewFile = {
    //       content: file.data,
    //       name: file.name,
    //       fileType: file.fileType,
    //       processed: file.processed,
    //       processedContent: file.processedContent,
    //       originalFile: file.originalFile,
    //       file: file.file,
    //       data: file.data, // ADDED: Include any base64 data if available
    //       type: file.type || "document", // ADDED: Ensure type is set
    //       };
    //   }

        openModal("preview", {previewFile: file, fileId: attachment.fileId} );
      }}
  >
      <div className="p-2 w-full h-full flex flex-col relative">
      <div className="flex items-center gap-2 flex-1 min-h-0">
          {/* Icon/Thumbnail */}
          <div
          className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded ${displayInfo.iconBg} overflow-hidden`}
          >
          {displayInfo.icon}
          </div>

          {/* File Info */}
          <div className="min-w-0 flex-grow pr-6">
          <p
              className="font-medium text-xs text-gray-900 dark:text-white leading-tight mb-1 truncate"
              title={file.name}
          >
              {file.name}
          </p>

          <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-400">
              {formatFileSize(file.size)}
              </span>
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
              {displayInfo.badge}
              </span>
          </div>
          </div>
      </div>

      {/* Remove button - positioned at card corner */}
      {!inHistory &&
      <button
          className="absolute top-1 right-1 p-1 hover:bg-white/90 dark:hover:bg-black/70 rounded-full flex-shrink-0 focus:outline-none transition-colors"
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

      {/* PDF Processing Status */}
      {(file.fileType === "pdf" ||
          file.fileType === "excel" ||
          file.fileType === "docx") && (
          <div className="flex items-center mt-1 w-full">
          {file.processed ? (
              <span className="text-green-600 dark:text-green-400 text-xs font-medium px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded-full w-full text-center">
              ✓ Processed
              </span>
          ) : processingFiles.has(index) ? (
              <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 text-xs w-full py-0.5">
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
              <span>Processing...</span>
              </div>
          ) : (
              <button
              onClick={(e) => {
                  e.stopPropagation();
                  //handleDocumentProcess(file, index); // Use the new generic function
              }}
              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-xs font-medium transition-colors w-full"
              >
              Process {file.fileType.toUpperCase()}
              </button>
          )}
          </div>
      )}
      </div>
  </div>
    );
}