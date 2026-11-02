import { Trans, useTranslation } from "react-i18next";
import { useAttachments } from "../../hooks/useAttachments";
import MiniAudioButton from "./MiniAudioButton";
import { useEffect, useRef, useState } from "react";
import { useModal } from "../../modals/ModalContext";
import {
  useFileMeta,
  useFileBase64,
  loadFile,
  saveFile,
} from "../../db";
import { WarningAltFilled, Close, Video, DocumentBlank, Settings } from "@carbon/icons-react";
import { useSelector } from "react-redux";
import { processFile } from "../../apis/processFile";
import { getFileType } from "../../utils/attachments";
import {
  canConvertDocumentLocally,
  convertDocumentLocally,
} from "../../utils/browserDocumentConversion";
import { selectDocumentConversionMode } from "../../Redux/reducers/userSettingsReducer";
import { useToast } from "../../hooks/useToast";
import { isAgentEnabled } from "../../apis/agentEndpoints";
import { usePrepareStatus } from "../../agent/prepare";

export default function Attachment({
  localState,
  setLocalState,
  attachment,
  index,
  inHistory = false,
  inAssistant = false,
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
  const prepareStatus = usePrepareStatus(attachment.fileId);
  // PDF/DOCX attachments are converted to markdown automatically, with the
  // method from the settings; the card lets the user switch for this document.
  const [conversionMethod, setConversionMethod] = useState(null);
  const [conversionFailed, setConversionFailed] = useState(false);
  const conversionRun = useRef(0);
  const agentModeEarly = isAgentEnabled();
  const needsConversion =
    !!file && !agentModeEarly && !inHistory && ["pdf", "docx"].includes(getFileType(file));

  const startConversion = async (method) => {
    const run = ++conversionRun.current;
    const fileType = getFileType(file);
    setConversionMethod(method);
    setConversionFailed(false);
    setIsProcessing(true);
    let response = null;
    try {
      const rawFile = await loadFile(attachment.fileId);
      response =
        method === "browser" && canConvertDocumentLocally(fileType)
          ? await convertDocumentLocally(rawFile, fileType)
          : await processFile(rawFile);
    } catch (error) {
      console.warn("Document conversion failed:", error);
    }
    // A newer attempt (user switched method) supersedes this one
    if (run !== conversionRun.current) return;
    setIsProcessing(false);
    if (!response?.content) {
      setConversionFailed(true);
      notifyError(t("conversation.attachment.convert_failed"));
      return;
    }
    notifySuccess("File processed successfully");
    // Save as markdown file and replace the attachment with it
    const processedFile = new File([response.content], file.name + ".md", {
      type: "text/markdown",
    });
    const processedFileId = saveFile(
      localState.messages[localState.messages.length - 1].id,
      processedFile
    );
    // TODO handle when attachments are added/removed during processing
    setLocalState((prev) => {
      const messages = [...prev.messages]; // shallow copy
      messages[messages.length - 1].content[index + 1] = {
        type: "file",
        fileId: processedFileId,
      };
      return { ...prev, messages };
    });
  };

  useEffect(() => {
    if (needsConversion && conversionRun.current === 0) {
      startConversion(documentConversionMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsConversion]);

  const otherMethod = conversionMethod === "server" ? "browser" : "server";
  const openConversionSettings = (e) => {
    e.stopPropagation();
    openModal("userSettings", { localState, initialTab: "chat" });
  };

  if (!file) return ""; // TODO placeholder file
  const fileType = getFileType(file); // Get readable file type, e.g., "image"
  const model = localState.settings.model;
  // The agent copies every upload into its workspace and converts documents and audio on send
  const agentMode = isAgentEnabled();

  const isAudioSupported = (agentMode || localState.settings.enable_tools || (model?.input?.includes("audio") || false));
  const isVideoSupported = (agentMode || localState.settings.enable_tools || (model?.input?.includes("video") || false));
  const isImageSupported = (agentMode || localState.settings.enable_tools || (model?.input?.includes("image") || false));
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
  const canProcess = !agentMode && !inHistory && (fileType === "pdf" || fileType === "docx"); // TODO add other supported types

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
          <WarningAltFilled size={20} className="text-yellow-700 dark:text-yellow-300" />
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
        iconBg: "bg-transparent",
        icon: (
          <MiniAudioButton src={base64} />
        ),
      };
    } else if (file.type?.startsWith("image/")) {
      return {
        bgColor:
          "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20",
        borderColor: "border-green-200 dark:border-green-700/50",
        hoverColor:
          "hover:from-green-100 hover:to-green-200 dark:hover:from-green-800/30 dark:hover:to-green-700/30",
        iconBg: "bg-green-500 dark:bg-green-600",
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
          "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20",
        borderColor: "border-purple-200 dark:border-purple-700/50",
        hoverColor:
          "hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-800/30 dark:hover:to-purple-700/30",
        iconBg: "bg-purple-500 dark:bg-purple-600",
        icon: (
          <Video size={16} className="text-white" />
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
          <DocumentBlank size={16} className="text-white" />
        ),
      };
    }
  };

  const displayInfo = getFileDisplayInfo(file);

  return (
    <div
      key={`${file.name}-${index}`}
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
              className="min-w-0 flex-1 font-medium text-xs text-gray-900 dark:text-white truncate"
              title={file.name}
            >
              {file.name}
            </p>
            <span className="shrink-0 text-[10px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
              {formatFileSize(file.size)}
            </span>
          </div>

          <div className="mt-1 flex flex-1 flex-col justify-center gap-0.5 text-[10px] leading-tight">
            <span
              className={`flex items-center gap-1 ${
                conversionFailed
                  ? "text-red-700 dark:text-red-300"
                  : "text-yellow-800 dark:text-yellow-300"
              }`}
            >
              {conversionFailed ? (
                <WarningAltFilled size={10} className="flex-shrink-0" />
              ) : (
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-600 animate-pulse" />
              )}
              <span className="truncate">
                {conversionFailed
                  ? t("conversation.attachment.convert_failed")
                  : t(`conversation.attachment.converting_${conversionMethod ?? documentConversionMode}`)}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {conversionFailed && (
                <button
                  type="button"
                  className="font-semibold text-amber-800 underline hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    startConversion(conversionMethod ?? documentConversionMode);
                  }}
                >
                  {t("conversation.attachment.retry")}
                </button>
              )}
              <button
                type="button"
                className="truncate text-amber-800 underline hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100"
                onClick={(e) => {
                  e.stopPropagation();
                  startConversion(otherMethod);
                }}
              >
                {t(`conversation.attachment.use_${otherMethod}`)}
              </button>
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 leading-tight">
            <button
              type="button"
              className="rounded p-0.5 text-yellow-800 hover:bg-white/50 dark:text-yellow-300 dark:hover:bg-black/30"
              onClick={openConversionSettings}
              title={t("conversation.attachment.conversion_settings")}
              aria-label={t("conversation.attachment.conversion_settings")}
            >
              <Settings size={12} />
            </button>
            <span
              className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full
                bg-red-500/30 dark:bg-red-800/30 text-red-800 dark:text-red-200
                `}
            >
              {badge}
            </span>
          </div>

          {!inHistory && (
            <button
              className="absolute top-1 right-1 p-1 bg-white/30 hover:bg-white/90 dark:hover:bg-black/70 rounded-full flex-shrink-0 focus:outline-none transition-colors"
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
                {!inHistory && (
                  <button
                    className="absolute top-1 right-1 p-1 bg-white/30 hover:bg-white/90 dark:hover:bg-black/70 rounded-full flex-shrink-0 focus:outline-none transition-colors"
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
          {/* Agent mode: converting or transcribing in the background */}
          {prepareStatus && (
            <span className="text-[11px] text-tertiary flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-tertiary animate-pulse flex-shrink-0" />
              <Trans i18nKey={`conversation.attachment.${prepareStatus}`} />
            </span>
          )}
          {/* Process Needed Warning*/}
          {!inAssistant && !agentMode && (!isFileSupported || fileType === "pdf") && (
            <span className="text-[11px] text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
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
