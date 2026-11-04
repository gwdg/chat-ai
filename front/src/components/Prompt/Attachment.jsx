import { Trans, useTranslation } from "react-i18next";
import { useAttachments } from "../../hooks/useAttachments";
import MiniAudioButton from "./MiniAudioButton";
import { useState } from "react";
import { useModal } from "../../modals/ModalContext";
import {
  useFileMeta,
  useFileBase64,
  loadFile,
  saveFile,
} from "../../db";
import { WarningAltFilled, Close, Video, DocumentBlank } from "@carbon/icons-react";
import { useSelector } from "react-redux";
import { processFile } from "../../apis/processFile";
import { getFileType } from "../../utils/attachments";
import {
  canConvertDocumentLocally,
  convertDocumentLocally,
} from "../../utils/browserDocumentConversion";
import { selectDocumentConversionMode } from "../../Redux/reducers/userSettingsReducer";
import { useToast } from "../../hooks/useToast";

export default function Attachment({
  localState,
  setLocalState,
  attachment,
  index,
  inHistory = false,
  inAssistant = false,
  suppressUnsupportedWarning = false,
}) {
  const { openModal } = useModal();
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);

  const { removeAttachment, clearAttachments, readFileAsBase64 } =
    useAttachments();
  const { notifySuccess, notifyError } = useToast();
  const documentConversionMode = useSelector(selectDocumentConversionMode);
  const file = useFileMeta(attachment.fileId);
  const isImage = file?.type?.startsWith("image/");
  const isAudio = file?.type?.startsWith("audio/");
  const base64 = useFileBase64((isImage || isAudio) ? attachment.fileId : null);
  if (!file) return ""; // TODO placeholder file
  const fileType = getFileType(file); // Get readable file type, e.g., "image"
  const model = localState.settings.model;

  const isAudioSupported = (localState.settings.enable_tools || (model?.input?.includes("audio") || false));
  const isVideoSupported = (localState.settings.enable_tools || (model?.input?.includes("video") || false));
  const isImageSupported = (localState.settings.enable_tools || (model?.input?.includes("image") || false));
  const isFileSupported = !fileType
    ? false
    : fileType === "image"
    ? isImageSupported
    : fileType === "audio"
    ? isAudioSupported
    : fileType === "video"
    ? isVideoSupported
    : true;

  const handleRemove = () => {
    removeAttachment({
      localState,
      setLocalState,
      index,
    });
  };
  // Handle Process File
  const handleProcessFile = async (useBrowser = documentConversionMode !== "server") => {
    setIsProcessing(true);
    const rawFile = await loadFile(attachment.fileId);
    const response =
      useBrowser && canConvertDocumentLocally(fileType)
        ? await convertDocumentLocally(rawFile, fileType)
        : await processFile(rawFile);
    setIsProcessing(false);
    if (!response?.content) {
      notifyError("Error processing file");
      return;
    } else {
      notifySuccess("File processed successfully");
    }
    // Save as markdown file and add to attachments
    const processedFile = new File([response.content], file.name + ".md", {
      type: "text/markdown",
    });
    const processedFileId = saveFile(
      localState.messages[localState.messages.length - 1].id,
      processedFile
    );
    // Replace current file with processed file
    // TODO success toast, TODO handle when attachments are added/removed during process
    setLocalState((prev) => {
      const messages = [...prev.messages]; // shallow copy
      messages[messages.length - 1].content[index + 1] = {
        type: "file",
        fileId: processedFileId,
      };
      return { ...prev, messages };
    });
  };

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
  const canProcess = !inHistory && (fileType === "pdf" || fileType === "docx"); // TODO add other supported types

  const getFileDisplayInfo = (file) => {
    if (canProcess) {
      return {
        bgColor:
          "relative bg-warning/10",
        borderColor: "border-warning/40",
        hoverColor:
          "hover:bg-warning/20",
        iconBg: "bg-warning",
        icon: (
          <WarningAltFilled size={20} className="text-warning-content" />
        ),
      };
    }
    if (file.type?.startsWith("audio/")) {
      return {
        bgColor:
          "bg-info/10",
        borderColor: "border-info/30",
        hoverColor:
          "hover:bg-info/20",
        iconBg: "bg-transparent",
        icon: (
          <MiniAudioButton src={base64} />
        ),
      };
    } else if (file.type?.startsWith("image/")) {
      return {
        bgColor:
          "bg-success/10",
        borderColor: "border-success/30",
        hoverColor:
          "hover:bg-success/20",
        iconBg: "bg-success",
        icon: (
          <img
            className="h-full w-full object-cover rounded"
            src={base64}
            alt={file.name}
          />
        ),
      };
    } else if (file.type?.startsWith("video/")) {
      return {
        bgColor:
          "bg-secondary/10",
        borderColor: "border-secondary/30",
        hoverColor:
          "hover:bg-secondary/20",
        iconBg: "bg-secondary",
        icon: (
          <Video size={16} className="text-secondary-content" />
        ),
      };
    } else {
      // Other files
      return {
        bgColor:
          "bg-gradient-to-br from-base-200 to-base-300",
        borderColor: "border-base-300/50",
        hoverColor:
          "hover:from-base-300 hover:to-base-300/80",
        iconBg: "bg-base-300",
        icon: (
          <DocumentBlank size={16} className="text-base-content" />
        ),
      };
    }
  };

  const displayInfo = getFileDisplayInfo(file);

  return (
    <div
      key={`${file.name}-${index}`}
      data-guide={inHistory ? undefined : "attachment-card"}
      className={`cursor-pointer flex-shrink-0 w-[200px] h-[80px] ${displayInfo.bgColor} ${displayInfo.hoverColor} ${displayInfo.borderColor} border rounded-lg transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md`}
      onClick={() => {
        openModal("preview", { previewFile: file, fileId: attachment.fileId });
      }}
    >
      {canProcess ? (
        // Container for files that need processing
        <div className="flex flex-col w-full p-1.5 h-full relative">
          <div className="flex items-center gap-2 pr-5">
            <p
              className="min-w-0 flex-1 font-medium text-xs text-base-content truncate"
              title={file.name}
            >
              {file.name}
            </p>
            <span className="shrink-0 text-[10px] text-base-content/70 whitespace-nowrap">
              {formatFileSize(file.size)}
            </span>
          </div>

          <div className="mt-1 flex-1">
            {isProcessing ? (
              <div
                className="flex h-full min-h-5 w-full items-center justify-center gap-1 rounded-sm
                bg-warning py-0.5 text-xs leading-tight text-warning-content"
              >
                <span className="loading loading-spinner loading-xs" />
              </div>
            ) : (
              <div
                className={`grid gap-1 ${documentConversionMode === "choice" ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {documentConversionMode !== "server" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProcessFile(true);
                    }}
                    data-guide="process-file"
                    className="btn btn-warning btn-xs h-auto min-h-5 py-0.5 text-[10px] leading-tight rounded-sm"
                  >
                    {t("conversation.attachment.process_browser")}
                  </button>
                )}
                {documentConversionMode !== "browser" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProcessFile(false);
                    }}
                    data-guide="process-file"
                    className="btn btn-warning btn-xs h-auto min-h-5 py-0.5 text-[10px] leading-tight rounded-sm"
                  >
                    {t("conversation.attachment.process_server")}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between gap-1 leading-tight">
            <span className="flex min-w-0 items-center gap-1 text-[10px] text-warning">
              <WarningAltFilled size={10} className="flex-shrink-0" />
              <span className="truncate">
                {t("conversation.attachment.must_process")}
              </span>
            </span>
            <span
              className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full
                bg-error/20 text-error
                `}
            >
              {badge}
            </span>
          </div>

          {!inHistory && (
            <button
              className="btn btn-ghost btn-xs btn-circle absolute top-1 right-1 bg-base-100/30 hover:bg-base-100/90"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              aria-label="Remove file"
            >
              <Close size={16} className="opacity-70 hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
      ) : (
        // Version for files that are already processed or don't need it
        <div className="p-2 w-full h-full flex flex-col relative">
          <div className="flex items-center gap-2 flex-1 ">
            <div
              className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full ${displayInfo.iconBg} overflow-hidden`}
            >
              {displayInfo.icon}
            </div>
            <div className="min-w-0 flex-grow pr-6">
              <p
                className="font-medium text-xs text-base-content leading-tight mb-1 truncate"
                title={file.name}
              >
                {file.name}
              </p>
              <div className="flex items-center gap-2">
                {/* File size */}
                <span className="text-xs text-base-content/70 whitespace-nowrap">
                  {formatFileSize(file.size)}
                </span>
                {/* Badge */}
                <span
                  className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${
                    file.type === "audio"
                      ? "bg-info/20 text-info"
                      : file.type === "image"
                      ? "bg-success/20 text-success"
                      : file.type === "video"
                      ? "bg-secondary/20 text-secondary"
                      : "bg-base-300 text-base-content"
                  }`}
                >
                  {badge}
                </span>
                {/* Remove button - positioned at card corner */}
                {!inHistory && (
                  <button
                    className="btn btn-ghost btn-xs btn-circle absolute top-1 right-1 bg-base-100/30 hover:bg-base-100/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAttachment({
                        localState,
                        setLocalState,
                        index,
                      });
                    }}
                    aria-label="Remove file"
                  >
                    <Close size={16} className="opacity-70 hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Process Needed Warning*/}
          {!inAssistant && !suppressUnsupportedWarning && (!isFileSupported || fileType === "pdf") && (
            <span className="text-[11px] text-warning flex items-center gap-1">
              <WarningAltFilled size={12} className="flex-shrink-0" />
              {!isFileSupported
                ? <Trans i18nKey="conversation.attachment.file_unsupported" values={{ filetype: fileType }} />
                : <Trans i18nKey="conversation.attachment.unprocessed" />}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
